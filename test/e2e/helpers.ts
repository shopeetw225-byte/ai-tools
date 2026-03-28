import type { Page } from '@playwright/test'

const API_URL = 'http://localhost:8787'

/** Register and login a fresh test user, storing the session cookie. */
export async function loginTestUser(page: Page, email?: string): Promise<{
  email: string
  password: string
}> {
  const uniqueEmail = email ?? `e2e-${Date.now()}@test.local`
  const password = 'TestPassword123!'

  // Register via API
  const registerRes = await page.request.post(`${API_URL}/api/v1/auth/register`, {
    data: { email: uniqueEmail, password, name: 'E2E Tester' },
  })

  if (registerRes.status() === 409) {
    // User exists — just login
    const loginRes = await page.request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: uniqueEmail, password },
    })

    const body = await loginRes.json()
    await page.evaluate(
      (token: string) => localStorage.setItem('session', token),
      body.sessionId,
    )
  } else {
    const body = await registerRes.json()
    await page.evaluate(
      (token: string) => localStorage.setItem('session', token),
      body.sessionId,
    )
  }

  return { email: uniqueEmail, password }
}
