import { describe, expect, it, vi } from 'vitest'
import {
  AIRequestError,
  AIRequestTimeoutError,
  executeWithRetry,
  streamAnthropicGateway,
} from './ai-gateway'

describe('executeWithRetry', () => {
  it('retries retryable failures with exponential backoff until success', async () => {
    const sleep = vi.fn(async () => {})
    let attempts = 0

    const result = await executeWithRetry(
      async () => {
        attempts += 1
        if (attempts < 3) {
          throw new AIRequestError('temporary upstream failure', {
            retryable: true,
            status: 503,
          })
        }

        return 'ok'
      },
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        sleep,
      },
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 200)
    expect(sleep).toHaveBeenNthCalledWith(2, 400)
  })

  it('does not retry non-retryable failures', async () => {
    let attempts = 0

    await expect(() =>
      executeWithRetry(
        async () => {
          attempts += 1
          throw new AIRequestError('bad request', {
            retryable: false,
            status: 400,
          })
        },
        { maxAttempts: 3, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({
      message: 'bad request',
      retryable: false,
      status: 400,
    })

    expect(attempts).toBe(1)
  })

  it('aborts slow operations at the timeout boundary', async () => {
    vi.useFakeTimers()

    const operation = vi.fn(
      (signal: AbortSignal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(signal.reason)
          })
        }),
    )

    const pending = executeWithRetry(operation, {
      maxAttempts: 1,
      timeoutMs: 30,
      sleep: async () => {},
    })
    const expectation = expect(pending).rejects.toBeInstanceOf(AIRequestTimeoutError)

    await vi.advanceTimersByTimeAsync(30)

    await expectation
    expect(operation).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('times out non-cooperative operations that ignore the abort signal', async () => {
    vi.useFakeTimers()

    const operation = vi.fn(
      () =>
        new Promise<never>(() => {
          // Intentionally never resolves or rejects.
        }),
    )

    const pending = executeWithRetry(operation, {
      maxAttempts: 1,
      timeoutMs: 30,
      sleep: async () => {},
    })
    const expectation = expect(pending).rejects.toBeInstanceOf(AIRequestTimeoutError)

    await vi.advanceTimersByTimeAsync(30)

    await expectation
    expect(operation).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('times out stalled Anthropic gateway streams while reading', async () => {
    vi.useFakeTimers()

    globalThis.fetch = vi.fn(async () =>
      new Response(
        new ReadableStream({
          async pull() {
            await new Promise(() => {})
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    ) as typeof fetch

    const stream = streamAnthropicGateway(
      'https://gateway.ai.cloudflare.com/v1/account/gateway',
      'test-key',
      [{ role: 'user', content: 'hello' }],
      'claude-3-haiku-20240307',
      {
        maxAttempts: 1,
        timeoutMs: 30,
        sleep: async () => {},
      },
    )

    const nextChunk = stream.next()
    const expectation = expect(nextChunk).rejects.toBeInstanceOf(AIRequestTimeoutError)

    await vi.advanceTimersByTimeAsync(30)

    await expectation

    vi.useRealTimers()
  })
})
