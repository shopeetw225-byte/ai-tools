import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

export type Env = {
  DB: D1Database
  KV: KVNamespace
  ASSETS?: R2Bucket
  AI: Ai
  ENVIRONMENT: string
  AI_GATEWAY_URL?: string
  ANTHROPIC_API_KEY?: string
  /** Required for AI Gateway Analytics API — set via: wrangler secret put CLOUDFLARE_API_TOKEN */
  CLOUDFLARE_API_TOKEN?: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', secureHeaders())
app.use('/api/*', cors({
  origin: (origin) => origin, // restrict in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }))

// ─── API routes ───────────────────────────────────────────────────────────────
import chatRoute from './routes/chat'
import toolsRoute from './routes/tools'
import conversationsRoute from './routes/conversations'
import authRoute from './routes/auth'
import analyticsRoute from './routes/analytics'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'

// Auth routes (public — no auth required)
app.route('/api/v1/auth', authRoute)

// Protected routes — require valid session
app.use('/api/v1/chat/*', authMiddleware)
app.use('/api/v1/tools/*', authMiddleware)
app.use('/api/v1/conversations/*', authMiddleware)
app.use('/api/v1/analytics/*', authMiddleware)

// Rate limiting applied to AI inference routes
app.use('/api/v1/chat/*', rateLimitMiddleware)
app.use('/api/v1/tools/*', rateLimitMiddleware)

app.route('/api/v1/chat', chatRoute)
app.route('/api/v1/tools', toolsRoute)
app.route('/api/v1/conversations', conversationsRoute)
app.route('/api/v1/analytics', analyticsRoute)

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
