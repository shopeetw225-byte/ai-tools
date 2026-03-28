import { describe, expect, it } from 'vitest'
import {
  buildEcpayCreateOrderPayload,
  generateCheckMacValue,
  generateMerchantTradeNo,
} from './ecpay'

describe('ecpay utility', () => {
  it('generates a deterministic check mac value for create order payloads', async () => {
    const checkMacValue = await generateCheckMacValue(
      {
        ChoosePayment: 'ALL',
        EncryptType: 1,
        ItemName: 'Apple iphone 15',
        MerchantID: '3002607',
        MerchantTradeDate: '2023/03/12 15:30:23',
        MerchantTradeNo: 'ecpay20230312153023',
        PaymentType: 'aio',
        ReturnURL: 'https://www.ecpay.com.tw/receive.php',
        TotalAmount: 30000,
        TradeDesc: '促銷方案',
      },
      {
        hashKey: 'pwFHCqoQZGmho4w6',
        hashIv: 'EkRm7iFT261dpevs',
      },
    )

    expect(checkMacValue).toBe('6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840')
  })

  it('builds create order payload with merchant defaults', async () => {
    const payload = await buildEcpayCreateOrderPayload(
      {
        merchantId: '2000132',
        hashKey: '5294y06JbISpM5x9',
        hashIv: 'v77hoKGq4kWxNNIS',
        serviceUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
      },
      {
        merchantTradeNo: 'DX202603281234567890',
        merchantTradeDate: '2026/03/28 12:34:56',
        totalAmount: 1200,
        itemName: 'AI 工具訂閱',
        choosePayment: 'Credit',
        returnUrl: 'https://example.com/api/v1/payments/ecpay/return',
      },
    )

    expect(payload.serviceUrl).toBe('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5')
    expect(payload.fields).toMatchObject({
      MerchantID: '2000132',
      MerchantTradeNo: 'DX202603281234567890',
      MerchantTradeDate: '2026/03/28 12:34:56',
      PaymentType: 'aio',
      TotalAmount: 1200,
      TradeDesc: 'AI Tools order',
      ItemName: 'AI 工具訂閱',
      ReturnURL: 'https://example.com/api/v1/payments/ecpay/return',
      ChoosePayment: 'Credit',
      EncryptType: 1,
    })
    expect(payload.fields.CheckMacValue).toMatch(/^[A-F0-9]{64}$/)
  })

  it('creates merchant trade numbers within the ECPay 20 character limit', () => {
    const merchantTradeNo = generateMerchantTradeNo(() => new Date('2026-03-28T12:34:56+08:00'))

    expect(merchantTradeNo).toBe('DX202603281234560001')
    expect(merchantTradeNo).toHaveLength(20)
  })
})
