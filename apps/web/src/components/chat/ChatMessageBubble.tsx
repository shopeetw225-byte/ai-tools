import type { ChatMessage } from './chat-types'

type Props = {
  message: ChatMessage
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i > 0) elements.push(<br key={`br-${i}`} />)
    elements.push(<InlineMarkdown key={`line-${i}`} text={line} />)
  }

  return <>{elements}</>
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  // Match **bold**, `code`, *italic*
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(
        <code key={key++} className="bg-gray-700/50 px-1 py-0.5 rounded text-sm font-mono">
          {match[3]}
        </code>,
      )
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}

export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const assistantBubbleClassName =
    message.state === 'error'
      ? 'border border-red-800/50 bg-red-900/30 text-red-200'
      : message.state === 'aborted'
        ? 'border border-amber-700/40 bg-amber-950/30 text-amber-100'
        : 'bg-gray-800 text-gray-100'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] break-words rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[80%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div
        data-state={message.state}
        className={`max-w-[88%] break-words rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%] ${assistantBubbleClassName}`}
      >
        {message.content ? (
          <SimpleMarkdown content={message.content} />
        ) : null}
        {message.state === 'streaming' && (
          <span className="animate-pulse">▋</span>
        )}
        {message.state === 'aborted' && (
          <div className="mt-2 text-xs text-amber-300">Generation stopped</div>
        )}
      </div>
    </div>
  )
}
