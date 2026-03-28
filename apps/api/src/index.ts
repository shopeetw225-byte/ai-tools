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
  ECPAY_MERCHANT_ID?: string
  ECPAY_HASH_KEY?: string
  ECPAY_HASH_IV?: string
  /** Required for AI Gateway Analytics API — set via: wrangler secret put CLOUDFLARE_API_TOKEN */
  CLOUDFLARE_API_TOKEN?: string
  /** Comma-separated user IDs allowed to access admin endpoints (analytics). */
  ADMIN_USER_IDS?: string
  /** Comma-separated allowed CORS origins for production. */
  ALLOWED_ORIGINS?: string
}

const app = new Hono<{ Bindings: Env }>()

function pickLanguageFromAcceptLanguage(header: string | null): 'zh-TW' | 'zh-CN' {
  if (!header) return 'zh-TW'

  const normalized = header.toLowerCase()
  if (normalized.includes('zh-cn') || normalized.includes('zh-hans')) {
    return 'zh-CN'
  }

  return 'zh-TW'
}

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', secureHeaders())
app.use('/api/*', cors({
  origin: (origin, c) => {
    const env = (c as unknown as { env: Env }).env?.ENVIRONMENT
    // In production, only allow same-origin or explicitly configured origins
    if (env === 'production') {
      const allowed = ((c as unknown as { env: Env }).env?.ALLOWED_ORIGINS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
      if (allowed.length > 0 && allowed.includes(origin)) return origin
      // Reject unknown origins in production
      return ''
    }
    // Development: allow all origins for local testing
    return origin
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/', (c) => {
  const language = pickLanguageFromAcceptLanguage(c.req.header('Accept-Language') ?? null)
  return c.redirect(`/${language}/`, 302)
})

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }))

// ─── API routes ───────────────────────────────────────────────────────────────
import chatRoute from './routes/chat'
import toolsRoute from './routes/tools'
import conversationsRoute from './routes/conversations'
import authRoute from './routes/auth'
import analyticsRoute from './routes/analytics'
import paymentsRoute from './routes/payments'
import usageRoute from './routes/usage'
import resumeRoute from './routes/resume'
import grammarRoute from './routes/grammar'
import trialRoute from './routes/trial'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'
import { usageQuotaMiddleware } from './middleware/usage-quota'

// Auth routes (public — no auth required)
app.route('/api/v1/auth', authRoute)

// Protected routes — require valid session
app.use('/api/v1/chat/*', authMiddleware)
app.use('/api/v1/models', authMiddleware)
app.use('/api/v1/tools/*', authMiddleware)
app.use('/api/v1/conversations/*', authMiddleware)
app.use('/api/v1/analytics/*', authMiddleware)
app.use('/api/v1/usage/*', authMiddleware)
app.use('/api/v1/trial/*', authMiddleware)
// ECPay callbacks are public: /ecpay/return (server webhook) and /ecpay/result (browser redirect)
app.use('/api/v1/payments/*', async (c, next) => {
  const path = c.req.path
  if (path === '/api/v1/payments/ecpay/return' || path === '/api/v1/payments/ecpay/result') {
    return next()
  }
  return authMiddleware(c, next)
})

// Rate limiting applied to AI inference routes
app.use('/api/v1/chat/*', rateLimitMiddleware)
app.use('/api/v1/tools/*', rateLimitMiddleware)

// Usage quota applied to AI inference routes (after auth, before handler)
// resume-optimize handles its own global + tool quota to avoid double-counting
app.use('/api/v1/chat/*', usageQuotaMiddleware)
app.use('/api/v1/tools/*', async (c, next) => {
  if (c.req.path.startsWith('/api/v1/tools/resume-optimize')) return next()
  if (c.req.path.startsWith('/api/v1/tools/grammar-check')) return next()
  return usageQuotaMiddleware(c, next)
})

app.route('/api/v1/chat', chatRoute)
// Alias: GET /api/v1/models proxies to the chat route's /models handler
app.get('/api/v1/models', async (c) => {
  const models = [
    { id: 'workers-ai', name: 'Llama 3.1 8B', provider: 'workers-ai', available: true },
    { id: 'claude-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', available: !!c.env.ANTHROPIC_API_KEY },
    { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', available: !!c.env.ANTHROPIC_API_KEY },
  ]
  return c.json({ models })
})
app.route('/api/v1/tools/resume-optimize', resumeRoute)
app.route('/api/v1/tools/grammar-check', grammarRoute)
app.route('/api/v1/tools', toolsRoute)
app.route('/api/v1/conversations', conversationsRoute)
app.route('/api/v1/analytics', analyticsRoute)
app.route('/api/v1/payments', paymentsRoute)
app.route('/api/v1/usage', usageRoute)
app.route('/api/v1/trial', trialRoute)

// ─── Error handler ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  const isDev = c.env.ENVIRONMENT !== 'production'
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message)
  if (isDev) console.error(err.stack)
  return c.json(
    { error: isDev ? err.message : 'Internal Server Error' },
    500,
  )
})

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
