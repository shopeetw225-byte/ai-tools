# CMPAA-11 響應式 Chat / Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 AI Chat 與 AI Tools 在 375px、768px、1440px 下都可正常操作、無水平捲軸，並滿足最小觸控區 44px。

**Architecture:** 保留現有 React Router、`useChat`、`useAuth` 與資料流，只調整 `App` 外殼、聊天展示層與工具頁版面。所有實作遵循 TDD，先補或擴充前端測試，再做最小必要的 Tailwind 響應式修改。

**Tech Stack:** React 19, Vite 7, Tailwind CSS v4, Vitest 4, Testing Library, React Router 7

---

### Task 1: App 外殼改為 mobile-first

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: 寫出外殼響應式測試**

```tsx
it('renders the authenticated shell with stacked-friendly navigation controls', async () => {
  renderWithRouter(<App />, { route: '/zh-TW/chat', authenticated: true })
  expect(screen.getByRole('navigation')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: 執行單測確認目前測試失敗**

Run: `pnpm --filter @ai-tools/web test -- App.test.tsx`
Expected: FAIL，因為尚未建立 `apps/web/src/App.test.tsx` 與對應 helper

- [ ] **Step 3: 建立最小測試檔並補齊必要 mock**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'user@example.com' },
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

it('renders the authenticated shell with stacked-friendly navigation controls', () => {
  render(
    <MemoryRouter initialEntries={['/zh-TW/chat']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('navigation')).toBeInTheDocument()
})
```

- [ ] **Step 4: 調整 `App.tsx` 版面結構**

```tsx
<header className="border-b border-gray-800 px-4 py-3 sm:px-6">
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
    ...
  </div>
</header>

<main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-0 sm:px-4">
```

- [ ] **Step 5: 將主導覽與語系/使用者操作區改為可換行**

```tsx
<nav className="flex flex-wrap gap-2">
...
<div className="flex flex-wrap items-center gap-2 sm:justify-end">
```

- [ ] **Step 6: 讓 shell 主要控制項符合最小 44px 觸控區**

```tsx
className="min-h-11 rounded-lg px-4 py-2 text-sm"
```

- [ ] **Step 7: 執行單測確認通過**

Run: `pnpm --filter @ai-tools/web test -- App.test.tsx`
Expected: PASS

- [ ] **Step 8: 執行型別檢查確認外殼未破壞 build**

Run: `pnpm --filter @ai-tools/web build`
Expected: BUILD SUCCESS

- [ ] **Step 9: 對共用 shell 的非目標頁面做 smoke regression**

Run: `pnpm --filter @ai-tools/web test -- smoke.test.tsx`
Expected: PASS，至少確認 Dashboard / Pricing / Payment route 不因 shell 調整而明顯破版

### Task 2: 調整聊天區容器、訊息列表與輸入區

**Files:**
- Modify: `apps/web/src/components/ChatPanel.tsx`
- Modify: `apps/web/src/components/chat/ChatConversation.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Modify: `apps/web/src/components/chat/ChatMessageBubble.tsx`
- Modify: `apps/web/src/components/chat/ChatMessageList.tsx`
- Modify: `apps/web/src/components/ChatPanel.test.tsx`
- Modify: `apps/web/src/components/chat/ChatConversation.test.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.test.tsx`
- Modify: `apps/web/src/components/chat/ChatMessageBubble.test.tsx`

- [ ] **Step 1: 為聊天輸入區新增手機版排列測試**

```tsx
it('keeps composer actions accessible on small screens', () => {
  render(<ChatComposer onSubmit={() => {}} disabled={false} />)
  expect(screen.getByRole('button', { name: /send/i })).toBeEnabled()
})
```

- [ ] **Step 2: 執行聊天相關測試確認現況**

Run: `pnpm --filter @ai-tools/web test -- ChatPanel ChatConversation ChatComposer ChatMessageBubble`
Expected: PASS 或暴露目前結構假設不足的測試

- [ ] **Step 3: 調整 `ChatPanel.tsx` header 與容器 spacing**

```tsx
<div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 px-4 py-3 sm:px-5">
```

- [ ] **Step 4: 調整 `ChatConversation.tsx` 的空狀態與捲動區**

```tsx
<div className="flex flex-1 flex-col items-center justify-center space-y-3 px-4 py-6 text-center sm:px-6">
...
className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5"
```

- [ ] **Step 5: 調整 `ChatMessageBubble.tsx` 的最大寬度與換行行為**

```tsx
<div className="max-w-[88%] break-words [overflow-wrap:anywhere] rounded-2xl ... sm:max-w-[80%]">
```

- [ ] **Step 6: 調整 `ChatComposer.tsx` 讓 textarea / send 按鈕在手機下可堆疊**

```tsx
<div className="flex flex-col gap-2 sm:flex-row">
...
className="min-h-11 w-full rounded-xl ... sm:w-auto"
```

- [ ] **Step 7: 擴充現有聊天測試以覆蓋新結構與長內容**

```tsx
expect(screen.getByTestId('chat-scroll-region')).toBeInTheDocument()
expect(screen.getByRole('button', { name: /send/i })).toHaveClass('w-full')
expect(container.querySelector('[data-state=\"complete\"]')).toHaveClass('[overflow-wrap:anywhere]')
```

- [ ] **Step 8: 執行聊天測試確認通過**

Run: `pnpm --filter @ai-tools/web test -- ChatPanel ChatConversation ChatComposer ChatMessageBubble`
Expected: PASS

- [ ] **Step 9: 執行完整前端測試一次**

Run: `pnpm --filter @ai-tools/web test`
Expected: PASS

### Task 3: 調整 ToolPanel 的手機版操作密度

**Files:**
- Modify: `apps/web/src/components/ToolPanel.tsx`
- Create: `apps/web/src/components/ToolPanel.test.tsx`
- Test: `apps/web/src/components/ToolPanel.test.tsx`

- [ ] **Step 1: 新增 ToolPanel 基本互動測試**

```tsx
it('switches tools and keeps the primary action available', async () => {
  render(<ToolPanel />)
  await user.click(screen.getByRole('button', { name: /translate/i }))
  expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: 執行 ToolPanel 測試確認失敗**

Run: `pnpm --filter @ai-tools/web test -- ToolPanel.test.tsx`
Expected: FAIL，因為 `apps/web/src/components/ToolPanel.test.tsx` 尚未存在

- [ ] **Step 3: 建立最小測試檔**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolPanel } from './ToolPanel'

it('switches tools and keeps the primary action available', async () => {
  const user = userEvent.setup()
  render(<ToolPanel />)
  await user.click(screen.getByRole('button', { name: /translate/i }))
  expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
})
```

- [ ] **Step 4: 調整 `ToolPanel.tsx` 的工具列、選項列與輸入區**

```tsx
<div className="flex flex-wrap gap-2 px-4 py-2">
...
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
```

- [ ] **Step 5: 讓 translate 選項與 swap 按鈕在手機版可堆疊**

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
```

- [ ] **Step 6: 調整 input / result 區塊避免小螢幕溢出與長內容破版**

```tsx
<div className="relative overflow-hidden rounded-xl">
...
<div className="space-y-2 overflow-hidden [overflow-wrap:anywhere]">
```

- [ ] **Step 7: 讓 ToolPanel 主要控制項符合最小 44px 觸控區**

```tsx
className="min-h-11 rounded-lg px-3 py-2 text-sm"
```

- [ ] **Step 8: 執行 ToolPanel 測試確認通過**

Run: `pnpm --filter @ai-tools/web test -- ToolPanel.test.tsx`
Expected: PASS

- [ ] **Step 9: 執行完整前端測試與 build**

Run: `pnpm --filter @ai-tools/web test && pnpm --filter @ai-tools/web build`
Expected: 全部 PASS，build 成功

### Task 4: 手動驗證與 QA 交接準備

**Files:**
- Modify: `docs/superpowers/specs/2026-03-29-cmpaa-11-responsive-chat-tools-design.md`
- Modify: `docs/superpowers/plans/2026-03-29-cmpaa-11-responsive-chat-tools.md`

- [ ] **Step 1: 在 375px、768px、1440px 做手動檢查**

Run: `pnpm --filter @ai-tools/web dev`
Expected: Chat / Tools 無頁面級水平捲軸，互動元件可正常點擊，Dashboard / Pricing / Payment shell 無明顯破版

- [ ] **Step 2: 用長 URL、長 code、長單字做真實內容 smoke check**

Run: `pnpm --filter @ai-tools/web dev`
Expected: Chat bubble、Tool result、error 區塊不會因長內容撐出 viewport

- [ ] **Step 3: 以登入後 happy path 狀態執行 Lighthouse**

Run: `pnpm --filter @ai-tools/web build`
Expected: 量測前確認無 onboarding modal、upsell、hint banner、blocking overlay

- [ ] **Step 4: 執行 Lighthouse mobile 驗證**

Run: `pnpm --filter @ai-tools/web build`
Expected: 可進行本地預覽與 Lighthouse 檢查，`/<lang>/chat` 與 `/<lang>/tools` 的 Mobile Performance 均 >= 80

- [ ] **Step 5: 更新文件中的驗證結果**

```md
- 375px: PASS
- 768px: PASS
- 1440px: PASS
- Lighthouse Mobile: >= 80
```

- [ ] **Step 6: 提交變更**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx \
  apps/web/src/components/ChatPanel.tsx \
  apps/web/src/components/ToolPanel.tsx \
  apps/web/src/components/ToolPanel.test.tsx \
  apps/web/src/components/chat/ChatConversation.tsx \
  apps/web/src/components/chat/ChatComposer.tsx \
  apps/web/src/components/chat/ChatMessageBubble.tsx \
  apps/web/src/components/chat/ChatMessageList.tsx \
  apps/web/src/components/ChatPanel.test.tsx \
  apps/web/src/components/chat/ChatConversation.test.tsx \
  apps/web/src/components/chat/ChatComposer.test.tsx \
  apps/web/src/components/chat/ChatMessageBubble.test.tsx \
  docs/superpowers/specs/2026-03-29-cmpaa-11-responsive-chat-tools-design.md \
  docs/superpowers/plans/2026-03-29-cmpaa-11-responsive-chat-tools.md
git commit -m "feat: 完成 CMPAA-11 響應式 Chat 與 Tools 優化"
```

- [ ] **Step 7: 交接 QA**

Run: `PATCH /api/issues/c67f2d37-d8b8-49ac-9de9-9ee1290e6f14`
Expected: 狀態設為 `in_review`，assignee 改為 [QA 小趙](/CMPAA/agents/qa)
