import { useRef, useEffect } from 'react'
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

export function ChatConversation({ messages, onSuggestionClick, onRetry }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

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
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <ChatMessageList messages={messages} onRetry={onRetry} />
      <div ref={bottomRef} />
    </div>
  )
}
