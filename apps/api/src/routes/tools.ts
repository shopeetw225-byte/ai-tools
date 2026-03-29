import { Hono } from 'hono'
import type { Env } from '../index'
import { workersAIGatewayOptions, executeWithRetry, AI_REQUEST_TIMEOUT_MS, AI_MAX_ATTEMPTS } from '../lib/ai-gateway'

type ToolName = 'summarize' | 'translate' | 'explain-code'

interface ToolRequest {
  input: string
  options?: Record<string, string>
}

const INPUT_LIMITS: Record<ToolName, { maxChars?: number; maxLines?: number }> = {
  summarize: { maxChars: 5000 },
  translate: { maxChars: 3000 },
  'explain-code': { maxLines: 2000 },
}

function buildSummarizePrompt(input: string, opts: Record<string, string>): string {
  const lengthMap: Record<string, string> = {
    short: 'in approximately 100 characters, as a few concise bullet points',
    medium: 'in approximately 300 characters, as structured bullet points',
    detailed: 'in approximately 500 characters, as detailed bullet points with key insights',
  }
  const lengthInstruction = lengthMap[opts.summaryLength ?? 'medium'] ?? lengthMap.medium
  return `Summarize the following text ${lengthInstruction}. Format the output as a bulleted list of key points:\n\n${input}`
}

function buildTranslatePrompt(input: string, opts: Record<string, string>): string {
  const target = opts.targetLanguage ?? 'English'
  const source = opts.sourceLanguage
  const sourceInstruction = source && source !== 'auto'
    ? `from ${source} `
    : ''
  return `Translate the following text ${sourceInstruction}to ${target}. Output only the translation, no explanation:\n\n${input}`
}

function buildExplainCodePrompt(input: string, opts: Record<string, string>): string {
  const lang = opts.language
  const langHint = lang && lang !== 'auto'
    ? ` (written in ${lang})`
    : ''
  return `Explain the following code${langHint} clearly and in detail. Structure your response as:
1. **Overview**: A brief summary of what the code does
2. **Step-by-step explanation**: Walk through each section of the code
3. **Potential issues**: Note any bugs, edge cases, or improvements (if applicable)

\`\`\`
${input}
\`\`\``
}

const TOOL_PROMPTS: Record<ToolName, (input: string, opts: Record<string, string>) => string> = {
  summarize: buildSummarizePrompt,
  translate: buildTranslatePrompt,
  'explain-code': buildExplainCodePrompt,
}

const FRIENDLY_TOOL_ERROR =
  'Unable to run this tool right now. Please try again.'

function validateInput(name: ToolName, input: string): string | null {
  const limits = INPUT_LIMITS[name]
  if (limits.maxChars && input.length > limits.maxChars) {
    return `Input exceeds maximum of ${limits.maxChars} characters (got ${input.length})`
  }
  if (limits.maxLines) {
    const lineCount = input.split('\n').length
    if (lineCount > limits.maxLines) {
      return `Input exceeds maximum of ${limits.maxLines} lines (got ${lineCount})`
    }
  }
  return null
}

const tools = new Hono<{ Bindings: Env }>()

tools.post('/:name', async (c) => {
  const name = c.req.param('name') as ToolName

  if (!TOOL_PROMPTS[name]) {
    return c.json({ error: `Unknown tool: ${name}. Valid tools: ${Object.keys(TOOL_PROMPTS).join(', ')}` }, 400)
  }

  const body = await c.req.json<ToolRequest>()

  if (!body.input?.trim()) {
    return c.json({ error: 'input required' }, 400)
  }

  const validationError = validateInput(name, body.input)
  if (validationError) {
    return c.json({ error: validationError }, 400)
  }

  const prompt = TOOL_PROMPTS[name](body.input, body.options ?? {})

  // Record tool run start in D1 (best-effort)
  const userId = c.get('userId' as never) as string
  let toolRunId: string | undefined
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO tool_runs (user_id, tool_name, input, status) VALUES (?, ?, ?, 'running') RETURNING id`,
    )
      .bind(userId, name, body.input.slice(0, 1000))
      .first<{ id: string }>()
    toolRunId = result?.id
  } catch {
    // Non-fatal: D1 may not be provisioned yet
  }

  try {
    // Route through AI Gateway when configured for observability
    const gatewayOptions = workersAIGatewayOptions(c.env.AI_GATEWAY_URL)

    const response = await executeWithRetry(
      async (signal) => {
        const opts = gatewayOptions ? { ...gatewayOptions, signal } : { signal }
        return (c.env.AI.run as (...args: unknown[]) => Promise<unknown>)(
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          {
            messages: [{ role: 'user', content: prompt }],
          },
          opts,
        )
      },
      {
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
        maxAttempts: AI_MAX_ATTEMPTS,
      },
    ) as { response: string }

    const output = response.response ?? ''

    try {
      if (toolRunId) {
        await c.env.DB.prepare(
          `UPDATE tool_runs SET output = ?, status = 'done', completed_at = datetime('now') WHERE id = ?`,
        )
          .bind(output.slice(0, 5000), toolRunId)
          .run()
      }
    } catch {
      // Non-fatal
    }

    return c.json({ output, tool_run_id: toolRunId, tool: name })
  } catch (err) {
    try {
      if (toolRunId) {
        await c.env.DB.prepare(
          `UPDATE tool_runs SET status = 'error', error = ?, completed_at = datetime('now') WHERE id = ?`,
        )
          .bind(String(err), toolRunId)
          .run()
      }
    } catch {
      // Non-fatal
    }
    console.error('tools.ai_error', {
      tool: name,
      toolRunId: toolRunId ?? null,
      message: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: FRIENDLY_TOOL_ERROR }, 500)
  }
})

export default tools
