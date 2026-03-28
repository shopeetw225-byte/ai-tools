import { expect, test } from '@playwright/test'
import { loginTestUser } from './helpers'

const API_URL = 'http://localhost:8787'

test.describe('ECPay checkout flow', () => {
  test.describe('POST /api/v1/payments/create', () => {
    test('rejects unauthenticated requests', async ({ request }) => {
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        data: { amount: 100, itemName: 'Test', choosePayment: 'Credit' },
      })
      expect(res.status()).toBe(401)
    })

    test('rejects invalid amount (zero)', async ({ page, request }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 0, itemName: 'Test', choosePayment: 'Credit' },
      })
      expect(res.status()).toBe(400)
    })

    test('rejects invalid payment type', async ({ page, request }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 100, itemName: 'Test', choosePayment: 'Bitcoin' },
      })
      expect(res.status()).toBe(400)
    })

    test('creates order with Credit payment and returns ECPay form data', async ({
      page,
      request,
    }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: {
          amount: 1200,
          itemName: 'AI 工具訂閱',
          choosePayment: 'Credit',
        },
      })

      expect(res.status()).toBe(200)
      const body = await res.json()

      expect(body.orderId).toBeTruthy()
      expect(body.method).toBe('POST')
      expect(body.serviceUrl).toContain('ecpay.com.tw')
      expect(body.fields).toMatchObject({
        MerchantID: expect.any(String),
        MerchantTradeNo: expect.stringMatching(/^DX\d{18}$/),
        PaymentType: 'aio',
        TotalAmount: 1200,
        ItemName: 'AI 工具訂閱',
        ChoosePayment: 'Credit',
        EncryptType: 1,
      })
      expect(body.fields.CheckMacValue).toMatch(/^[A-F0-9]{64}$/)
    })

    test('creates order with ATM payment', async ({ page, request }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 500, itemName: 'ATM 付款測試', choosePayment: 'ATM' },
      })

      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.fields.ChoosePayment).toBe('ATM')
    })

    test('creates order with CVS (convenience store) payment', async ({ page, request }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 300, itemName: '超商代碼測試', choosePayment: 'CVS' },
      })

      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.fields.ChoosePayment).toBe('CVS')
    })
  })

  test.describe('ECPay CheckMacValue security', () => {
    test('returned CheckMacValue is 64-char uppercase hex (SHA256)', async ({
      page,
      request,
    }) => {
      await loginTestUser(page)

      const sessionId = await page.evaluate(() => localStorage.getItem('session'))
      const res = await request.post(`${API_URL}/api/v1/payments/create`, {
        headers: { Authorization: `Bearer ${sessionId}` },
        data: { amount: 100, itemName: 'MAC Test', choosePayment: 'Credit' },
      })

      const body = await res.json()
      // SHA256 output = 64 hex characters
      expect(body.fields.CheckMacValue).toHaveLength(64)
      expect(body.fields.CheckMacValue).toMatch(/^[A-F0-9]+$/)
    })
  })
})
