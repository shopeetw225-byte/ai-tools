import type { Context, Next } from 'hono'
import type { Env } from '../index'

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20 // per IP per minute for AI routes

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
) {
  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For') ??
    'unknown'
  const bucket = Math.floor(Date.now() / WINDOW_MS)
  const key = `rl:${ip}:${bucket}`

  try {
    const current = await c.env.KV.get(key)
    const count = current ? parseInt(current, 10) : 0

    c.res.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS))
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - count - 1)))

    if (count >= MAX_REQUESTS) {
      return c.json(
        { error: 'Rate limit exceeded. Try again in a minute.' },
        429,
        { 'Retry-After': '60' },
      )
    }

    await c.env.KV.put(key, String(count + 1), { expirationTtl: 120 })
  } catch {
    // Non-fatal: allow request if KV is unavailable
  }

  await next()
}
