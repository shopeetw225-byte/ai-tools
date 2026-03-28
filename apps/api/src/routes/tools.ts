import { Hono } from 'hono'
import type { Env } from '../index'

type ToolName = 'summarize' | 'translate' | 'explain-code'

const TOOL_PROMPTS: Record<ToolName, (input: string, opts: Record<string, string>) => string> = {
  summarize: (input) =>
    `Summarize the following text in 2-3 concise sentences:\n\n${input}`,
  translate: (input, opts) =>
    `Translate the following text to ${opts.targetLanguage ?? 'English'}. Output only the translation, no explanation:\n\n${input}`,
  'explain-code': (input) =>
    `Explain the following code clearly and concisely. Describe what it does, key concepts used, and any notable patterns:\n\n\`\`\`\n${input}\n\`\`\``,
}

const tools = new Hono<{ Bindings: Env }>()

tools.post('/:name', async (c) => {
  const name = c.req.param('name') as ToolName

  if (!TOOL_PROMPTS[name]) {
    return c.json({ error: `Unknown tool: ${name}. Valid tools: ${Object.keys(TOOL_PROMPTS).join(', ')}` }, 400)
  }

  const body = await c.req.json<{ input: string; options?: Record<string, string> }>()

  if (!body.input?.trim()) {
    return c.json({ error: 'input required' }, 400)
  }

  const prompt = TOOL_PROMPTS[name](body.input, body.options ?? {})

  // Record tool run start in D1 (best-effort)
  let toolRunId: string | undefined
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO tool_runs (user_id, tool_name, input, status) VALUES ('anonymous', ?, ?, 'running') RETURNING id`
    )
      .bind(name, body.input.slice(0, 1000))
      .first<{ id: string }>()
    toolRunId = result?.id
  } catch {
    // Non-fatal: D1 may not be provisioned yet
  }

  try {
    const response = await c.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0],
      {
        messages: [
          { role: 'user', content: prompt },
        ],
      } as never
    ) as { response: string }

    const output = response.response ?? ''

    // Update tool run record
    try {
      if (toolRunId) {
        await c.env.DB.prepare(
          `UPDATE tool_runs SET output = ?, status = 'done', completed_at = datetime('now') WHERE id = ?`
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
          `UPDATE tool_runs SET status = 'error', error = ?, completed_at = datetime('now') WHERE id = ?`
        )
          .bind(String(err), toolRunId)
          .run()
      }
    } catch {
      // Non-fatal
    }
    return c.json({ error: 'AI inference failed', detail: String(err) }, 500)
  }
})

export default tools
