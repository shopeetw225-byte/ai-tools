import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../index'
import paymentsRoute from './payments'
import { generateCheckMacValue } from '../lib/ecpay'

function createDbMock() {
  const first = vi
    .fn()
    .mockResolvedValueOnce({ id: 'order-1' }) // INSERT orders RETURNING id

  const run = vi.fn().mockResolvedValue({ success: true })

  const bind = vi.fn(() => ({
    first,
    run,
  }))

  const prepare = vi.fn(() => ({
    bind,
  }))

  return {
    db: { prepare } as unknown as D1Database,
    spies: { prepare, bind, first, run },
  }
}

function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>()
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1' as never)
    await next()
  })
  app.route('/', paymentsRoute)
  return app
}

describe('POST /create payments route', () => {
  it('returns 400 when required fields are missing', async () => {
    const { db } = createDbMock()
    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_MERCHANT_ID: '2000132',
      ECPAY_HASH_KEY: '5294y06JbISpM5x9',
      ECPAY_HASH_IV: 'v77hoKGq4kWxNNIS',
    } satisfies Env
    const app = createApp(env)

    const res = await app.request(
      new Request('http://localhost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 }),
      }),
      {},
      env,
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'amount, itemName and choosePayment are required',
    })
  })

  it('creates an order and returns ECPay form data', async () => {
    const { db, spies } = createDbMock()
    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_MERCHANT_ID: '2000132',
      ECPAY_HASH_KEY: '5294y06JbISpM5x9',
      ECPAY_HASH_IV: 'v77hoKGq4kWxNNIS',
    } satisfies Env
    const app = createApp(env)

    const res = await app.request(
      new Request('http://localhost/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1200,
          itemName: 'AI 工具訂閱',
          choosePayment: 'Credit',
        }),
      }),
      {},
      env,
    )

    expect(res.status).toBe(200)
    const body = await res.json() as {
      serviceUrl: string
      method: string
      fields: {
        MerchantID: string
        ChoosePayment: string
        ItemName: string
        CheckMacValue: string
      }
    }

    expect(body.serviceUrl).toBe('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5')
    expect(body.method).toBe('POST')
    expect(body.fields.MerchantID).toBe('2000132')
    expect(body.fields.ChoosePayment).toBe('Credit')
    expect(body.fields.ItemName).toBe('AI 工具訂閱')
    expect(body.fields.CheckMacValue).toMatch(/^[A-F0-9]{64}$/)
    expect(spies.prepare).toHaveBeenCalled()
  })
})

// ─── ECPay Webhook Tests ────────────────────────────────────────────────────

function createWebhookApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>()
  // No auth middleware for webhook routes
  app.route('/', paymentsRoute)
  return app
}

function createWebhookDbMock(opts?: { existingNotification?: boolean }) {
  const firstFn = vi.fn()
  if (opts?.existingNotification) {
    firstFn.mockResolvedValue({ id: 'notif-1' })
  } else {
    firstFn.mockResolvedValue(null)
  }

  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })

  const bind = vi.fn(() => ({
    first: firstFn,
    run,
  }))

  const prepare = vi.fn(() => ({
    bind,
  }))

  return {
    db: { prepare } as unknown as D1Database,
    spies: { prepare, bind, first: firstFn, run },
  }
}

const HASH_KEY = '5294y06JbISpM5x9'
const HASH_IV = 'v77hoKGq4kWxNNIS'

async function buildWebhookBody(fields: Record<string, string | number>) {
  const mac = await generateCheckMacValue(fields, { hashKey: HASH_KEY, hashIv: HASH_IV })
  const allFields = { ...fields, CheckMacValue: mac }
  return new URLSearchParams(
    Object.entries(allFields).map(([k, v]) => [k, String(v)]),
  ).toString()
}

describe('POST /ecpay/return webhook', () => {
  it('returns 1|OK on valid notification and updates order', async () => {
    const { db, spies } = createWebhookDbMock()
    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const webhookFields: Record<string, string | number> = {
      MerchantTradeNo: 'DX202603281200000001',
      TradeNo: '2403281234567',
      RtnCode: 1,
      RtnMsg: 'Succeeded',
      PaymentType: 'Credit_CreditCard',
      TradeAmt: 1200,
      MerchantID: '2000132',
    }
    const body = await buildWebhookBody(webhookFields)

    const res = await app.request(
      new Request('http://localhost/ecpay/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
      {},
      env,
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('1|OK')
    // prepare calls: check existing, insert notification, update order, select user_id for subscription
    expect(spies.prepare).toHaveBeenCalledTimes(4)
  })

  it('rejects invalid CheckMacValue', async () => {
    const { db } = createWebhookDbMock()
    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const body = new URLSearchParams({
      MerchantTradeNo: 'DX202603281200000001',
      TradeNo: '2403281234567',
      RtnCode: '1',
      RtnMsg: 'Succeeded',
      PaymentType: 'Credit_CreditCard',
      TradeAmt: '1200',
      CheckMacValue: 'INVALID_MAC_VALUE_HERE',
    }).toString()

    const res = await app.request(
      new Request('http://localhost/ecpay/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
      {},
      env,
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('0|CheckMacValue invalid')
  })

  it('handles duplicate notifications idempotently', async () => {
    const { db, spies } = createWebhookDbMock({ existingNotification: true })
    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const webhookFields: Record<string, string | number> = {
      MerchantTradeNo: 'DX202603281200000001',
      TradeNo: '2403281234567',
      RtnCode: 1,
      RtnMsg: 'Succeeded',
      PaymentType: 'Credit_CreditCard',
      TradeAmt: 1200,
      MerchantID: '2000132',
    }
    const body = await buildWebhookBody(webhookFields)

    const res = await app.request(
      new Request('http://localhost/ecpay/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
      {},
      env,
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('1|OK')
    // Should only check existing — no insert or update
    expect(spies.prepare).toHaveBeenCalledTimes(1)
  })
})

describe('POST /ecpay/result (browser redirect)', () => {
  it('redirects to success page for paid order with valid signature', async () => {
    const firstFn = vi.fn().mockResolvedValue({ id: 'order-1', status: 'paid' })
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const body = await buildWebhookBody({
      MerchantTradeNo: 'DX202603281200000001',
      RtnCode: 1,
      RtnMsg: 'Succeeded',
      TradeNo: '2403281234567',
    })

    const res = await app.request(
      new Request('http://localhost/ecpay/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      }),
      {},
      env,
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('status=success')
  })

  it('redirects to error page for unknown order with valid signature', async () => {
    const firstFn = vi.fn().mockResolvedValue(null)
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const body = await buildWebhookBody({
      MerchantTradeNo: 'NONEXISTENT',
      RtnCode: 1,
    })

    const res = await app.request(
      new Request('http://localhost/ecpay/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      }),
      {},
      env,
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('status=error')
  })

  it('redirects to error page when CheckMacValue is missing', async () => {
    const firstFn = vi.fn().mockResolvedValue({ id: 'order-1', status: 'paid' })
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const body = new URLSearchParams({
      MerchantTradeNo: 'DX202603281200000001',
    }).toString()

    const res = await app.request(
      new Request('http://localhost/ecpay/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      }),
      {},
      env,
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('status=error')
    // DB should NOT be queried — request rejected before DB access
    expect(prepare).not.toHaveBeenCalled()
  })

  it('redirects to error page when CheckMacValue is invalid', async () => {
    const firstFn = vi.fn().mockResolvedValue({ id: 'order-1', status: 'paid' })
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
      ECPAY_HASH_KEY: HASH_KEY,
      ECPAY_HASH_IV: HASH_IV,
    } satisfies Env
    const app = createWebhookApp(env)

    const body = new URLSearchParams({
      MerchantTradeNo: 'DX202603281200000001',
      CheckMacValue: 'FORGED_SIGNATURE_VALUE_HERE',
    }).toString()

    const res = await app.request(
      new Request('http://localhost/ecpay/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        redirect: 'manual',
      }),
      {},
      env,
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('status=error')
    // DB should NOT be queried — request rejected before DB access
    expect(prepare).not.toHaveBeenCalled()
  })
})

describe('GET /orders/:id', () => {
  it('returns order details for authenticated user', async () => {
    const firstFn = vi.fn().mockResolvedValue({
      id: 'order-1',
      merchant_trade_no: 'DX202603281200000001',
      total_amount: 1200,
      status: 'paid',
      choose_payment: 'Credit',
      created_at: '2026-03-28 12:00:00',
      updated_at: '2026-03-28 12:05:00',
    })
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    // Use createApp which sets userId
    const app = createApp(env)

    const res = await app.request(
      new Request('http://localhost/orders/order-1'),
      {},
      env,
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; total_amount: number }
    expect(body.status).toBe('paid')
    expect(body.total_amount).toBe(1200)
  })

  it('returns 404 for unknown order', async () => {
    const firstFn = vi.fn().mockResolvedValue(null)
    const bind = vi.fn(() => ({ first: firstFn, run: vi.fn() }))
    const prepare = vi.fn(() => ({ bind }))
    const db = { prepare } as unknown as D1Database

    const env = {
      DB: db,
      KV: {} as KVNamespace,
      AI: {} as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    const app = createApp(env)

    const res = await app.request(
      new Request('http://localhost/orders/nonexistent'),
      {},
      env,
    )

    expect(res.status).toBe(404)
  })
})
