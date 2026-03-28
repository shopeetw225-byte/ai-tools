import { describe, expect, it } from 'vitest'
import { isInAppBrowser, getInAppBrowserName } from './in-app-browser'

describe('isInAppBrowser', () => {
  it('detects Facebook iOS WebView', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) [FBAN/FBIOS;FBAV/438.0.0]'
    expect(isInAppBrowser(ua)).toBe(true)
  })

  it('detects Facebook Android WebView', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 FBAN/FB4A;FBAV/438.0.0'
    expect(isInAppBrowser(ua)).toBe(true)
  })

  it('detects LINE WebView', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/21A329 Line/13.18.0'
    expect(isInAppBrowser(ua)).toBe(true)
  })

  it('detects Instagram WebView', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/21A329 Instagram 312.0'
    expect(isInAppBrowser(ua)).toBe(true)
  })

  it('returns false for Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    expect(isInAppBrowser(ua)).toBe(false)
  })

  it('returns false for Chrome', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(isInAppBrowser(ua)).toBe(false)
  })
})

describe('getInAppBrowserName', () => {
  it('returns Facebook for FBAN UA', () => {
    expect(getInAppBrowserName('FBAN/FBIOS')).toBe('Facebook')
  })

  it('returns LINE for Line UA', () => {
    expect(getInAppBrowserName('Mobile Line/13.18.0')).toBe('LINE')
  })

  it('returns Instagram for Instagram UA', () => {
    expect(getInAppBrowserName('Mobile Instagram 312.0')).toBe('Instagram')
  })

  it('returns null for Chrome', () => {
    expect(getInAppBrowserName('Chrome/120.0.0.0 Safari/537.36')).toBeNull()
  })
})
