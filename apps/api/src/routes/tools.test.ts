import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../index'

function createDbMock() {
  return {
    prepare() {
      return {
        bind() {
          return {
            first: async () => ({ id: 'tool-run-1' }),
            run: async () => ({ success: true }),
          }
        },
      }
    },
  } as unknown as D1Database
}

function createApp(env: Env, route: Awaited<typeof import('./tools')>['default']) {
  const app = new Hono<{ Bindings: Env }>()
  app.route('/', route)
  return app
}

describe('POST /:name tools route', () => {
  it('returns a friendly error when AI inference fails', async () => {
    const { default: tools } = await import('./tools')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env = {
      DB: createDbMock(),
      KV: {} as KVNamespace,
      AI: {
        run: vi.fn(async () => {
          throw new Error('AI request timed out after 30000ms')
        }),
      } as unknown as Ai,
      ENVIRONMENT: 'test',
    } satisfies Env
    const app = createApp(env, tools)

    const res = await app.request(
      new Request('http://localhost/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'hello world',
        }),
      }),
      {},
      env,
    )

    const body = await res.json<{ error: string; detail?: string }>()

    expect(res.status).toBe(500)
    expect(body).toEqual({
      error: 'Unable to run this tool right now. Please try again.',
    })
    expect(body.detail).toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })
})
