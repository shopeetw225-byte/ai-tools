import type { ChatMessage } from './chat-types'
import { ChatMessageBubble } from './ChatMessageBubble'

type Props = {
  messages: ChatMessage[]
  onRetry?: () => void
}

export function ChatMessageList({ messages, onRetry }: Props) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          <ChatMessageBubble message={msg} />
          {msg.state === 'error' && onRetry && (
            <div className="mt-1 flex justify-start pl-1">
              <button
                onClick={onRetry}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                aria-label="Retry"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
