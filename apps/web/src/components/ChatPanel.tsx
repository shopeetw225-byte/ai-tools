import { useState } from 'react'
import { useChat } from '../hooks/useChat'
import { ChatConversation } from './chat/ChatConversation'
import { ChatComposer } from './chat/ChatComposer'

export function ChatPanel() {
  const { messages, status, sendMessage, retryLastMessage, clearChat } = useChat()
  const [composerValue, setComposerValue] = useState<string | undefined>()

  const isDisabled = status === 'submitting' || status === 'streaming'

  function handleSuggestionClick(suggestion: string) {
    setComposerValue(suggestion)
  }

  function handleSubmit(message: string) {
    sendMessage(message)
    setComposerValue(undefined)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="font-semibold text-white">Chat</h2>
          <p className="text-xs text-gray-500">Powered by Llama 3.1 via Workers AI</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Conversation */}
      <ChatConversation
        messages={messages}
        onSuggestionClick={handleSuggestionClick}
        onRetry={retryLastMessage}
      />

      {/* Composer */}
      <ChatComposer
        onSubmit={handleSubmit}
        disabled={isDisabled}
        initialValue={composerValue}
      />
    </div>
  )
}
