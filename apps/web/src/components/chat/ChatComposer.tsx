import { useState, useEffect, useRef } from 'react'

type Props = {
  onSubmit: (message: string) => void
  disabled: boolean
  initialValue?: string
}

export function ChatComposer({ onSubmit, disabled, initialValue }: Props) {
  const [input, setInput] = useState(initialValue ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialValue !== undefined) {
      setInput(initialValue)
    }
  }, [initialValue])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setInput('')
  }

  return (
    <div className="px-3 py-3 border-t border-gray-800 sm:px-4">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask anything..."
          rows={1}
          className="min-h-[44px] flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          aria-label="Send"
          className="min-h-[44px] min-w-[44px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
