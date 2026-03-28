import { Hono } from 'hono'
import type { Env } from '../index'
import {
  buildEcpayCreateOrderPayload,
  formatMerchantTradeDate,
  generateMerchantTradeNo,
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

  const merchantTradeNo = generateMerchantTradeNo()
  const merchantTradeDate = formatMerchantTradeDate(new Date())
  const returnUrl = new URL(ECPAY_RETURN_PATH, c.req.url).toString()

  const insertedOrder = await c.env.DB.prepare(
    `INSERT INTO orders (merchant_trade_no, user_id, total_amount, status, choose_payment)
     VALUES (?, ?, ?, 'pending', ?) RETURNING id`,
  )
    .bind(merchantTradeNo, userId, amount, choosePayment)
    .first<{ id: string }>()

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
    },
  )

  return c.json({
    orderId: insertedOrder.id,
    method: 'POST',
    serviceUrl: payload.serviceUrl,
    fields: payload.fields,
  })
})

export default payments
