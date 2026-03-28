# CMPAA-11 響應式 Chat / Tools 設計規格

## 背景

[CMPAA-11](/CMPAA/issues/CMPAA-11) 的目標是把 AI Chat 與 AI Tools 兩個核心頁面調整為 mobile-first，驗收條件包含：

- Lighthouse Mobile Performance >= 80
- iPhone SE 寬度 375px 可正常使用
- iPad 寬度 768px 可正常使用
- 桌面寬度 1440px 可正常使用
- 不可出現水平捲軸
- 互動元件最小觸控區至少 44px

最新 Paperclip 留言已確認本次範圍只包含 Chat 與 Tools，不處理 Auth、Dashboard、Pricing、Payment 流程頁。

補充範圍說明：

- 允許對 `App.tsx` 的登入後外殼做最小必要調整，因為 Chat / Tools 共用此 shell
- 這些 shell 調整可能被動影響 Dashboard、Pricing、Payment 等登入後 route 的外框排列
- 但本任務不重排那些頁面的內容區，只要求它們在 shell 調整後不出現明顯破版

## 現況摘要

目前前端已經升級為 React 19、Vite 7、Tailwind CSS v4，且聊天頁於 [CMPAA-20](/CMPAA/issues/CMPAA-20) 完成拆分：

- `apps/web/src/App.tsx`
  - 負責語系路由、登入後外殼、主導覽與內容區容器
  - 目前 header 為桌面優先的三欄橫排
  - 內容區使用 `calc(100vh - 57px)`，對手機視窗高度不夠穩定
- `apps/web/src/components/ChatPanel.tsx`
  - 已退化為組裝層，主要串接 `useChat`、`ChatConversation`、`ChatComposer`
- `apps/web/src/components/chat/ChatConversation.tsx`
  - 管理空狀態、捲動區、回到底部按鈕
- `apps/web/src/components/chat/ChatComposer.tsx`
  - 管理多行輸入與送出互動
- `apps/web/src/components/ToolPanel.tsx`
  - 目前同時承載工具切換、工具選項、輸入區、結果區，內容密度高

目前已有 Vitest + Testing Library 測試基礎設施，可直接補前端測試。

## 目標

1. 讓 Chat 與 Tools 在 375px、768px、1440px 下都能完整操作且無橫向溢出。
2. 保留現有功能與路由，不改 API contract、不改資料流。
3. 以結構化版面調整為主，避免一次性大改導覽模式。
4. 補上足夠測試，讓後續微調不容易回歸。

## 44px 觸控區驗收矩陣

本任務中，只要是出現在 Chat / Tools route 上、且由本次響應式調整覆蓋到的主要互動元件，都必須滿足最小 44px 觸控區：

- App shell
  - 主導覽 tabs（Chat / Tools / Dashboard）
  - 語系切換按鈕
  - 登出按鈕
- Chat
  - suggestion chips
  - stop / clear 按鈕
  - textarea 可操作區
  - send 按鈕
  - back to bottom 按鈕
  - retry 按鈕
- Tools
  - 工具切換 tabs
  - summary length buttons
  - translate swap 按鈕
  - select / textarea / run 按鈕
  - copy 按鈕

不在本次矩陣內的項目：

- 瀏覽器原生 UI
- 不屬於 Chat / Tools route 的頁面內容控制項
- 本次驗收流程中被固定關閉的 overlay / banner

## 非目標

- 不重做整個導覽模式，例如新增 bottom navigation 或 mobile 專屬路由
- 不調整 Auth、Dashboard、Landing、Pricing、Payment 相關頁面
- 不變更後端 API、D1 schema、KV session 邏輯
- 不新增新的 UI 套件或 CSS framework

## 方案比較

### 方案 A：最小樣式修補

只在現有元件上加 breakpoint、margin、padding 與寬度限制。

優點：

- 變更量最小
- 交付速度最快

缺點：

- header 與主內容容器的桌面假設仍在
- Chat 與 Tools 的溢出問題容易反覆出現
- 後續維護時難以判斷哪些 class 是補丁、哪些是設計

### 方案 B：結構化響應式調整（採用）

保留目前路由與功能，但重新分配外殼、聊天區、工具區的版面責任，使版面從手機開始向上擴展。

優點：

- 能針對現有元件邊界做正確調整
- 達成驗收條件的把握最高
- 對既有測試與功能風險較低

缺點：

- 需要補更多前端測試
- `ToolPanel` 仍是較大的元件，調整時需要克制範圍

### 方案 C：手機版導覽重做

針對小螢幕重設資訊架構，例如 bottom nav 或獨立 mobile shell。

優點：

- 長期 UX 上限最高

缺點：

- 超出 M1 範圍
- 對路由、測試與 QA 影響太大

## 採用設計

### 1. AppShell 響應式外殼

調整 `apps/web/src/App.tsx` 的登入後外殼：

- header 在小螢幕下改為上下堆疊，而不是強制三欄橫排
- 品牌區、主導覽、語系與使用者操作區各自有清楚的換行規則
- 主導覽在窄螢幕下以 wrap 為主，不採用局部水平捲動作為預設解法
- 主要內容容器改為適合 mobile viewport 的高度配置，不再依賴硬編碼的 `57px`
- 仍保留現有 route 結構，只調整 layout
- Dashboard、Pricing、Payment 等登入後 route 只做 smoke regression，確認 shell 改動未導致明顯破版

### 2. Chat 頁面

Chat 以現有拆分後的元件為基礎處理：

- `ChatPanel.tsx`
  - 保持組裝層，不加入大量版面邏輯
- `ChatConversation.tsx`
  - 空狀態的建議詞在 375px 下可自然換行，不產生超寬 bubble
  - 捲動區 padding 改為隨 viewport 調整
  - 「回到底部」按鈕在手機上不遮擋主要內容或輸入區
- `ChatMessageList` / `ChatMessageBubble`
  - 訊息最大寬度與內距依 breakpoint 微調，避免過窄或過寬
  - 對長單字、長 URL、長 code token 採可斷行策略，例如 `overflow-wrap:anywhere`、`break-words` 或等效 Tailwind class
- `ChatComposer.tsx`
  - 小螢幕優先處理輸入框與送出按鈕的排列
  - 送出按鈕與 textarea 保證至少 44px 高
  - 保持 Enter / Shift+Enter 行為不變

### 3. Tools 頁面

`ToolPanel.tsx` 需要針對高密度互動區做 mobile-first 調整：

- 工具切換列在手機上以換行排列為主，不使用水平捲動
- summarize / translate / explain-code 的選項列在窄螢幕時可以堆疊
- translate 的來源語言、交換按鈕、目標語言在手機上需有自然降級版型
- textarea、字數統計、執行按鈕、輸出區維持清楚的閱讀順序
- copy / error / result 區塊在手機與平板上不出現橫向溢出
- 對長翻譯結果、長 code、長 URL 與長單字輸出採可斷行策略，不能只靠容器縮窄

## 水平溢出定義

本任務禁止的是「頁面層級的 horizontal overflow」：

- `body` / route 內容不可出現需要左右捲動的情況
- Chat bubble、ToolPanel 表單列、header 區不可超出 viewport 寬度
- 本次設計不採用局部水平 scroller，全部以換行、堆疊、縮放間距處理

## 測試策略

### 單元 / 元件測試

新增或擴充以下測試：

- `apps/web/src/App`：驗證登入後外殼與主導覽在不同狀態下可正常渲染
- `apps/web/src/components/chat/ChatComposer.test.tsx`
  - 驗證送出按鈕與輸入框在新結構下仍可互動
- `apps/web/src/components/ChatPanel.test.tsx`
  - 驗證空狀態、串流中狀態、清除與 retry 流程未被響應式調整破壞
- `apps/web/src/components/ToolPanel` 新測試
  - 驗證工具切換、翻譯選項、執行按鈕與輸出區在主要狀態下可操作

### 驗證指令

- `pnpm --filter @ai-tools/web test`
- `pnpm --filter @ai-tools/web build`

### 手動驗證

- 375px：Chat / Tools 無水平捲軸，按鈕可點擊
- 768px：版面不擁擠，內容層級清楚
- 1440px：保留桌面閱讀舒適度
- Dashboard / Pricing / Payment：只確認 shell 未破版
- Lighthouse mobile：依下述 protocol 執行

## Lighthouse 驗收 protocol

- 使用 production build：`pnpm --filter @ai-tools/web build`
- 使用本地 preview 或等效 production asset 提供頁面
- 使用 Chrome Lighthouse 的 mobile preset
- 至少量測兩個 route：
  - `/<lang>/chat`
  - `/<lang>/tools`
- 以登入後狀態進入量測
- 驗收時使用穩定的「happy path」頁面狀態：
  - 不顯示 onboarding modal
  - 不顯示 engagement / upgrade prompt
  - 不顯示臨時 hint banner
  - 不顯示錯誤 toast / blocking overlay
- 若未來 Chat / Tools route 出現不可關閉且預設可見的常駐 banner，則該元件自動視為 in-scope
- 驗收門檻為上述 route 各自的 Mobile Performance >= 80
- 若分數不足，可做的額外優化限於前端頁面範圍，例如：
  - 移除不必要的同步渲染成本
  - 減少不必要的 DOM 層級
  - 延後非關鍵內容載入
  - 避免新增不必要依賴
- 不因 Lighthouse 分數而擴張到後端 API、資料庫或付款流程改造

## 風險與處理

### 風險 1：`ToolPanel.tsx` 過大

處理：

- 先在同檔內完成最小必要調整
- 若調整過程中複雜度過高，再在實作計畫中明確拆出小型子元件

### 風險 2：聊天卷動與 composer 互相干擾

處理：

- 不動 `useChat` 狀態模型
- 只修改展示層與容器層
- 依賴既有聊天測試回歸確認

### 風險 3：長內容導致局部溢出

處理：

- 對 bubble、result、error 區塊明確加入斷行策略
- 手動驗證使用長 URL、長 code、長單字與多行輸出

### 風險 4：Lighthouse 驗收狀態不一致

處理：

- 驗收固定在 happy path、登入後、無 overlay 狀態
- 若驗收環境出現 overlay，先明確關閉或記錄為額外 scope

### 風險 5：新加入的 i18n 文字導致寬度不可控

處理：

- 以中文與英文文字長度都能容納為前提設計導覽與按鈕
- 不用寫死單一語言長度

## 實作邊界

本規格批准後，下一步只做兩件事：

1. 建立實作計畫，明確列出檔案與 TDD 步驟
2. 依計畫執行前端響應式調整與測試
