import { Hono } from 'hono'
import type { Env } from '../index'

const trial = new Hono<{ Bindings: Env }>()

const TRIAL_DAYS = 7

trial.post('/start', async (c) => {
  const userId = (c.get('userId' as never) as string | undefined)?.trim()
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at, trial_started_at, trial_used FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null; trial_started_at: string | null; trial_used: number }>()

  // Check if trial already used (lifetime once)
  if (sub?.trial_used === 1) {
    return c.json({ error: 'trial_already_used', message: '每個帳號只能免費試用一次' }, 403)
  }

  // Check if user already has an active Pro subscription
  if (sub?.plan === 'pro' && sub.expires_at && new Date(sub.expires_at) >= new Date()) {
    return c.json({ error: 'already_pro', message: '您已經是 Pro 用戶，無需試用' }, 409)
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const trialStartedAt = now.toISOString()

  await c.env.DB
    .prepare(
      `INSERT INTO subscriptions (user_id, plan, expires_at, trial_started_at, trial_used, updated_at)
       VALUES (?, 'pro', ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         plan = 'pro',
         expires_at = ?,
         trial_started_at = ?,
         trial_used = 1,
         updated_at = datetime('now')`,
    )
    .bind(userId, expiresAt, trialStartedAt, expiresAt, trialStartedAt)
    .run()

  return c.json({
    plan: 'pro',
    isTrial: true,
    trialExpiresAt: expiresAt,
    trialDaysRemaining: TRIAL_DAYS,
  })
})

export default trial
