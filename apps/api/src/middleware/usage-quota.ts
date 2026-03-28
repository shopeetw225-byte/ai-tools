import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'

const FREE_DAILY_LIMIT = 10

export const usageQuotaMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const userId = c.get('userId' as never) as string | undefined
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Check subscription status
  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  const isPro = sub?.plan === 'pro' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())

  // Pro users: no limit
  if (isPro) {
    await incrementUsage(c.env.DB, userId)
    await next()
    return
  }

  // Free users: check daily limit
  const today = new Date().toISOString().split('T')[0]
  const usage = await c.env.DB
    .prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ? LIMIT 1')
    .bind(userId, today)
    .first<{ count: number }>()

  const currentCount = usage?.count ?? 0

  if (currentCount >= FREE_DAILY_LIMIT) {
    return c.json({
      error: 'quota_exceeded',
      message: `Daily free limit of ${FREE_DAILY_LIMIT} reached`,
      upgradeUrl: '/pricing',
      usage: { count: currentCount, limit: FREE_DAILY_LIMIT },
    }, 429)
  }

  await incrementUsage(c.env.DB, userId)
  await next()
})

async function incrementUsage(db: D1Database, userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  await db
    .prepare(
      `INSERT INTO daily_usage (user_id, date, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1`,
    )
    .bind(userId, today)
    .run()
}
