import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import type { Env } from '../index'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const chat = new Hono<{ Bindings: Env }>()

chat.post('/', async (c) => {
  const body = await c.req.json<{
    messages: Message[]
    conversationId?: string
  }>()

  if (!body.messages?.length) {
    return c.json({ error: 'messages required' }, 400)
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
        `INSERT INTO conversations (title, model) VALUES (?, ?) RETURNING id`
      )
        .bind(body.messages[0]?.content?.slice(0, 60) ?? 'New chat', '@cf/meta/llama-3.1-8b-instruct')
        .first<{ id: string }>()
      conversationId = convResult?.id
    }

    // Store the last user message
    const lastMsg = body.messages[body.messages.length - 1]
    if (conversationId && lastMsg.role === 'user') {
      await c.env.DB.prepare(
        `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`
      )
        .bind(conversationId, lastMsg.role, lastMsg.content)
        .run()
    }
  } catch {
    // Non-fatal: continue even if DB is not provisioned yet
  }

  // Stream response via Workers AI
  return stream(c, async (s) => {
    let fullResponse = ''
    try {
      const aiStream = await c.env.AI.run(
        '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0],
        { messages, stream: true } as never
      )

      const reader = (aiStream as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        // Workers AI streams as "data: {...}\n\n" SSE format
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as { response?: string }
              if (parsed.response) {
                fullResponse += parsed.response
                await s.write(`data: ${JSON.stringify({ text: parsed.response, conversationId })}\n\n`)
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      }
    } catch (err) {
      await s.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
    } finally {
      // Persist assistant reply
      try {
        if (conversationId && fullResponse) {
          await c.env.DB.prepare(
            `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`
          )
            .bind(conversationId, 'assistant', fullResponse)
            .run()
        }
      } catch {
        // Non-fatal
      }
      await s.write('data: [DONE]\n\n')
    }
  }, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Conversation-Id': conversationId ?? '',
    },
  })
})

export default chat
