import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword, verifyPassword } from '../lib/password'

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const auth = new Hono<{ Bindings: Env }>()

// POST /api/v1/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string }>()

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const name = body.name?.trim()

  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400)
  }
  if (password.length < 8) {
    return c.json({ error: 'password must be at least 8 characters' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'invalid email format' }, 400)
  }

  // Check if email is taken
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>()
  if (existing) {
    return c.json({ error: 'email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)

  const user = await c.env.DB.prepare(
    `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id, email, name, created_at`,
  )
    .bind(email, name ?? null, passwordHash)
    .first<{ id: string; email: string; name: string | null; created_at: string }>()

  if (!user) {
    return c.json({ error: 'failed to create user' }, 500)
  }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(token, user.id, expiresAt)
    .run()

  await c.env.KV.put(
    `session:${token}`,
    JSON.stringify({ userId: user.id, email: user.email }),
    { expirationTtl: SESSION_TTL_SECONDS },
  )

  return c.json(
    { token, user: { id: user.id, email: user.email, name: user.name } },
    201,
  )
})

// POST /api/v1/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, password_hash FROM users WHERE email = ?`,
  )
    .bind(email)
    .first<{ id: string; email: string; name: string | null; password_hash: string | null }>()

  if (!user || !user.password_hash) {
    return c.json({ error: 'invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.json({ error: 'invalid email or password' }, 401)
  }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(token, user.id, expiresAt)
    .run()

  await c.env.KV.put(
    `session:${token}`,
    JSON.stringify({ userId: user.id, email: user.email }),
    { expirationTtl: SESSION_TTL_SECONDS },
  )

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// POST /api/v1/auth/logout
auth.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    await c.env.KV.delete(`session:${token}`)
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run()
  }
  return c.json({ ok: true })
})

// GET /api/v1/auth/me
auth.get('/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionData = await c.env.KV.get<{ userId: string; email: string }>(
    `session:${token}`,
    'json',
  )
  if (!sessionData) {
    return c.json({ error: 'Invalid or expired session' }, 401)
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, created_at FROM users WHERE id = ?`,
  )
    .bind(sessionData.userId)
    .first<{ id: string; email: string; name: string | null; created_at: string }>()

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({ user })
})

export default auth
