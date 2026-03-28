import { Hono } from 'hono'
import type { Env } from '../index'
import {
  buildEcpayCreateOrderPayload,
  formatMerchantTradeDate,
  generateMerchantTradeNo,
  verifyCheckMacValue,
  type EcpayPaymentType,
} from '../lib/ecpay'

const payments = new Hono<{ Bindings: Env }>()

const ALLOWED_PAYMENT_TYPES = new Set<EcpayPaymentType>([
  'ALL',
  'Credit',
  'ATM',
  'CVS',
  'BARCODE',
])

const ECPAY_STAGE_URL = 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
const ECPAY_PROD_URL = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
const ECPAY_RETURN_PATH = '/api/v1/payments/ecpay/return'
const ECPAY_ORDER_RESULT_PATH = '/api/v1/payments/ecpay/result'

// Webhook rate limit: 60 req/min per IP
const WEBHOOK_WINDOW_MS = 60_000
const WEBHOOK_MAX_REQUESTS = 60

async function applyWebhookRateLimit(c: { req: { header(n: string): string | undefined }; env: Env }): Promise<boolean> {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const bucket = Math.floor(Date.now() / WEBHOOK_WINDOW_MS)
  const key = `rl:webhook:${ip}:${bucket}`

  try {
    const current = await c.env.KV.get(key)
    const count = current ? parseInt(current, 10) : 0
    if (count >= WEBHOOK_MAX_REQUESTS) return false
    await c.env.KV.put(key, String(count + 1), { expirationTtl: 120 })
  } catch {
    // Non-fatal: allow if KV unavailable
  }

  return true
}

// ─── Public ECPay callbacks (no auth required) ────────────────────────────────

// ReturnURL: ECPay server-to-server callback after payment
payments.post('/ecpay/return', async (c) => {
  const allowed = await applyWebhookRateLimit(c as never)
  if (!allowed) return c.text('0|Rate limit exceeded', 429)

  if (!c.env.ECPAY_HASH_KEY || !c.env.ECPAY_HASH_IV) {
    return c.text('0|ECPay secrets not configured', 500)
  }

  const formData = await c.req.parseBody()
  const payload: Record<string, string> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') payload[key] = value
  }

  const merchantTradeNo = payload['MerchantTradeNo']
  if (!merchantTradeNo || !payload['CheckMacValue']) {
    return c.text('0|Missing required fields', 400)
  }

  const valid = await verifyCheckMacValue(payload, {
    hashKey: c.env.ECPAY_HASH_KEY,
    hashIv: c.env.ECPAY_HASH_IV,
  })

  if (!valid) {
    return c.text('0|CheckMacValue invalid', 400)
  }

  const rtnCode = parseInt(payload['RtnCode'] ?? '0', 10)
  const tradeNo = payload['TradeNo'] ?? ''

  // Idempotency: check if this exact notification already processed
  const existing = await c.env.DB
    .prepare('SELECT id FROM payment_notifications WHERE merchant_trade_no = ? AND trade_no = ? AND rtn_code = ? LIMIT 1')
    .bind(merchantTradeNo, tradeNo, rtnCode)
    .first<{ id: string }>()

  if (existing) {
    return c.text('1|OK')
  }

  // Insert payment_notification record
  await c.env.DB
    .prepare(
      `INSERT INTO payment_notifications
         (merchant_trade_no, trade_no, rtn_code, rtn_msg, payment_type, trade_amt, raw_payload, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      merchantTradeNo,
      tradeNo,
      rtnCode,
      payload['RtnMsg'] ?? null,
      payload['PaymentType'] ?? null,
      payload['TradeAmt'] ? parseInt(payload['TradeAmt'], 10) : null,
      JSON.stringify(payload),
    )
    .run()

  // Update order status (only transition from pending)
  const newStatus = rtnCode === 1 ? 'paid' : 'failed'
  const updateResult = await c.env.DB
    .prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now')
       WHERE merchant_trade_no = ? AND status = 'pending'`,
    )
    .bind(newStatus, merchantTradeNo)
    .run()

  // If payment succeeded, upsert subscription to pro
  if (rtnCode === 1 && (updateResult.meta?.changes ?? 0) > 0) {
    const order = await c.env.DB
      .prepare('SELECT user_id FROM orders WHERE merchant_trade_no = ? LIMIT 1')
      .bind(merchantTradeNo)
      .first<{ user_id: string }>()

    if (order) {
      // Pro subscription: 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await c.env.DB
        .prepare(
          `INSERT INTO subscriptions (user_id, plan, expires_at, updated_at)
           VALUES (?, 'pro', ?, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET plan = 'pro', expires_at = ?, updated_at = datetime('now')`,
        )
        .bind(order.user_id, expiresAt, expiresAt)
        .run()
    }
  }

  return c.text('1|OK')
})

// OrderResultURL: browser redirect from ECPay (POST with result data)
// Verifies CheckMacValue signature, then redirects to frontend result page
payments.post('/ecpay/result', async (c) => {
  if (!c.env.ECPAY_HASH_KEY || !c.env.ECPAY_HASH_IV) {
    return c.redirect('/zh-TW/payment/result?status=error', 302)
  }

  const formData = await c.req.parseBody()
  const payload: Record<string, string> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') payload[key] = value
  }

  const merchantTradeNo = payload['MerchantTradeNo']
  if (!merchantTradeNo || !payload['CheckMacValue']) {
    return c.redirect('/zh-TW/payment/result?status=error', 302)
  }

  const valid = await verifyCheckMacValue(payload, {
    hashKey: c.env.ECPAY_HASH_KEY,
    hashIv: c.env.ECPAY_HASH_IV,
  })

  if (!valid) {
    return c.redirect('/zh-TW/payment/result?status=error', 302)
  }

  // Verify CheckMacValue to prevent forged redirects
  if (c.env.ECPAY_HASH_KEY && c.env.ECPAY_HASH_IV && payload['CheckMacValue']) {
    const valid = await verifyCheckMacValue(payload, {
      hashKey: c.env.ECPAY_HASH_KEY,
      hashIv: c.env.ECPAY_HASH_IV,
    })
    if (!valid) {
      return c.redirect('/zh-TW/payment/result?status=error', 302)
    }
  }

  const order = await c.env.DB
    .prepare('SELECT id, status FROM orders WHERE merchant_trade_no = ? LIMIT 1')
    .bind(merchantTradeNo)
    .first<{ id: string; status: string }>()

  if (!order) {
    return c.redirect('/zh-TW/payment/result?status=error', 302)
  }

  const uiStatus = order.status === 'paid' ? 'success' : order.status === 'failed' ? 'failed' : 'pending'
  return c.redirect(`/zh-TW/payment/result?orderId=${order.id}&status=${uiStatus}`, 302)
})

// ─── Protected routes (require auth) ─────────────────────────────────────────

payments.post('/create', async (c) => {
  const body = await c.req.json<{
    amount?: number
    itemName?: string
    choosePayment?: string
  }>()

  const amount = body.amount
  const itemName = body.itemName?.trim()
  const choosePayment = body.choosePayment as EcpayPaymentType | undefined

  if (!amount || !itemName || !choosePayment) {
    return c.json({ error: 'amount, itemName and choosePayment are required' }, 400)
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return c.json({ error: 'amount must be a positive integer' }, 400)
  }

  if (!ALLOWED_PAYMENT_TYPES.has(choosePayment)) {
    return c.json({ error: 'choosePayment is invalid' }, 400)
  }

  if (!c.env.ECPAY_MERCHANT_ID || !c.env.ECPAY_HASH_KEY || !c.env.ECPAY_HASH_IV) {
    return c.json({ error: 'ECPay secrets are not configured' }, 503)
  }

  const userId = (c.get('userId' as never) as string | undefined)?.trim()

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const merchantTradeDate = formatMerchantTradeDate(new Date())
  const returnUrl = new URL(ECPAY_RETURN_PATH, c.req.url).toString()
  const orderResultUrl = new URL(ECPAY_ORDER_RESULT_PATH, c.req.url).toString()

  let merchantTradeNo = ''
  let insertedOrder: { id: string } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    merchantTradeNo = generateMerchantTradeNo()
    try {
      insertedOrder = await c.env.DB.prepare(
        `INSERT INTO orders (merchant_trade_no, user_id, total_amount, status, choose_payment)
         VALUES (?, ?, ?, 'pending', ?) RETURNING id`,
      )
        .bind(merchantTradeNo, userId, amount, choosePayment)
        .first<{ id: string }>()
      break
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('UNIQUE') && attempt < 2) continue
      throw e
    }
  }

  if (!insertedOrder) {
    return c.json({ error: 'failed to create order' }, 500)
  }

  const payload = await buildEcpayCreateOrderPayload(
    {
      merchantId: c.env.ECPAY_MERCHANT_ID,
      hashKey: c.env.ECPAY_HASH_KEY,
      hashIv: c.env.ECPAY_HASH_IV,
      serviceUrl: c.env.ENVIRONMENT === 'production' ? ECPAY_PROD_URL : ECPAY_STAGE_URL,
    },
    {
      merchantTradeNo,
      merchantTradeDate,
      totalAmount: amount,
      itemName,
      choosePayment,
      returnUrl,
      orderResultUrl,
    },
  )

  return c.json({
    orderId: insertedOrder.id,
    method: 'POST',
    serviceUrl: payload.serviceUrl,
    fields: payload.fields,
  })
})

payments.get('/orders/:id', async (c) => {
  const userId = (c.get('userId' as never) as string | undefined)?.trim()
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const orderId = c.req.param('id')
  const order = await c.env.DB
    .prepare(
      'SELECT id, merchant_trade_no, total_amount, status, choose_payment, created_at, updated_at FROM orders WHERE id = ? AND user_id = ?',
    )
    .bind(orderId, userId)
    .first<{
      id: string
      merchant_trade_no: string
      total_amount: number
      status: string
      choose_payment: string
      created_at: string
      updated_at: string
    }>()

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  return c.json(order)
})

// ─── Subscription status ──────────────────────────────────────────────────────

payments.get('/subscription', async (c) => {
  const userId = (c.get('userId' as never) as string | undefined)?.trim()
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  if (!sub) {
    return c.json({ plan: 'free', expiresAt: null })
  }

  // Check if pro subscription has expired
  if (sub.plan === 'pro' && sub.expires_at && new Date(sub.expires_at) < new Date()) {
    await c.env.DB
      .prepare(`UPDATE subscriptions SET plan = 'free', expires_at = NULL, updated_at = datetime('now') WHERE user_id = ?`)
      .bind(userId)
      .run()
    return c.json({ plan: 'free', expiresAt: null })
  }

  return c.json({ plan: sub.plan, expiresAt: sub.expires_at })
})

// ─── Usage status ─────────────────────────────────────────────────────────────

payments.get('/usage', async (c) => {
  const userId = (c.get('userId' as never) as string | undefined)?.trim()
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const today = new Date().toISOString().split('T')[0]
  const usage = await c.env.DB
    .prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ? LIMIT 1')
    .bind(userId, today)
    .first<{ count: number }>()

  const sub = await c.env.DB
    .prepare('SELECT plan, expires_at FROM subscriptions WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ plan: string; expires_at: string | null }>()

  const isPro = sub?.plan === 'pro' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())
  const count = usage?.count ?? 0
  const limit = isPro ? null : 10

  return c.json({ count, limit, plan: isPro ? 'pro' : 'free' })
})

export default payments
