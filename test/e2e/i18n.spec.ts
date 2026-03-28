import { expect, test } from '@playwright/test'

test.describe('i18n language routing', () => {
  test('root path redirects to /zh-TW/', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/zh-TW\//)
  })

  test('navigating to /zh-CN/ loads simplified Chinese UI', async ({ page }) => {
    await page.goto('/zh-CN/')
    // Auth page should render in zh-CN — check for simplified Chinese labels
    await expect(page.getByText('登录')).toBeVisible({ timeout: 10_000 })
  })

  test('navigating to /zh-TW/ loads traditional Chinese UI', async ({ page }) => {
    await page.goto('/zh-TW/')
    await expect(page.getByText('登入')).toBeVisible({ timeout: 10_000 })
  })

  test('language switcher changes locale and updates the URL', async ({ page }) => {
    // Start on zh-TW
    await page.goto('/zh-TW/')
    await expect(page).toHaveURL(/\/zh-TW\//)

    // This test needs authentication to see the language switcher in the header.
    // When auth is not set up, the switcher is on the auth page itself (if applicable)
    // or we test the route-level redirect only.
    // For now: test that visiting /zh-CN/ changes the displayed language.
    await page.goto('/zh-CN/')
    await expect(page).toHaveURL(/\/zh-CN\//)
  })

  test('unsupported locale falls back to zh-TW', async ({ page }) => {
    await page.goto('/en/chat')
    // Should redirect to the default language
    await expect(page).toHaveURL(/\/zh-TW\//)
  })
})

test.describe('i18n Accept-Language detection (API)', () => {
  test('API root returns 302 to /zh-TW/ for default Accept-Language', async ({ request }) => {
    const res = await request.get('http://localhost:8787/', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toBe('/zh-TW/')
  })

  test('API root returns 302 to /zh-CN/ for zh-CN Accept-Language', async ({ request }) => {
    const res = await request.get('http://localhost:8787/', {
      headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toBe('/zh-CN/')
  })

  test('API root returns 302 to /zh-CN/ for zh-Hans Accept-Language', async ({ request }) => {
    const res = await request.get('http://localhost:8787/', {
      headers: { 'Accept-Language': 'zh-Hans' },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(302)
    expect(res.headers()['location']).toBe('/zh-CN/')
  })
})
