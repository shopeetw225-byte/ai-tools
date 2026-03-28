import { expect, test } from '@playwright/test'
import { loginTestUser } from './helpers'

const API_URL = 'http://localhost:8787'

/**
 * ECPay webhook E2E tests — validates the server-to-server callback
 * and browser result redirect flows.
 */
test.describe('ECPay webhook & result flow', () => {
  test.describe('POST /api/v1/payments/ecpay/return (server webhook)', () => {
    test('rejects request with missing MerchantTradeNo', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/return`, {
        form: { RtnCode: '1', CheckMacValue: 'AAAA' },
      })
      expect(res.status()).toBe(400)
      const text = await res.text()
      expect(text).toContain('Missing required fields')
    })

    test('rejects request with missing CheckMacValue', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/return`, {
        form: { MerchantTradeNo: 'DX202603281200000001', RtnCode: '1' },
      })
      expect(res.status()).toBe(400)
      const text = await res.text()
      expect(text).toContain('Missing required fields')
    })

    test('rejects request with invalid CheckMacValue', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/return`, {
        form: {
          MerchantTradeNo: 'DX202603281200000001',
          RtnCode: '1',
          TradeNo: '2026032812345678',
          CheckMacValue: 'INVALID_MAC_VALUE_0000000000000000000000000000000000000000',
        },
      })
      expect(res.status()).toBe(400)
      const text = await res.text()
      expect(text).toContain('CheckMacValue invalid')
    })

    test('webhook endpoint is publicly accessible (no auth required)', async ({ request }) => {
      // Should NOT return 401 — ECPay webhooks have no bearer token
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/return`, {
        form: { MerchantTradeNo: 'DX202603281200000001' },
      })
      // 400 (missing fields) is expected, NOT 401
      expect(res.status()).not.toBe(401)
    })
  })

  test.describe('POST /api/v1/payments/ecpay/result (browser redirect)', () => {
    test('redirects to error page when MerchantTradeNo is missing', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/result`, {
        form: {},
        maxRedirects: 0,
      })
      expect(res.status()).toBe(302)
      expect(res.headers()['location']).toContain('/payment/result?status=error')
    })

    test('redirects to error page for unknown MerchantTradeNo', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/result`, {
        form: { MerchantTradeNo: 'DX999999999999999999' },
        maxRedirects: 0,
      })
      expect(res.status()).toBe(302)
      expect(res.headers()['location']).toContain('/payment/result?status=error')
    })

    test('result endpoint is publicly accessible (no auth required)', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/ecpay/result`, {
        form: {},
        maxRedirects: 0,
      })
      expect(res.status()).not.toBe(401)
    })
  })

  test.describe('GET /api/v1/payments/orders/:id', () => {
    test('rejects unauthenticated order query', async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/payments/orders/fake-id`)
      expect(res.status()).toBe(401)
    })

    test('returns 404 for non-existent order', async ({ page, request }) => {
      await loginTestUser(page)
      const sessionId = await page.evaluate(() => localStorage.getItem('session'))

      const res = await request.get(
        `${API_URL}/api/v1/payments/orders/00000000-0000-0000-0000-000000000000`,
        { headers: { Authorization: `Bearer ${sessionId}` } },
      )
      expect(res.status()).toBe(404)
    })

    test('returns order after creation', async ({ page, request }) => {
      await loginTestUser(page)
      const sessionId = await page.evaluate(() => localStorage.getItem('session'))

      // Create an order first
      const createRes = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 800, itemName: '訂單查詢測試', choosePayment: 'Credit' },
      })
      expect(createRes.status()).toBe(200)
      const { orderId } = await createRes.json()

      // Query the order
      const orderRes = await request.get(`${API_URL}/api/v1/payments/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      })
      expect(orderRes.status()).toBe(200)
      const order = await orderRes.json()
      expect(order.id).toBe(orderId)
      expect(order.status).toBe('pending')
      expect(order.total_amount).toBe(800)
      expect(order.choose_payment).toBe('Credit')
    })

    test('user cannot access another user\'s order', async ({ page, request, browser }) => {
      // Create order with user A
      await loginTestUser(page, 'user-a-orders@test.local')
      const sessionA = await page.evaluate(() => localStorage.getItem('session'))

      const createRes = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionA}` },
        data: { amount: 100, itemName: '隔離測試', choosePayment: 'ATM' },
      })
      const { orderId } = await createRes.json()

      // Try to access with user B
      const context = await browser.newContext()
      const pageB = await context.newPage()
      await loginTestUser(pageB, 'user-b-orders@test.local')
      const sessionB = await pageB.evaluate(() => localStorage.getItem('session'))

      const res = await request.get(`${API_URL}/api/v1/payments/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${sessionB}` },
      })
      expect(res.status()).toBe(404) // Should not find another user's order
      await context.close()
    })
  })
})
