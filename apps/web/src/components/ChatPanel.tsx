import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../hooks/useChat'
import { ChatConversation } from './chat/ChatConversation'
import { ChatComposer } from './chat/ChatComposer'

export function ChatPanel() {
  const { t } = useTranslation()
  const { messages, status, sendMessage, retryLastMessage, stopStreaming, clearChat } = useChat()
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
          <h2 className="font-semibold text-white">{t('chat.title')}</h2>
          <p className="text-xs text-gray-500">{t('chat.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDisabled && (
            <button
              type="button"
              onClick={stopStreaming}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t('chat.stop', 'Stop')}
            </button>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t('chat.clear')}
            </button>
          )}
        </div>
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
