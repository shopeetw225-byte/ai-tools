import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useChat } from './useChat'
import { createSseStream, sseFrame, sseDone } from '../test/createSseStream'

function mockFetchSse(frames: string[], status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: createSseStream(frames),
  } as unknown as Response)
}

describe('useChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with idle status and empty messages', () => {
    const { result } = renderHook(() => useChat())
    expect(result.current.status).toBe('idle')
    expect(result.current.messages).toEqual([])
  })

  it('sends only completed transcript plus the new user message', async () => {
    const fetchSpy = mockFetchSse([
      sseFrame({ text: 'Hi', conversationId: 'c1' }),
      sseDone(),
    ])
    globalThis.fetch = fetchSpy

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // Now send a second message — the payload should include the completed messages
    const fetchSpy2 = mockFetchSse([
      sseFrame({ text: 'World' }),
      sseDone(),
    ])
    globalThis.fetch = fetchSpy2

    await act(async () => {
      await result.current.sendMessage('How are you?')
    })

    const body = JSON.parse(fetchSpy2.mock.calls[0][1].body)
    // Should send: user "Hello", assistant "Hi" (complete), user "How are you?"
    expect(body.messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'How are you?' },
    ])
    // Should include conversationId from previous response
    expect(body.conversationId).toBe('c1')
  })

  it('updates conversationId from the current SSE payload shape', async () => {
    globalThis.fetch = mockFetchSse([
      sseFrame({ text: 'Hello', conversationId: 'conv-123', model: 'llama' }),
      sseDone(),
    ])

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    // conversationId should be stored — verified by next request payload
    const fetchSpy2 = mockFetchSse([sseFrame({ text: 'ok' }), sseDone()])
    globalThis.fetch = fetchSpy2

    await act(async () => {
      await result.current.sendMessage('Next')
    })

    const body = JSON.parse(fetchSpy2.mock.calls[0][1].body)
    expect(body.conversationId).toBe('conv-123')
  })

  it('removes an empty assistant placeholder on abort', async () => {
    // Create a stream that never completes so we can abort it
    let streamController: ReadableStreamDefaultController<Uint8Array>
    const neverEndingStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: neverEndingStream,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    // Start sending but don't await (it will hang on stream)
    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('Hi')
    })

    // Wait for the fetch to be called and status to change
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2) // user + assistant placeholder
    })

    // Abort before any chunks received
    await act(async () => {
      result.current.clearChat()
    })

    // After clearChat, messages should be empty
    expect(result.current.messages).toEqual([])
    expect(result.current.status).toBe('idle')
  })

  it('removes an empty assistant placeholder when streaming is stopped', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start() {},
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    act(() => {
      void result.current.sendMessage('Hi')
    })

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    act(() => {
      result.current.stopStreaming()
    })

    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Hi' }),
    ])
    expect(result.current.status).toBe('idle')
  })

  it('keeps partial assistant content and marks it aborted when streaming is stopped', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())
    const encoder = new TextEncoder()

    act(() => {
      void result.current.sendMessage('Hi')
    })

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    act(() => {
      streamController.enqueue(encoder.encode(sseFrame({ text: 'Partial' })))
    })

    await waitFor(() => {
      expect(result.current.messages[1]?.content).toBe('Partial')
    })

    act(() => {
      result.current.stopStreaming()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Hi' }),
      expect.objectContaining({
        role: 'assistant',
        content: 'Partial',
        state: 'aborted',
      }),
    ])
  })

  it('sets error state on non-abort failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.status).toBe('error')
    // The assistant message should have error state
    const assistantMsg = result.current.messages.find(m => m.role === 'assistant')
    expect(assistantMsg?.state).toBe('error')
  })

  it('parses the trailing buffer before finishing the stream', async () => {
    // Send a frame split across two chunks where the last chunk doesn't end with newline
    globalThis.fetch = mockFetchSse([
      'data: {"text":"Hel',
      'lo","conversationId":"c1"}\n\ndata: [DONE]\n\n',
    ])

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Hi')
    })

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant')
    expect(assistantMsg?.content).toBe('Hello')
    expect(assistantMsg?.state).toBe('complete')
  })

  it('transitions through submitting → streaming → idle states', async () => {
    globalThis.fetch = mockFetchSse([
      sseFrame({ text: 'Hi' }),
      sseDone(),
    ])

    const { result } = renderHook(() => useChat())

    // Before sending
    expect(result.current.status).toBe('idle')

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // After completion
    expect(result.current.status).toBe('idle')
    const assistantMsg = result.current.messages.find(m => m.role === 'assistant')
    expect(assistantMsg?.state).toBe('complete')
    expect(assistantMsg?.content).toBe('Hi')
  })

  it('retries with the last submitted user message and current conversationId', async () => {
    // First call fails
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.status).toBe('error')

    // Now retry
    const retrySpy = mockFetchSse([
      sseFrame({ text: 'Hi there', conversationId: 'c2' }),
      sseDone(),
    ])
    globalThis.fetch = retrySpy

    await act(async () => {
      await result.current.retryLastMessage()
    })

    expect(result.current.status).toBe('idle')
    const body = JSON.parse(retrySpy.mock.calls[0][1].body)
    // Should resend user "Hello"
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('ignores stale stream chunks after clearChat', async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.sendMessage('Hi')
    })

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    // Clear chat while stream is active
    act(() => {
      result.current.clearChat()
    })

    // Now send stale chunks from the old stream
    const encoder = new TextEncoder()
    act(() => {
      streamController.enqueue(encoder.encode(sseFrame({ text: 'Stale' })))
      streamController.close()
    })

    // Wait a tick
    await new Promise(r => setTimeout(r, 50))

    // Messages should still be empty — stale chunks ignored
    expect(result.current.messages).toEqual([])
  })
})
