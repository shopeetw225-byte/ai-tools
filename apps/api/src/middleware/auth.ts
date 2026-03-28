import { createMiddleware } from 'hono/factory'
import type { Env } from '../index'

export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionData = await c.env.KV.get(`session:${token}`, 'json')
  if (!sessionData) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  c.set('userId' as never, (sessionData as { userId: string }).userId)
  await next()
})
