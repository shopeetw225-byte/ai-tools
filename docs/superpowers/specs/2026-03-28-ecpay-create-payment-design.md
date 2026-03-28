# ECPay 建單核心設計

## 目標

在既有 Cloudflare Workers + Hono 專案中補上 ECPay 建單核心，範圍只包含 D1 schema、CheckMacValue 計算與 `/api/v1/payments/create` API，不提前實作 callback / webhook 流程。

## 設計摘要

- D1 新增 `orders` 與 `payment_notifications`，欄位對齊 `[CMPAA-32](/CMPAA/issues/CMPAA-32#document-plan)` 建議 schema。
- 將 ECPay 參數處理集中在 `apps/api/src/lib/ecpay.ts`，避免 route 內混入編碼規則與雜湊細節。
- `POST /api/v1/payments/create` 採受保護路由，沿用既有 session / `authMiddleware`，訂單直接綁定登入 user。
- API 僅回傳給前端可直接組隱藏表單的欄位資料與 ECPay 端點 URL，不處理前端自動 submit。

## 元件切分

### Migration

- `db/migrations/0003_orders.sql`
- 責任：建立訂單與金流通知表、必要索引、狀態約束

### ECPay Utility

- `apps/api/src/lib/ecpay.ts`
- 責任：
  - 產生 `MerchantTradeNo`
  - 組裝 ECPay 建單 payload
  - 套用 URL encode + 特殊字元轉換規則
  - 使用 Workers Web Crypto 產生 SHA256 CheckMacValue

### Payments Route

- `apps/api/src/routes/payments.ts`
- 責任：
  - 驗證 `amount`、`itemName`、`choosePayment`
  - 寫入 `orders`
  - 回傳前端需要的 ECPay form data

### 測試

- `apps/api/src/lib/ecpay.test.ts`
- `apps/api/src/routes/payments.test.ts`
- 責任：驗證雜湊結果、輸入驗證、訂單寫入與 API 輸出

## 資料流

1. 前端帶 Bearer token 呼叫 `POST /api/v1/payments/create`
2. API 驗證 payload 與登入身分
3. API 產生 `MerchantTradeNo`，寫入 `orders`
4. API 使用 secret 與 payload 計算 CheckMacValue
5. API 回傳：
   - ECPay endpoint URL
   - form method
   - form fields（含 CheckMacValue）

## 錯誤處理

- 缺少必要欄位或格式錯誤：`400`
- 缺少 ECPay secret / MerchantID：`503`
- D1 寫入失敗：`500`
- `choosePayment` 僅接受白名單值，避免任意字串寫入或送給上游

## 測試策略

- Utility 測試先驗證 CheckMacValue 與 ECPay 測試金鑰一致
- Route 測試驗證：
  - 未帶必要欄位時回 `400`
  - 合法請求會寫入 `orders`
  - 成功回傳含必要 form fields 與 CheckMacValue

## 本票不做

- `ReturnURL` / `OrderResultURL` callback endpoint
- webhook 驗證與 `payment_notifications` 寫入流程
- 前端 ECPay 提交 UI
