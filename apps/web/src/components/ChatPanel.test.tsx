import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ChatPanel } from './ChatPanel'
import { createSseStream, sseFrame, sseDone } from '../test/createSseStream'

function mockFetchSse(frames: string[], status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: createSseStream(frames),
  } as unknown as Response)
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows empty state on initial render', () => {
    render(<ChatPanel />)
    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument()
  })

  it('wires useChat state into conversation and composer', async () => {
    globalThis.fetch = mockFetchSse([
      sseFrame({ text: 'Hello!', conversationId: 'c1' }),
      sseDone(),
    ])

    const user = userEvent.setup()
    render(<ChatPanel />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Hi{Enter}')

    // User message should appear
    expect(await screen.findByText('Hi')).toBeInTheDocument()
    // Assistant response should appear
    expect(await screen.findByText('Hello!')).toBeInTheDocument()
  })

  it('clear chat button works', async () => {
    globalThis.fetch = mockFetchSse([
      sseFrame({ text: 'Response' }),
      sseDone(),
    ])

    const user = userEvent.setup()
    render(<ChatPanel />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Test{Enter}')

    // Wait for response
    expect(await screen.findByText('Response')).toBeInTheDocument()

    // Clear button should be visible
    const clearButton = screen.getByText('Clear')
    await user.click(clearButton)

    // Should go back to empty state
    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument()
  })

  it('shows retry flow after an assistant failure', async () => {
    // First call fails
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    } as unknown as Response)

    const user = userEvent.setup()
    render(<ChatPanel />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    await user.type(textarea, 'Hello{Enter}')

    // Wait for error state
    const retryButton = await screen.findByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    // Setup successful retry
    globalThis.fetch = mockFetchSse([
      sseFrame({ text: 'Recovered!' }),
      sseDone(),
    ])

    await user.click(retryButton)

    // Should show recovered response
    expect(await screen.findByText('Recovered!')).toBeInTheDocument()
  })
})
