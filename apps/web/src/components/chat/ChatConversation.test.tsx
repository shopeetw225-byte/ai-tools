import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatConversation } from './ChatConversation'
import type { ChatMessage } from './chat-types'

describe('ChatConversation', () => {
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
})
