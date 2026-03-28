# ECPay Create Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 ECPay 建單核心，包含 D1 訂單 schema、CheckMacValue utility 與 `/api/v1/payments/create` API。

**Architecture:** 新增一個專責的 ECPay utility 處理參數正規化、MerchantTradeNo 與 CheckMacValue，route 只負責驗證、持久化與回傳表單資料。資料庫新增 `orders` / `payment_notifications`，但本票只使用 `orders` 建單。

**Tech Stack:** Cloudflare Workers, Hono, Cloudflare D1, Cloudflare KV, Vitest, TypeScript

---

### Task 1: 建立 ECPay utility 與單元測試

**Files:**
- Create: `apps/api/src/lib/ecpay.ts`
- Create: `apps/api/src/lib/ecpay.test.ts`

- [ ] **Step 1: Write the failing test**

撰寫 `apps/api/src/lib/ecpay.test.ts`，先驗證：
- CheckMacValue 會依 ECPay 規則輸出預期 SHA256 值
- MerchantTradeNo 會產出不超過 20 字元的值

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test apps/api/src/lib/ecpay.test.ts`
Expected: FAIL，因為 `ecpay.ts` 尚未存在或匯出缺漏

- [ ] **Step 3: Write minimal implementation**

在 `apps/api/src/lib/ecpay.ts` 實作：
- `generateMerchantTradeNo()`
- `generateCheckMacValue()`
- `buildEcpayCreateOrderPayload()`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test apps/api/src/lib/ecpay.test.ts`
Expected: PASS

### Task 2: 建立 payments route 與 route 測試

**Files:**
- Create: `apps/api/src/routes/payments.ts`
- Create: `apps/api/src/routes/payments.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing test**

撰寫 `apps/api/src/routes/payments.test.ts`，先驗證：
- 缺少 `amount` / `itemName` 時回 `400`
- 合法請求回 `200` 與必要 form fields
- 建單時會執行 D1 insert

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test apps/api/src/routes/payments.test.ts`
Expected: FAIL，因為 route 尚未存在或尚未掛載

- [ ] **Step 3: Write minimal implementation**

在 `apps/api/src/routes/payments.ts` 實作 `POST /create`，並在 `apps/api/src/index.ts` 掛到 `/api/v1/payments` 與 `authMiddleware`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test apps/api/src/routes/payments.test.ts`
Expected: PASS

### Task 3: 建立 migration 與整體驗證

**Files:**
- Create: `db/migrations/0003_orders.sql`

- [ ] **Step 1: Write the schema file**

新增 `orders` 與 `payment_notifications` table 與索引

- [ ] **Step 2: Run targeted API tests**

Run: `pnpm --filter api test`
Expected: PASS

- [ ] **Step 3: Run full workspace verification**

Run: `pnpm test`
Expected: PASS
