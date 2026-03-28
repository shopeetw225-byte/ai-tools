import { expect, test } from '@playwright/test'
import { loginTestUser } from './helpers'

/**
 * In-app browser detection E2E tests — verifies that payment checkout
 * shows a warning when opened inside Facebook, LINE, etc.
 */
test.describe('in-app browser detection', () => {
  const FB_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 [FBAN/FBIOS;FBAV/438.0.0.45.110;FBBV/571189867]'
  const LINE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Line/13.18.0'
  const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  test('Facebook WebView shows in-app browser warning on checkout page', async ({
    browser,
  }) => {
    const context = await browser.newContext({ userAgent: FB_UA })
    const page = await context.newPage()
    await loginTestUser(page)

    await page.goto('/zh-TW/payment/checkout?amount=100&itemName=Test&choosePayment=Credit')
    await expect(page.getByTestId('in-app-browser-warning')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('請使用外部瀏覽器')).toBeVisible()
    await context.close()
  })

  test('LINE WebView shows in-app browser warning on checkout page', async ({
    browser,
  }) => {
    const context = await browser.newContext({ userAgent: LINE_UA })
    const page = await context.newPage()
    await loginTestUser(page)

    await page.goto('/zh-TW/payment/checkout?amount=100&itemName=Test&choosePayment=Credit')
    await expect(page.getByTestId('in-app-browser-warning')).toBeVisible({ timeout: 10_000 })
    await context.close()
  })

  test('Chrome desktop does NOT show in-app browser warning', async ({
    browser,
  }) => {
    const context = await browser.newContext({ userAgent: CHROME_UA })
    const page = await context.newPage()
    await loginTestUser(page)

    await page.goto('/zh-TW/payment/checkout?amount=100&itemName=Test&choosePayment=Credit')
    // Should NOT show the warning — checkout proceeds normally
    await expect(page.getByTestId('in-app-browser-warning')).not.toBeVisible({ timeout: 5_000 })
    await context.close()
  })
})
