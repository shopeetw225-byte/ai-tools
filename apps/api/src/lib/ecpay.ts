const DOT_NET_URLENCODE_REPLACEMENTS: Record<string, string> = {
  '%20': '+',
  '%21': '!',
  '%28': '(',
  '%29': ')',
  '%2a': '*',
  '%2d': '-',
  '%2e': '.',
  '%5f': '_',
}

const MERCHANT_TRADE_PREFIX = 'DX'

export type EcpayPaymentType = 'ALL' | 'Credit' | 'ATM' | 'CVS' | 'BARCODE'

export type EcpayConfig = {
  merchantId: string
  hashKey: string
  hashIv: string
  serviceUrl: string
}

export type CreateOrderInput = {
  merchantTradeNo: string
  merchantTradeDate: string
  totalAmount: number
  itemName: string
  choosePayment: EcpayPaymentType
  returnUrl: string
  orderResultUrl?: string
}

export type EcpayCreateOrderFields = {
  MerchantID: string
  MerchantTradeNo: string
  MerchantTradeDate: string
  PaymentType: 'aio'
  TotalAmount: number
  TradeDesc: string
  ItemName: string
  ReturnURL: string
  OrderResultURL?: string
  ChoosePayment: EcpayPaymentType
  EncryptType: 1
  CheckMacValue: string
}

export function generateMerchantTradeNo(nowFactory: () => Date = () => new Date()): string {
  const now = nowFactory()
  const parts = [
    now.getFullYear().toString(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]

  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `${MERCHANT_TRADE_PREFIX}${parts.join('')}${rand}`
}

export function formatMerchantTradeDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hour}:${minute}:${second}`
}

function toSortedQueryString(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&')
}

function dotNetUrlEncode(value: string): string {
  let encoded = encodeURIComponent(value).toLowerCase()

  for (const [search, replacement] of Object.entries(DOT_NET_URLENCODE_REPLACEMENTS)) {
    encoded = encoded.replaceAll(search, replacement)
  }

  return encoded
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateCheckMacValue(
  fields: Record<string, string | number>,
  secrets: { hashKey: string; hashIv: string },
): Promise<string> {
  const query = toSortedQueryString(fields)
  const raw = `HashKey=${secrets.hashKey}&${query}&HashIV=${secrets.hashIv}`
  const encoded = dotNetUrlEncode(raw)
  const hashed = await sha256Hex(encoded)

  return hashed.toUpperCase()
}

export async function verifyCheckMacValue(
  payload: Record<string, string>,
  secrets: { hashKey: string; hashIv: string },
): Promise<boolean> {
  const { CheckMacValue, ...fields } = payload
  if (!CheckMacValue) return false
  const expected = await generateCheckMacValue(fields, secrets)
  return expected === CheckMacValue.toUpperCase()
}

export async function buildEcpayCreateOrderPayload(
  config: EcpayConfig,
  input: CreateOrderInput,
): Promise<{ serviceUrl: string; fields: EcpayCreateOrderFields }> {
  const baseFields: Record<string, string | number> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: input.merchantTradeDate,
    PaymentType: 'aio' as const,
    TotalAmount: input.totalAmount,
    TradeDesc: 'AI Tools order',
    ItemName: input.itemName,
    ReturnURL: input.returnUrl,
    ChoosePayment: input.choosePayment,
    EncryptType: 1 as const,
  }

  if (input.orderResultUrl) {
    baseFields['OrderResultURL'] = input.orderResultUrl
  }

  const checkMacValue = await generateCheckMacValue(baseFields, {
    hashKey: config.hashKey,
    hashIv: config.hashIv,
  })

  return {
    serviceUrl: config.serviceUrl,
    fields: {
      ...(baseFields as Omit<EcpayCreateOrderFields, 'CheckMacValue'>),
      CheckMacValue: checkMacValue,
    },
  }
}
