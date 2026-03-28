import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../index'
import paymentsRoute from './payments'

function createDbMock() {
  const first = vi
    .fn()
    .mockResolvedValueOnce({ id: 'order-1' })

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
