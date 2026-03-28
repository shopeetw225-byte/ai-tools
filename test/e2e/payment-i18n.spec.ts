import { expect, test } from '@playwright/test'
import { loginTestUser } from './helpers'

/**
 * Payment page i18n validation — confirms zh-TW and zh-CN render correctly.
 */
test.describe('payment page i18n', () => {
  test.describe('payment result page', () => {
    test('zh-TW: renders pending state in traditional Chinese', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-TW/payment/result?status=pending')
      await expect(page.getByText('付款處理中')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('返回儀表板')).toBeVisible()
    })

    test('zh-CN: renders pending state in simplified Chinese', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-CN/payment/result?status=pending')
      await expect(page.getByText('付款处理中')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('返回仪表盘')).toBeVisible()
    })

    test('zh-TW: renders success state', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-TW/payment/result?status=success')
      await expect(page.getByText('付款成功')).toBeVisible({ timeout: 10_000 })
    })

    test('zh-CN: renders success state', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-CN/payment/result?status=success')
      await expect(page.getByText('付款成功')).toBeVisible({ timeout: 10_000 })
    })

    test('zh-TW: renders failed state', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-TW/payment/result?status=failed')
      await expect(page.getByText('付款失敗')).toBeVisible({ timeout: 10_000 })
    })

    test('zh-CN: renders failed state', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-CN/payment/result?status=failed')
      await expect(page.getByText('付款失败')).toBeVisible({ timeout: 10_000 })
    })

    test('dashboard link preserves current language', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-CN/payment/result?status=success')
      const link = page.getByText('返回仪表盘')
      await expect(link).toBeVisible({ timeout: 10_000 })
      await expect(link).toHaveAttribute('href', /\/zh-CN\/dashboard/)
    })
  })

  test.describe('payment checkout page', () => {
    test('zh-TW: shows missing params error in traditional Chinese', async ({ page }) => {
      await loginTestUser(page)
      // Navigate without required params
      await page.goto('/zh-TW/payment/checkout')
      await expect(page.getByText('缺少付款資訊')).toBeVisible({ timeout: 10_000 })
    })

    test('zh-CN: shows missing params error in simplified Chinese', async ({ page }) => {
      await loginTestUser(page)
      await page.goto('/zh-CN/payment/checkout')
      await expect(page.getByText('缺少付款信息')).toBeVisible({ timeout: 10_000 })
    })
  })
})
