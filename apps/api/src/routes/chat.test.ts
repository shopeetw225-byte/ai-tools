import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../index'

function createDbMock() {
  return {
    prepare() {
      return {
        bind() {
          return {
            first: async () => ({ id: 'conv-1' }),
            run: async () => ({ success: true }),
          }
        },
      }
    },
  } as unknown as D1Database
}

function createApp(env: Env, route: Awaited<typeof import('./chat')>['default']) {
  const app = new Hono<{ Bindings: Env }>()
  app.route('/', route)
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('../lib/ai-gateway')
})

describe('POST / chat route', () => {
  it('streams a friendly fallback message when the AI request fails', async () => {
    const { default: chat } = await import('./chat')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = {
      DB: createDbMock(),
      KV: {} as KVNamespace,
      AI: {
        run: vi.fn(async () => {
          throw new Error('upstream socket hang up')
        }),
      } as unknown as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    const app = createApp(env, chat)

    const res = await app.request(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      }),
      {},
      env,
    )

    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    expect(body).toContain("Sorry, I couldn't generate a response right now. Please try again.")
    expect(body).toContain('data: [DONE]')
    expect(body).not.toContain('upstream socket hang up')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('times out hung Workers AI requests and returns the friendly fallback', async () => {
    vi.doMock('../lib/ai-gateway', async () => {
      const actual = await vi.importActual<typeof import('../lib/ai-gateway')>(
        '../lib/ai-gateway',
      )

      return {
        ...actual,
        AI_REQUEST_TIMEOUT_MS: 10,
        AI_MAX_ATTEMPTS: 1,
      }
    })

    const { default: chat } = await import('./chat')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = {
      DB: createDbMock(),
      KV: {} as KVNamespace,
      AI: {
        run: vi.fn(
          () =>
            new Promise<never>(() => {
              // Simulate a Workers AI binding call that never settles.
            }),
        ),
      } as unknown as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    const app = createApp(env, chat)

    const res = await app.request(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      }),
      {},
      env,
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain("Sorry, I couldn't generate a response right now. Please try again.")
    expect(body).toContain('data: [DONE]')
    expect(errorSpy).toHaveBeenCalled()
  }, 10_000)

  it('times out stalled Workers AI streams and returns the friendly fallback', async () => {
    vi.doMock('../lib/ai-gateway', async () => {
      const actual = await vi.importActual<typeof import('../lib/ai-gateway')>(
        '../lib/ai-gateway',
      )

      return {
        ...actual,
        AI_REQUEST_TIMEOUT_MS: 10,
      }
    })

    const { default: chat } = await import('./chat')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = {
      DB: createDbMock(),
      KV: {} as KVNamespace,
      AI: {
        run: vi.fn(
          async () =>
            new ReadableStream({
              async pull() {
                await new Promise(() => {})
              },
            }),
        ),
      } as unknown as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    const app = createApp(env, chat)

    const res = await app.request(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      }),
      {},
      env,
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain("Sorry, I couldn't generate a response right now. Please try again.")
    expect(body).toContain('data: [DONE]')
    expect(errorSpy).toHaveBeenCalled()
  }, 10_000)
})
