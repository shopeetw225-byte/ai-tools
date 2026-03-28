const IN_APP_PATTERNS = [
  /FBAN|FBAV/i, // Facebook
  /\bLine\b/i, // LINE
  /Instagram/i, // Instagram
  /MicroMessenger/i, // WeChat
  /Twitter/i, // Twitter / X
]

export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return IN_APP_PATTERNS.some((pattern) => pattern.test(ua))
}

export function getInAppBrowserName(userAgent?: string): string | null {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook'
  if (/\bLine\b/i.test(ua)) return 'LINE'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/MicroMessenger/i.test(ua)) return 'WeChat'
  if (/Twitter/i.test(ua)) return 'Twitter'
  return null
}
