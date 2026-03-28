import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatMessageBubble } from './ChatMessageBubble'
import type { ChatMessage } from './chat-types'

describe('ChatMessageBubble', () => {
  it('renders user message content', () => {
    const msg: ChatMessage = { id: '1', role: 'user', content: 'Hello world' }
    render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders assistant markdown content', () => {
    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'This is **bold** text',
      state: 'complete',
    }
    render(<ChatMessageBubble message={msg} />)
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders streaming indicator for streaming messages', () => {
    const msg: ChatMessage = {
      id: '3',
      role: 'assistant',
      content: 'Partial',
      state: 'streaming',
    }
    render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Partial')).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
  })

  it('renders error state distinctly', () => {
    const msg: ChatMessage = {
      id: '4',
      role: 'assistant',
      content: 'Something went wrong',
      state: 'error',
    }
    const { container } = render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(container.querySelector('[data-state="error"]')).toBeInTheDocument()
  })

  it('renders aborted state', () => {
    const msg: ChatMessage = {
      id: '5',
      role: 'assistant',
      content: 'Partial response',
      state: 'aborted',
    }
    const { container } = render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Partial response')).toBeInTheDocument()
    expect(container.querySelector('[data-state="aborted"]')).toBeInTheDocument()
  })

  it('renders inline code in markdown', () => {
    const msg: ChatMessage = {
      id: '6',
      role: 'assistant',
      content: 'Use `console.log()` to debug',
      state: 'complete',
    }
    render(<ChatMessageBubble message={msg} />)
    const code = screen.getByText('console.log()')
    expect(code.tagName).toBe('CODE')
  })
})
