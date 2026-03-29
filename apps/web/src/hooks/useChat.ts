import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatStatus } from '../components/chat/chat-types'
import { API_BASE } from '../lib/api'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const activeRequestIdRef = useRef<string | null>(null)

  function isActiveRequest(requestId: string) {
    return activeRequestIdRef.current === requestId
  }

  function getCompletedTranscript(msgs: ChatMessage[]): Array<{ role: string; content: string }> {
    return msgs
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.state === 'complete'))
      .map(({ role, content }) => ({ role, content }))
  }

  function abortActiveRequest() {
    activeRequestIdRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
  }

  async function processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    assistantMsgId: string,
    requestId: string,
  ) {
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!isActiveRequest(requestId)) return

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            if (!isActiveRequest(requestId)) return
            setStatus('idle')
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, state: 'complete' as const } : m,
              ),
            )
            return
          }
          try {
            const parsed = JSON.parse(data) as { text?: string; conversationId?: string; error?: string; model?: string }
            if (!isActiveRequest(requestId)) return
            if (parsed.conversationId) setConversationId(parsed.conversationId)
            if (parsed.text) {
              setStatus('streaming')
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m,
                ),
              )
            }
            if (parsed.error) {
              setStatus('error')
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: parsed.error!, state: 'error' as const }
                    : m,
                ),
              )
              return
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Process trailing buffer
      if (buffer.trim() && isActiveRequest(requestId)) {
        const remaining = buffer.trim()
        if (remaining.startsWith('data: ')) {
          const data = remaining.slice(6).trim()
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data) as { text?: string; conversationId?: string }
              if (parsed.conversationId) setConversationId(parsed.conversationId)
              if (parsed.text) {
                  setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: m.content + parsed.text } : m,
                  ),
                )
              }
            } catch {
              // skip
            }
          }
        }
      }

      // Stream ended without [DONE] — mark complete
      if (isActiveRequest(requestId)) {
        setStatus('idle')
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId ? { ...m, state: 'complete' as const } : m,
          ),
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (!isActiveRequest(requestId)) return
      setStatus('error')
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', state: 'error' as const }
            : m,
        ),
      )
    }
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || status === 'submitting' || status === 'streaming') return

    const requestId = crypto.randomUUID()
    activeRequestIdRef.current = requestId

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
    const assistantMsgId = crypto.randomUUID()
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '', state: 'streaming' }

    const transcript = [...getCompletedTranscript(messages), { role: 'user', content }]

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStatus('submitting')

    abortRef.current = new AbortController()

    try {
      const token = localStorage.getItem('ai_tools_token')
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ messages: transcript, conversationId }),
        signal: abortRef.current.signal,
      })

      if (!isActiveRequest(requestId)) return

      if (!res.ok || !res.body) {
        setStatus('error')
        let errorContent = `HTTP ${res.status} error`
        if (res.status === 429) {
          try {
            const errData = await res.json() as { error?: string }
            if (errData.error === 'quota_exceeded') {
              errorContent = '今日免費額度已用完（10 次），升級 Pro 可繼續無限對話'
            }
          } catch { /* keep default */ }
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: errorContent, state: 'error' as const }
              : m,
          ),
        )
        return
      }

      setStatus('streaming')
      const reader = res.body.getReader()
      await processStream(reader, assistantMsgId, requestId)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (!isActiveRequest(requestId)) return
      setStatus('error')
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', state: 'error' as const }
            : m,
        ),
      )
    } finally {
      if (isActiveRequest(requestId)) {
        abortRef.current = null
      }
    }
  }, [messages, status, conversationId])

  const retryLastMessage = useCallback(async () => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return

    // Remove the failed assistant message
    setMessages(prev => {
      const lastAssistantIdx = prev.findLastIndex(m => m.role === 'assistant')
      if (lastAssistantIdx >= 0) {
        return prev.filter((_, i) => i !== lastAssistantIdx)
      }
      return prev
    })

    // Reset status so sendMessage can proceed
    setStatus('idle')

    // Wait for state to settle then re-send
    // We need to reconstruct transcript excluding the failed assistant message
    const requestId = crypto.randomUUID()
    activeRequestIdRef.current = requestId

    const assistantMsgId = crypto.randomUUID()
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '', state: 'streaming' }

    const cleanMessages = messages.filter(m => {
      if (m.role === 'assistant' && (m.state === 'error' || m.state === 'aborted')) return false
      return true
    })
    const transcript = getCompletedTranscript(cleanMessages)
    // Ensure the last user message is in transcript
    if (!transcript.length || transcript[transcript.length - 1].content !== lastUserMsg.content) {
      transcript.push({ role: 'user', content: lastUserMsg.content })
    }

    setMessages(prev => {
      // Remove old failed assistant and add new one
      const filtered = prev.filter(m => !(m.role === 'assistant' && (m.state === 'error' || m.state === 'aborted')))
      return [...filtered, assistantMsg]
    })
    setStatus('submitting')

    abortRef.current = new AbortController()

    try {
      const token = localStorage.getItem('ai_tools_token')
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ messages: transcript, conversationId }),
        signal: abortRef.current.signal,
      })

      if (!isActiveRequest(requestId)) return

      if (!res.ok || !res.body) {
        setStatus('error')
        let errorContent = `HTTP ${res.status} error`
        if (res.status === 429) {
          try {
            const errData = await res.json() as { error?: string }
            if (errData.error === 'quota_exceeded') {
              errorContent = '今日免費額度已用完（10 次），升級 Pro 可繼續無限對話'
            }
          } catch { /* keep default */ }
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: errorContent, state: 'error' as const }
              : m,
          ),
        )
        return
      }

      setStatus('streaming')
      const reader = res.body.getReader()
      await processStream(reader, assistantMsgId, requestId)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (!isActiveRequest(requestId)) return
      setStatus('error')
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, something went wrong.', state: 'error' as const }
            : m,
        ),
      )
    } finally {
      if (isActiveRequest(requestId)) {
        abortRef.current = null
      }
    }
  }, [messages, conversationId])

  const stopStreaming = useCallback(() => {
    abortActiveRequest()
    setMessages(prev => {
      const lastAssistantIdx = prev.findLastIndex(
        m => m.role === 'assistant' && m.state === 'streaming',
      )

      if (lastAssistantIdx < 0) return prev

      const assistantMessage = prev[lastAssistantIdx]
      if (!assistantMessage.content) {
        return prev.filter((_, index) => index !== lastAssistantIdx)
      }

      return prev.map((message, index) =>
        index === lastAssistantIdx
          ? { ...message, state: 'aborted' as const }
          : message,
      )
    })
    setStatus('idle')
  }, [])

  const clearChat = useCallback(() => {
    abortActiveRequest()
    setMessages([])
    setConversationId(undefined)
    setStatus('idle')
  }, [])

  return { messages, status, sendMessage, retryLastMessage, stopStreaming, clearChat, conversationId }
}
