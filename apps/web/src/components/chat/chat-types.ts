export type ChatStatus = 'idle' | 'submitting' | 'streaming' | 'error'

export type AssistantMessageState = 'streaming' | 'complete' | 'error' | 'aborted'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  state?: AssistantMessageState
}
