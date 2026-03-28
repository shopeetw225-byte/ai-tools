import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import type { Env } from '../index'
import {
  AI_MAX_ATTEMPTS,
  AIRequestError,
  AI_REQUEST_TIMEOUT_MS,
  executeWithRetry,
  readStreamWithTimeout,
  streamAnthropicGateway,
  workersAIGatewayOptions,
} from '../lib/ai-gateway'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type ModelChoice = 'workers-ai' | 'claude-haiku' | 'claude-sonnet'

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct'

const CLAUDE_MODELS: Record<string, string> = {
  'claude-haiku': 'claude-3-haiku-20240307',
  'claude-sonnet': 'claude-3-5-sonnet-20241022',
}

const FRIENDLY_CHAT_ERROR =
  "Sorry, I couldn't generate a response right now. Please try again."

const chat = new Hono<{ Bindings: Env }>()

chat.post('/', async (c) => {
  const body = await c.req.json<{
    messages: Message[]
    conversationId?: string
    model?: ModelChoice
  }>()

  if (!body.messages?.length) {
    return c.json({ error: 'messages required' }, 400)
  }

  const model: ModelChoice = body.model ?? 'workers-ai'
  const useAnthropic = model === 'claude-haiku' || model === 'claude-sonnet'

  if (useAnthropic && !c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: 'Claude model requires ANTHROPIC_API_KEY secret to be configured' },
      503,
    )
  }

  if (useAnthropic && !c.env.AI_GATEWAY_URL) {
    return c.json(
      { error: 'Claude model requires AI_GATEWAY_URL to be configured' },
      503,
    )
  }

  const messages: Message[] = [
    {
      role: 'system',
      content: 'You are a helpful AI assistant. Be concise and clear.',
    },
    ...body.messages,
  ]

  // Persist conversation + messages to D1 (best-effort, don't block stream)
  let conversationId = body.conversationId
  try {
    if (!conversationId) {
      const convResult = await c.env.DB.prepare(
        `INSERT INTO conversations (title, model) VALUES (?, ?) RETURNING id`,
      )
        .bind(
          body.messages[0]?.content?.slice(0, 60) ?? 'New chat',
          useAnthropic ? CLAUDE_MODELS[model] : WORKERS_AI_MODEL,
        )
        .first<{ id: string }>()
      conversationId = convResult?.id
    }

    const lastMsg = body.messages[body.messages.length - 1]
    if (conversationId && lastMsg.role === 'user') {
      await c.env.DB.prepare(
        `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`,
      )
        .bind(conversationId, lastMsg.role, lastMsg.content)
        .run()
    }
  } catch {
    // Non-fatal
  }

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('X-Conversation-Id', conversationId ?? '')
  c.header('X-Model', model)

  return stream(
    c,
    async (s) => {
      let fullResponse = ''
      const provider = useAnthropic ? 'anthropic' : 'workers-ai'

      const logAIError = (stage: string, error: AIRequestError, attempt?: number) => {
        console.error('chat.ai_error', {
          stage,
          provider,
          model,
          attempt,
          maxAttempts: AI_MAX_ATTEMPTS,
          retryable: error.retryable,
          status: error.status ?? null,
          message: error.message,
          conversationId: conversationId ?? null,
        })
      }

      try {
        if (useAnthropic) {
          // Route Claude through Cloudflare AI Gateway
          const anthropicModel = CLAUDE_MODELS[model]
          for await (const token of streamAnthropicGateway(
            c.env.AI_GATEWAY_URL!,
            c.env.ANTHROPIC_API_KEY!,
            messages,
            anthropicModel,
            {
              timeoutMs: AI_REQUEST_TIMEOUT_MS,
              maxAttempts: AI_MAX_ATTEMPTS,
              onError: ({ attempt, error }) => {
                logAIError('gateway_request', error, attempt)
              },
            },
          )) {
            fullResponse += token
            await s.write(
              `data: ${JSON.stringify({ text: token, conversationId, model })}\n\n`,
            )
          }
        } else {
          // Workers AI — route through AI Gateway when URL is configured
          const gatewayOptions = workersAIGatewayOptions(c.env.AI_GATEWAY_URL)
          const aiStream = await executeWithRetry(
            async () =>
              (c.env.AI.run as (...args: unknown[]) => Promise<unknown>)(
                WORKERS_AI_MODEL,
                { messages, stream: true },
                gatewayOptions,
              ),
            {
              timeoutMs: AI_REQUEST_TIMEOUT_MS,
              maxAttempts: AI_MAX_ATTEMPTS,
              onError: ({ attempt, error }) => {
                logAIError('workers_ai_request', error, attempt)
              },
            },
          )

          const reader = (aiStream as ReadableStream<Uint8Array>).getReader()
          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await readStreamWithTimeout(
              reader,
              AI_REQUEST_TIMEOUT_MS,
            )
            if (done) break
            const chunk = decoder.decode(value, { stream: true })

            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data) as { response?: string }
                  if (parsed.response) {
                    fullResponse += parsed.response
                    await s.write(
                      `data: ${JSON.stringify({ text: parsed.response, conversationId, model })}\n\n`,
                    )
                  }
                } catch {
                  // skip malformed chunk
                }
              }
            }
          }
        }
      } catch (err) {
        const normalized =
          err instanceof AIRequestError
            ? err
            : new AIRequestError(err instanceof Error ? err.message : String(err), {
                retryable: false,
                cause: err,
              })
        logAIError('chat_stream_failed', normalized)
        fullResponse += FRIENDLY_CHAT_ERROR
        await s.write(
          `data: ${JSON.stringify({
            text: FRIENDLY_CHAT_ERROR,
            error: 'chat_generation_failed',
            conversationId,
            model,
          })}\n\n`,
        )
      } finally {
        // Persist assistant reply
        try {
          if (conversationId && fullResponse) {
            await c.env.DB.prepare(
              `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`,
            )
              .bind(conversationId, 'assistant', fullResponse)
              .run()
          }
        } catch {
          // Non-fatal
        }
        await s.write('data: [DONE]\n\n')
      }
    },
  )
})

export default chat
