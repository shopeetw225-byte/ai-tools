import { describe, expect, it } from 'vitest'
import app, { type Env } from './index'

function createEnv(): Env {
  return {
    DB: {} as D1Database,
    KV: {} as KVNamespace,
    AI: {} as Ai,
    ENVIRONMENT: 'test',
  }
}

describe('root locale redirect', () => {
  it('redirects / to zh-CN when Accept-Language prefers zh-CN', async () => {
    const env = createEnv()

    const res = await app.request(
      new Request('http://localhost/', {
        headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      }),
      {},
      env,
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/zh-CN/')
  })

  it('redirects / to zh-TW when Accept-Language is missing or unsupported', async () => {
    const env = createEnv()

    const res = await app.request(new Request('http://localhost/'), {}, env)

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/zh-TW/')
  })
})
