import { Hono } from 'hono'
import type { Env } from '../index'
import { callExternalAI, executeWithRetry, AI_REQUEST_TIMEOUT_MS, AI_MAX_ATTEMPTS } from '../lib/ai-gateway'

const RESUME_MIN_CHARS = 50
const RESUME_MAX_CHARS = 5000
const FREE_RESUME_DAILY_LIMIT = 2
const CLAUDE_HAIKU_MODEL = 'claude-3-haiku-20240307'

const SYSTEM_PROMPT = `你是台灣頂尖的履歷優化專家，專精於 104、1111、CakeResume 等求職平台的履歷撰寫。

你的任務是將用戶提供的履歷內容進行專業優化，遵循以下原則：

1. **量化成就**：將模糊描述轉為具體數據
   - 「提升業績」→「帶領 5 人團隊，Q3 業績成長 32%，年營收突破 NT$1,200 萬」
   - 「負責專案管理」→「同時管理 3 個跨部門專案，準時交付率 95%」

2. **關鍵字強化**：加入產業 ATS 系統常見關鍵字
   - 使用台灣企業熟悉的專業術語
   - 針對目標職位補充相關技能關鍵字

3. **句式改善**：
   - 使用主動語態（「主導」、「推動」、「建立」）
   - 移除冗贅用語
   - 每條經歷以「動詞 + 成果 + 影響範圍」結構呈現

4. **格式規範**：
   - 保持繁體中文（台灣用語）
   - 專有名詞保留英文（如 KPI、ROI、Scrum）
   - 條列式呈現，每條不超過 2 行

輸出格式：
- 直接輸出優化後的完整履歷文字
- 在結尾以「---」分隔，附上 3-5 條具體的改善建議（每條以「- 」開頭）
- 不要加任何前言或解釋，直接給出優化結果`

interface ResumeRequest {
  input: string
  options?: { targetPosition?: string }
}

function buildUserPrompt(input: string, targetPosition?: string): string {
  let prompt = '請優化以下履歷內容：\n\n'
  if (targetPosition) {
    prompt += `目標職位：${targetPosition}\n\n`
  }
  prompt += input
  return prompt
}

function parseResponse(raw: string): { output: string; suggestions: string[] } {
  const parts = raw.split(/\n---\n/)
  const output = parts[0].trim()
  const suggestions: string[] = []

  if (parts[1]) {
    for (const line of parts[1].split('\n')) {
      const trimmed = line.replace(/^[-•*]\s*/, '').trim()
      if (trimmed) suggestions.push(trimmed)
    }
  }

  return { output, suggestions }
}

const resume = new Hono<{ Bindings: Env }>()

resume.post('/', async (c) => {
  const userId = c.get('userId' as never) as string

  // Check Claude API availability
  if (!c.env.ANTHROPIC_API_KEY || !c.env.AI_GATEWAY_URL) {
    return c.json({ error: 'AI 履歷優化功能目前維護中，請稍後再試' }, 503)
  }

  const body = await c.req.json<ResumeRequest>()

  if (!body.input?.trim()) {
    return c.json({ error: '請輸入履歷內容' }, 400)
  }

  const inputLength = body.input.trim().length
  if (inputLength < RESUME_MIN_CHARS) {
    return c.json({ error: `履歷內容至少需要 ${RESUME_MIN_CHARS} 字（目前 ${inputLength} 字）` }, 400)
  }
  if (inputLength > RESUME_MAX_CHARS) {
    return c.json({ error: `履歷內容不得超過 ${RESUME_MAX_CHARS} 字（目前 ${inputLength} 字）` }, 400)
  }

  // Check subscription
  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  const isPro = sub?.plan === 'pro' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())

  // Check tool-specific quota for free users
  const today = new Date().toISOString().split('T')[0]
  const toolUsage = await c.env.DB
    .prepare('SELECT count FROM tool_daily_usage WHERE user_id = ? AND tool_name = ? AND date = ? LIMIT 1')
    .bind(userId, 'resume-optimize', today)
    .first<{ count: number }>()

  const resumeToday = toolUsage?.count ?? 0

  if (!isPro && resumeToday >= FREE_RESUME_DAILY_LIMIT) {
    return c.json({
      error: 'resume_quota_exceeded',
      message: `今日免費履歷優化次數已用完（${resumeToday}/${FREE_RESUME_DAILY_LIMIT}）`,
      upgradeUrl: '/pricing',
      usage: { resumeToday, resumeLimit: FREE_RESUME_DAILY_LIMIT },
    }, 429)
  }

  // Record tool run (usage incremented after successful AI call — see below)
  let toolRunId: string | undefined
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO tool_runs (user_id, tool_name, input, status) VALUES (?, 'resume-optimize', ?, 'running') RETURNING id`,
    )
      .bind(userId, body.input.slice(0, 1000))
      .first<{ id: string }>()
    toolRunId = result?.id
  } catch {
    // Non-fatal
  }

  try {
    const userPrompt = buildUserPrompt(body.input, body.options?.targetPosition)

    type AnthropicResponse = {
      content: Array<{ type: string; text?: string }>
    }

    const fetchResponse = await executeWithRetry(
      async (signal) => {
        return callExternalAI(
          c.env.AI_GATEWAY_URL!,
          'anthropic',
          '/v1/messages',
          {
            model: CLAUDE_HAIKU_MODEL,
            max_tokens: 2048,
            temperature: 0.3,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          },
          c.env.ANTHROPIC_API_KEY!,
          {
            'x-api-key': c.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          signal,
        )
      },
      { timeoutMs: AI_REQUEST_TIMEOUT_MS, maxAttempts: AI_MAX_ATTEMPTS },
    )

    if (!fetchResponse.ok) {
      const errText = await fetchResponse.text().catch(() => fetchResponse.statusText)
      throw new Error(`Anthropic API error ${fetchResponse.status}: ${errText}`)
    }

    const res = (await fetchResponse.json()) as AnthropicResponse

    const rawOutput = res.content
      ?.filter((b: { type: string; text?: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => b.text)
      .join('') ?? ''

    const { output, suggestions } = parseResponse(rawOutput)

    // Increment tool-specific + global usage AFTER successful AI call
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO tool_daily_usage (user_id, tool_name, date, count) VALUES (?, 'resume-optimize', ?, 1)
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
          .bind(output.slice(0, 5000), toolRunId)
          .run()
      }
    } catch {
      // Non-fatal
    }

    // Get updated usage for response
    const updatedToolUsage = await c.env.DB
      .prepare('SELECT count FROM tool_daily_usage WHERE user_id = ? AND tool_name = ? AND date = ? LIMIT 1')
      .bind(userId, 'resume-optimize', today)
      .first<{ count: number }>()

    const globalUsage = await c.env.DB
      .prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ? LIMIT 1')
      .bind(userId, today)
      .first<{ count: number }>()

    return c.json({
      output,
      suggestions,
      tool_run_id: toolRunId,
      tool: 'resume-optimize',
      usage: {
        resumeToday: updatedToolUsage?.count ?? resumeToday + 1,
        resumeLimit: isPro ? null : FREE_RESUME_DAILY_LIMIT,
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

    console.error('resume.ai_error', {
      toolRunId: toolRunId ?? null,
      message: err instanceof Error ? err.message : String(err),
    })

    return c.json({ error: '履歷優化暫時無法使用，請稍後再試' }, 500)
  }
})

export default resume
