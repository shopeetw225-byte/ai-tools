import { Hono } from 'hono'
import type { Env } from '../index'
import { workersAIGatewayOptions, executeWithRetry, AI_REQUEST_TIMEOUT_MS, AI_MAX_ATTEMPTS } from '../lib/ai-gateway'

const GRAMMAR_MAX_CHARS = 3000
const FREE_GRAMMAR_DAILY_LIMIT = 3

const SYSTEM_PROMPT = `You are a professional English grammar checker. Analyze the input text and identify all grammar, spelling, punctuation, and style errors.

For each error found, return a JSON array of correction objects. Each object must have:
- "original": the exact substring from the input that contains the error
- "corrected": the corrected version of that substring
- "explanation": a brief explanation in Traditional Chinese (繁體中文) of why this is an error and how it was fixed

If there are no errors, return an empty array: []

RULES:
- Return ONLY a valid JSON array. No markdown, no code fences, no extra text.
- "original" must be an exact substring match from the input text.
- Keep explanations concise (one sentence).
- Focus on: grammar errors, spelling mistakes, punctuation issues, subject-verb agreement, tense consistency, article usage, preposition errors.
- Do NOT flag correct English as errors. Only flag genuine mistakes.
- Do NOT rewrite for style unless there is a clear grammatical mistake.

EXAMPLES:

Input: "She dont likes cats"
Output: [{"original":"dont likes","corrected":"doesn't like","explanation":"主詞 She 為第三人稱單數，助動詞應使用 doesn't，且 like 不需加 s。"}]

Input: "I has went to school"
Output: [{"original":"has went","corrected":"have gone","explanation":"主詞 I 搭配 have（非 has），且 go 的過去分詞為 gone。"},{"original":"I has","corrected":"I have","explanation":"第一人稱 I 應使用 have 而非 has。"}]

Input: "The weather is nice today."
Output: []`

interface GrammarRequest {
  text: string
}

interface GrammarCorrection {
  original: string
  corrected: string
  explanation: string
}

function parseCorrections(raw: string): GrammarCorrection[] {
  // Strip markdown code fences if the model wraps the output
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  // Try to extract JSON array if the model added extra text around it
  if (!cleaned.startsWith('[')) {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      cleaned = arrMatch[0]
    }
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      console.warn('grammar.parseCorrections: model returned non-array JSON', { type: typeof parsed, raw: raw.slice(0, 200) })
      return []
    }
    const valid = parsed.filter(
      (item: unknown): item is GrammarCorrection =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as GrammarCorrection).original === 'string' &&
        typeof (item as GrammarCorrection).corrected === 'string' &&
        typeof (item as GrammarCorrection).explanation === 'string',
    )
    if (valid.length < parsed.length) {
      console.warn('grammar.parseCorrections: filtered out malformed items', { total: parsed.length, valid: valid.length })
    }
    return valid
  } catch (e) {
    console.warn('grammar.parseCorrections: JSON parse failed', { error: String(e), raw: raw.slice(0, 300) })
    return []
  }
}

const grammar = new Hono<{ Bindings: Env }>()

grammar.post('/', async (c) => {
  const userId = c.get('userId' as never) as string

  const body = await c.req.json<GrammarRequest>()

  if (!body.text?.trim()) {
    return c.json({ error: '請輸入要校正的英文文字' }, 400)
  }

  const text = body.text.trim()
  if (text.length > GRAMMAR_MAX_CHARS) {
    return c.json({ error: `文字不得超過 ${GRAMMAR_MAX_CHARS} 字元（目前 ${text.length} 字元）` }, 400)
  }

  // Check subscription
  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  const isPro = sub?.plan === 'pro' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())

  // Check tool-specific quota for free users
  const today = new Date().toISOString().split('T')[0]

  if (!isPro) {
    const toolUsage = await c.env.DB
      .prepare('SELECT count FROM tool_daily_usage WHERE user_id = ? AND tool_name = ? AND date = ? LIMIT 1')
      .bind(userId, 'grammar-check', today)
      .first<{ count: number }>()

    const usedToday = toolUsage?.count ?? 0

    if (usedToday >= FREE_GRAMMAR_DAILY_LIMIT) {
      return c.json({
        error: 'quota_exceeded',
        message: `今日免費語法校正次數已用完（${usedToday}/${FREE_GRAMMAR_DAILY_LIMIT}）`,
        upgradeUrl: '/pricing',
        usage: { grammarToday: usedToday, grammarLimit: FREE_GRAMMAR_DAILY_LIMIT },
      }, 429)
    }
  }

  // Record tool run
  let toolRunId: string | undefined
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO tool_runs (user_id, tool_name, input, status) VALUES (?, 'grammar-check', ?, 'running') RETURNING id`,
    )
      .bind(userId, text.slice(0, 1000))
      .first<{ id: string }>()
    toolRunId = result?.id
  } catch {
    // Non-fatal
  }

  try {
    const gatewayOptions = workersAIGatewayOptions(c.env.AI_GATEWAY_URL)

    const response = await executeWithRetry(
      async (signal) => {
        const opts = gatewayOptions ? { ...gatewayOptions, signal } : { signal }
        return (c.env.AI.run as (...args: unknown[]) => Promise<unknown>)(
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          {
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text },
            ],
          },
          opts,
        )
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS, maxAttempts: AI_MAX_ATTEMPTS },
    ) as { response: string }

    const rawOutput = response.response ?? ''
    const corrections = parseCorrections(rawOutput)

    // Increment tool-specific + global usage AFTER successful AI call
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO tool_daily_usage (user_id, tool_name, date, count) VALUES (?, 'grammar-check', ?, 1)
         ON CONFLICT(user_id, tool_name, date) DO UPDATE SET count = count + 1`,
      ).bind(userId, today),
      c.env.DB.prepare(
        `INSERT INTO daily_usage (user_id, date, count) VALUES (?, ?, 1)
         ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1`,
      ).bind(userId, today),
    ])

    // Update tool run
    try {
      if (toolRunId) {
        await c.env.DB.prepare(
          `UPDATE tool_runs SET output = ?, status = 'done', completed_at = datetime('now') WHERE id = ?`,
        )
          .bind(rawOutput.slice(0, 5000), toolRunId)
          .run()
      }
    } catch {
      // Non-fatal
    }

    // Get updated usage
    const updatedToolUsage = await c.env.DB
      .prepare('SELECT count FROM tool_daily_usage WHERE user_id = ? AND tool_name = ? AND date = ? LIMIT 1')
      .bind(userId, 'grammar-check', today)
      .first<{ count: number }>()

    const globalUsage = await c.env.DB
      .prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ? LIMIT 1')
      .bind(userId, today)
      .first<{ count: number }>()

    return c.json({
      corrections,
      correctionCount: corrections.length,
      tool_run_id: toolRunId,
      tool: 'grammar-check',
      usage: {
        grammarToday: updatedToolUsage?.count ?? 1,
        grammarLimit: isPro ? null : FREE_GRAMMAR_DAILY_LIMIT,
        totalToday: globalUsage?.count ?? 0,
        totalLimit: isPro ? null : 10,
      },
    })
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

    console.error('grammar.ai_error', {
      toolRunId: toolRunId ?? null,
      message: err instanceof Error ? err.message : String(err),
    })

    return c.json({ error: '語法校正暫時無法使用，請稍後再試' }, 500)
  }
})

export default grammar
