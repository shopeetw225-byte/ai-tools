import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatConversation } from './ChatConversation'
import type { ChatMessage } from './chat-types'

describe('ChatConversation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('shows empty state when there are no messages', () => {
    render(<ChatConversation messages={[]} onSuggestionClick={() => {}} />)
    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument()
  })

  it('shows suggestion prompts in empty state', () => {
    render(<ChatConversation messages={[]} onSuggestionClick={() => {}} />)
    expect(screen.getByText(/quantum computing/i)).toBeInTheDocument()
  })

  it('renders messages when provided', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!', state: 'complete' },
    ]
    render(<ChatConversation messages={messages} onSuggestionClick={() => {}} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('renders error message with retry button', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Error occurred', state: 'error' },
    ]
    render(
      <ChatConversation
        messages={messages}
        onSuggestionClick={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText('Error occurred')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('does not auto-scroll when the user has scrolled away from the bottom', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!', state: 'complete' },
    ]
    const { rerender } = render(
      <ChatConversation messages={messages} onSuggestionClick={() => {}} />,
    )

    const scrollRegion = screen.getByTestId('chat-scroll-region')
    Object.defineProperties(scrollRegion, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 200, writable: true },
    })

    ;(window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()

    fireEvent.scroll(scrollRegion)

    rerender(
      <ChatConversation
        messages={[...messages, { id: '3', role: 'assistant', content: 'New reply', state: 'complete' }]}
        onSuggestionClick={() => {}}
      />,
    )

    expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /back to bottom/i })).toBeInTheDocument()
  })

  it('scrolls back to the bottom when the helper control is clicked', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!', state: 'complete' },
    ]
    render(<ChatConversation messages={messages} onSuggestionClick={() => {}} />)

    const scrollRegion = screen.getByTestId('chat-scroll-region')
    Object.defineProperties(scrollRegion, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 200, writable: true },
    })

    fireEvent.scroll(scrollRegion)
    ;(window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()

    fireEvent.click(screen.getByRole('button', { name: /back to bottom/i }))

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
