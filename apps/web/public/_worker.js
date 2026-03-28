const SUPPORTED_LANGUAGES = new Set(['zh-TW', 'zh-CN'])

function pickLanguageFromAcceptLanguage(header) {
  if (!header) return 'zh-TW'

  const normalized = header.toLowerCase()
  if (normalized.includes('zh-cn') || normalized.includes('zh-hans')) {
    return 'zh-CN'
  }

  return 'zh-TW'
}

function isLocalizedAppPath(pathname) {
  const [, maybeLanguage] = pathname.split('/')
  return SUPPORTED_LANGUAGES.has(maybeLanguage)
}

function isAssetRequest(pathname) {
  return pathname.startsWith('/assets/') || /\/[^/]+\.[^/]+$/.test(pathname)
}

async function serveSpaEntry(request, env) {
  const url = new URL(request.url)
  url.pathname = '/index.html'
  return env.ASSETS.fetch(new Request(url.toString(), request))
}

export { pickLanguageFromAcceptLanguage, isAssetRequest, isLocalizedAppPath }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/') {
      const language = pickLanguageFromAcceptLanguage(request.headers.get('Accept-Language'))
      return Response.redirect(`${url.origin}/${language}/`, 302)
    }

    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status !== 404) {
      return assetResponse
    }

    if (isLocalizedAppPath(url.pathname) && !isAssetRequest(url.pathname)) {
      return serveSpaEntry(request, env)
    }

    return assetResponse
  },
}
