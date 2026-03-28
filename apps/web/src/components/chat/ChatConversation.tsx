import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from './chat-types'
import { ChatMessageList } from './ChatMessageList'

const SUGGESTIONS = [
  'Explain quantum computing simply',
  'Write a haiku about TypeScript',
  'What is Cloudflare Workers?',
]

type Props = {
  messages: ChatMessage[]
  onSuggestionClick: (suggestion: string) => void
  onRetry?: () => void
}

const AUTO_SCROLL_THRESHOLD_PX = 80

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= AUTO_SCROLL_THRESHOLD_PX
}

export function ChatConversation({ messages, onSuggestionClick, onRetry }: Props) {
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      setIsPinnedToBottom(true)
      return
    }

    if (isPinnedToBottom) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [messages, isPinnedToBottom])

  function handleScroll() {
    const element = scrollRegionRef.current
    if (!element) return
    setIsPinnedToBottom(isNearBottom(element))
  }

  function handleScrollToBottom() {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    setIsPinnedToBottom(true)
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center space-y-3 px-4 py-4">
        <div className="text-4xl">💬</div>
        <p className="text-gray-400 text-sm">Start a conversation with AI</p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRegionRef}
      data-testid="chat-scroll-region"
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto px-4 py-4"
    >
      <ChatMessageList messages={messages} onRetry={onRetry} />
      {!isPinnedToBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="absolute bottom-4 right-4 rounded-full bg-gray-900/90 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/10 hover:bg-gray-800"
        >
          Back to bottom
        </button>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
