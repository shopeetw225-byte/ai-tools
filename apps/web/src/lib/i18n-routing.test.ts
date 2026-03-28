import { describe, expect, it } from 'vitest'
import {
  detectLanguageFromPath,
  getLocalizedPath,
  stripLanguagePrefix,
} from './i18n-routing'

describe('i18n routing helpers', () => {
  it('detects the language from a localized path', () => {
    expect(detectLanguageFromPath('/zh-TW/chat')).toBe('zh-TW')
    expect(detectLanguageFromPath('/zh-CN/tools')).toBe('zh-CN')
  })

  it('strips the language prefix and preserves the subpath', () => {
    expect(stripLanguagePrefix('/zh-TW/dashboard')).toBe('/dashboard')
    expect(stripLanguagePrefix('/zh-CN')).toBe('/')
  })

  it('rewrites the current route when switching languages', () => {
    expect(getLocalizedPath('/zh-TW/chat', 'zh-CN')).toBe('/zh-CN/chat')
    expect(getLocalizedPath('/zh-CN', 'zh-TW')).toBe('/zh-TW')
  })
})
