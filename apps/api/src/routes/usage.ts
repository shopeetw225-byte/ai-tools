import { Hono } from 'hono'
import type { Env } from '../index'

const FREE_DAILY_LIMIT = 10

const usage = new Hono<{ Bindings: Env }>()

usage.get('/today', async (c) => {
  const userId = c.get('userId' as never) as string

  // Check subscription status
  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  const isPro = sub?.plan === 'pro' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())

  // Get today's usage count
  const today = new Date().toISOString().split('T')[0]
  const row = await c.env.DB
    .prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ? LIMIT 1')
    .bind(userId, today)
    .first<{ count: number }>()

  return c.json({
    used: row?.count ?? 0,
    limit: FREE_DAILY_LIMIT,
    isPro,
  })
})

export default usage
