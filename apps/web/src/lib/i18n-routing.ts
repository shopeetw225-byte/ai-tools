export const supportedLanguages = ['zh-TW', 'zh-CN'] as const

export type AppLanguage = (typeof supportedLanguages)[number]

const defaultLanguage: AppLanguage = 'zh-TW'

export function isSupportedLanguage(value: string | undefined): value is AppLanguage {
  return supportedLanguages.includes(value as AppLanguage)
}

export function detectLanguageFromPath(pathname: string): AppLanguage | null {
  const [, maybeLanguage] = pathname.split('/')
  return isSupportedLanguage(maybeLanguage) ? maybeLanguage : null
}

export function stripLanguagePrefix(pathname: string): string {
  const detectedLanguage = detectLanguageFromPath(pathname)
  if (!detectedLanguage) return pathname || '/'

  const stripped = pathname.slice(`/${detectedLanguage}`.length)
  return stripped || '/'
}

export function getLocalizedPath(pathname: string, language: AppLanguage): string {
  const stripped = stripLanguagePrefix(pathname)
  return stripped === '/' ? `/${language}` : `/${language}${stripped}`
}

export function getDefaultLanguage(): AppLanguage {
  return defaultLanguage
}
