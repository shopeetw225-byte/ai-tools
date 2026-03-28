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
  origin: (origin) => origin, // restrict in production
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
import { rateLimitMiddleware } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'
import { usageQuotaMiddleware } from './middleware/usage-quota'

// Auth routes (public — no auth required)
app.route('/api/v1/auth', authRoute)

// Protected routes — require valid session
app.use('/api/v1/chat/*', authMiddleware)
app.use('/api/v1/tools/*', authMiddleware)
app.use('/api/v1/conversations/*', authMiddleware)
app.use('/api/v1/analytics/*', authMiddleware)
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
app.use('/api/v1/chat/*', usageQuotaMiddleware)
app.use('/api/v1/tools/*', usageQuotaMiddleware)

app.route('/api/v1/chat', chatRoute)
app.route('/api/v1/tools', toolsRoute)
app.route('/api/v1/conversations', conversationsRoute)
app.route('/api/v1/analytics', analyticsRoute)
app.route('/api/v1/payments', paymentsRoute)

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
