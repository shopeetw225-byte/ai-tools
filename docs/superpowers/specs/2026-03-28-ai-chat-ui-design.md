# AI 聊天介面設計規格

## 背景

`CMPAA-20` 需要把現有 `apps/web` 內的聊天體驗提升為可交付的核心介面，並且符合公司強制技術棧：

- React 19
- Vite 7
- Tailwind CSS v4

目前 repo 已有基本聊天室，但仍存在以下問題：

- `apps/web/src/components/ChatPanel.tsx` 同時承擔版面、訊息渲染、輸入互動與空狀態，責任過大。
- `apps/web/src/hooks/useChat.ts` 只有 `loading`，無法清楚表達送出中、串流中、失敗等不同狀態。
- UI 仍停留在 MVP 水位，尚未支援多行輸入、Markdown 顯示與更完整的錯誤回饋。
- 前端工具鏈尚未升級到 React 19 + Vite 7 + Tailwind CSS v4。

## 目標

在既有 `apps/web` 架構上完成聊天介面升級，交付以下能力：

1. 聊天訊息列表與訊息泡泡
2. Assistant 訊息的 Markdown 顯示
3. 多行輸入與快捷鍵送出
4. 串流回應的逐段更新
5. 清楚的載入、串流、錯誤狀態
6. 手機與桌面都可用的響應式版面
7. 與公司指定前端技術棧一致

## 非目標

以下內容不在本次前端任務範圍內：

- 重寫整個應用 shell 或導覽系統
- 新增與聊天無關的功能頁
- 大幅改動後端 API 協定
- 引入第三方 UI 框架

## 推薦方案

採用「先升級工具鏈，再在既有聊天頁面內做結構化重構」：

- 保留現有 `App.tsx` 與聊天頁入口，降低變更面。
- 升級 `apps/web` 到 React 19、Vite 7、Tailwind CSS v4，讓後續組件都建立在正確棧上。
- 將 `ChatPanel` 拆成聚焦元件，避免單一檔案承擔所有責任。
- 保留 `useChat` 作為聊天狀態核心，但把狀態模型擴充為可直接驅動 UI 的結構。

這比整頁重寫更容易控管風險，也比另外再開一套平行聊天模組更少重複。

## 元件與模組切分

### 1. `ChatPanel`

負責頁面骨架與狀態組裝，不再直接承擔內容分支判斷。它只負責：

- 頁首資訊
- 呼叫 `useChat`
- 提供 scroll container 與 autoscroll 規則
- 把資料與事件分派給內容區與輸入區

### 2. `ChatConversation`

專職渲染聊天內容區，這裡是單一的內容 ownership：

- 空對話畫面
- 建議 prompt 清單
- 錯誤提示區塊
- 訊息列表
- 「回到底部」輔助按鈕

`ChatPanel` 不再自行切換空狀態與錯誤態，避免與內容區重疊。

### 3. `ChatMessageList`

只負責正常訊息序列與訊息之間的間距、排序與列表語意，不再決定空狀態或錯誤提示。

### 4. `ChatMessageBubble`

專職渲染單則訊息泡泡：

- user 訊息維持純文字
- assistant 訊息支援 Markdown 顯示
- streaming 中的 assistant 顯示游標或進行中狀態
- failed / aborted assistant 訊息顯示對應的 message-level 視覺狀態

### 5. `ChatComposer`

專職處理輸入與送出動作，不負責建議 prompt：

- 多行 `textarea`
- `Enter` 送出
- `Shift+Enter` 換行
- disabled 狀態
- 送出按鈕與字數/狀態提示

### 6. `useChat`

維持為聊天邏輯入口，但狀態要更明確：

- `messages`
- `conversationId`
- `status`
- `error`
- `lastSubmittedMessage`
- `sendMessage`
- `retryLastMessage`
- `clearChat`

## 狀態模型

現有單一 `loading` 不足以支撐完整 UI，設計改為：

```ts
type ChatStatus = 'idle' | 'submitting' | 'streaming' | 'error'
```

```ts
type AssistantMessageState = 'streaming' | 'complete' | 'error' | 'aborted'
```

搭配：

- `messages`: 畫面上所有訊息
- `error`: 最近一次錯誤資訊，可為 `null`
- `conversationId`: 後端會話識別
- `lastSubmittedMessage`: 最近一次成功送出的 user 文字，供 retry 使用

assistant 訊息需要保留自己的狀態欄位，因為錯誤與中止是訊息級結果，不應只靠全域 `status` 推斷。

狀態轉換大致如下：

1. 使用者送出訊息後進入 `submitting`
2. 收到串流資料後切換成 `streaming`
3. 串流完成後回到 `idle`
4. 任何非中止錯誤進入 `error`

### 錯誤與重試規則

- 發生非預期錯誤時，對應的 assistant placeholder 轉成 `error` 狀態，不直接消失。
- 內容區同時顯示一個 inline 錯誤區塊，說明可重試。
- `retryLastMessage` 會重送最近一次 user message，並沿用現有 `conversationId`；如果 `conversationId` 尚未建立，就以新對話送出。
- retry 會建立新的 assistant placeholder，不覆蓋舊的失敗訊息，保留問題現場。
- `clearChat` 會中止請求並清空所有訊息與 `conversationId`，屬於明確重置而不是 retry。

## 資料流

### 送出流程

1. `ChatComposer` 呼叫 `sendMessage`
2. `useChat` 先插入 user 訊息與空的 assistant placeholder
3. 呼叫 `/api/v1/chat`
4. 逐行解析 SSE 資料
5. 每個 `chunk` frame 都 append 到 assistant 訊息
6. 如果收到 `meta` frame 的 `conversationId`，同步更新本地 state
7. 收到 `done` frame 後結束串流並清除 streaming 狀態

### Request payload 規則

request body 維持與現有 API 相容的結構：

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "conversationId": "..."
}
```

前端送出規則：

- `messages` 只包含已完成的對話上下文，加上本次新送出的 user 訊息。
- `streaming`、`error`、`aborted` 的 assistant placeholder 都不得送進 request body。
- retry 時，沿用目前畫面中最後一組「已完成的對話上下文」與 `conversationId`，再追加要重送的 user 訊息。
- retry 不會把上一次失敗的 assistant placeholder 視為有效歷史，也不會把失敗 UI 送回後端。
- 如果畫面上沒有任何已完成 assistant 訊息，retry payload 只帶既有 user/assistant 完整歷史與最新要重送的 user 訊息。

### 錯誤流程

- `AbortError` 視為可預期中止，不顯示錯誤 toast
- 如果中止前尚未收到任何 assistant chunk，placeholder 直接移除
- 如果中止前已收到 partial assistant 內容，保留內容並標記該訊息為 `aborted`
- 非預期錯誤顯示在聊天區內，並保留已送出的 user 訊息
- assistant placeholder 不應只被硬編碼英文訊息覆蓋，而應有明確錯誤 UI

### 過期串流保護

`useChat` 必須保護自己不被舊請求回寫 state：

- 每次 `sendMessage` / `retryLastMessage` 都建立新的 request token 或 request id。
- 後續 `chunk`、`error`、`done`、`finally` 只有在 request id 仍是目前 active request 時才能更新 state。
- `clearChat` 或新一輪 retry 觸發 abort 後，舊請求的任何後續 frame 都必須被忽略。
- `clearChat` 完成後，畫面狀態以 reset 後的新 state 為準，不允許舊串流把 assistant 訊息或 `status` 寫回來。

### SSE 契約

`CMPAA-20` 以前端相容目前後端 SSE 形狀為準，不在本 task 內強制改動 `apps/api`：

```json
{ "text": "...", "conversationId": "...", "model": "..." }
{ "text": "...", "error": "chat_generation_failed", "conversationId": "...", "model": "..." }
```

結束訊號維持：

```text
data: [DONE]
```

規則：

- 前端只解析 `data:` 行，不依賴 named event。
- `text` chunk 直接 append 到當前 assistant placeholder。
- 帶有 `error` 欄位的 frame 代表應把當前 assistant placeholder 轉為 `error` 狀態。
- `conversationId` 可能出現在一般 chunk 或錯誤 chunk，前端都需要能更新。
- stream 結尾若 buffer 仍有殘留內容，需要再做一次解析，不可直接丟棄。
- 若未來 [CMPAA-21](/CMPAA/issues/CMPAA-21) 把後端升級為 `meta/chunk/error/done` frame，前端 parser 應以可擴充方式實作，但本次驗收仍以現況 SSE 為準。

## Markdown 策略

Markdown 只應套用在 assistant 訊息，避免 user 輸入與呈現規則混雜。

渲染層原則：

- user 訊息：純文字
- assistant 訊息：Markdown
- 若需要額外依賴，僅允許輕量且與 UI 框架無關的內容渲染工具

## 響應式策略

聊天室頁面維持 mobile-first：

- 手機版優先確保輸入區固定可用、訊息區可捲動
- 桌面版再放大最大寬度與留白
- 避免 header / composer 把可視訊息區擠到過小

版面原則：

- 訊息區高度可用
- 輸入區在小螢幕仍易點擊
- 長訊息與 code block 不得破版

互動規則補充：

- 只有在使用者距離底部 80px 以內時，串流更新才自動捲到底。
- 若使用者手動往上捲，停止強制 autoscroll，並由 `ChatConversation` 顯示「回到底部」按鈕。
- `submitting` 與 `streaming` 期間，輸入框與送出鍵禁用，避免併發送出。
- `clearChat` 在 `submitting` 與 `streaming` 期間仍可操作，行為是 abort + reset。

## 工具鏈升級範圍

本次前端任務會包含以下升級：

- `react` / `react-dom` 升級到 19
- `@types/react` / `@types/react-dom` 升級到 React 19 對應版本
- `vite` 升級到 7
- `@vitejs/plugin-react` 升級到對應版本
- `postcss` / `autoprefixer` 依 Tailwind CSS v4 需求調整
- Tailwind CSS v4 配置改寫
- `postcss.config.js` 需改成 Tailwind CSS v4 的 plugin 形式
- `tailwind.config.js` 若沒有自訂 theme / plugin 需求，應移除或降到最小
- `src/index.css` 由舊版 `@tailwind` 指令改成 v4 寫法
- 必要時調整 `vite.config.ts` 與 TypeScript 設定，確保升級後仍能 build

## 測試策略

### 元件測試

- 空狀態畫面
- 建議 prompt 點擊後帶入輸入框
- 訊息列表渲染
- streaming 游標顯示
- 錯誤提示顯示
- composer disabled / enabled 行為
- aborted / failed 訊息視覺狀態

### 互動測試

- `Enter` 送出
- `Shift+Enter` 換行
- 送出後清空輸入框
- 點擊建議 prompt 自動帶入
- 清除聊天

### hook 測試

- SSE 分段資料正確 append
- `conversationId` 更新
- 中止請求不顯示錯誤
- 非預期錯誤進入 `error` 狀態
- retry 會重送 `lastSubmittedMessage`
- 殘留 buffer 仍會被解析

### 測試基礎設施

前端測試統一使用：

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`

mock 邊界：

- 元件與 hook 測試都以 mock `fetch` + 自建 `ReadableStream` 測 SSE
- 不直接 mock `useChat` 來測 `ChatPanel`
- 需要一個可重用的 stream helper 來輸出目前 SSE 的 `data: { text, conversationId, model }` 與 `data: [DONE]`

### 建置驗證

- `apps/web` 在 React 19 + Vite 7 + Tailwind CSS v4 下可正常 build

## 風險與對策

### 1. 工具鏈升級造成既有頁面退化

對策：把升級限制在 `apps/web`，並用 build 與互動測試驗證聊天頁。

### 2. 串流邏輯與 UI 耦合過深

對策：把串流解析留在 `useChat`，元件只消費明確狀態。

### 3. Markdown 顯示導致泡泡樣式失控

對策：把 Markdown 樣式限制在 assistant bubble 內，避免影響整體排版。

## 實作邊界

本次實作預計主要碰觸：

- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `apps/web/postcss.config.js`
- `apps/web/tailwind.config.js`
- `apps/web/src/index.css`
- `apps/web/src/components/ChatPanel.tsx`
- `apps/web/src/components/ChatConversation.tsx`
- `apps/web/src/components/ChatMessageList.tsx`
- `apps/web/src/components/ChatMessageBubble.tsx`
- `apps/web/src/components/ChatComposer.tsx`
- `apps/web/src/hooks/useChat.ts`
- 新增前端測試檔與 stream test helper

## 驗收結果

完成後應達到：

- 聊天 UI 在手機與桌面可正常使用
- assistant 訊息可顯示 Markdown
- 多行輸入與快捷鍵符合預期
- 串流過程有清楚的中間狀態
- 發生錯誤時使用者能看懂且可重試
- 前端棧符合 React 19 + Vite 7 + Tailwind CSS v4
