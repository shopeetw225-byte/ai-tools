import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthPage } from './AuthPage'
import {
  getDefaultLanguage,
  getLocalizedPath,
  isSupportedLanguage,
  supportedLanguages,
  type AppLanguage,
} from '../lib/i18n-routing'

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ lang: string }>()
  const [showAuth, setShowAuth] = useState(false)

  const currentLanguage = isSupportedLanguage(params.lang)
    ? params.lang
    : getDefaultLanguage()

  const changeLanguage = (language: AppLanguage) => {
    navigate(getLocalizedPath(location.pathname, language))
  }

  if (showAuth) {
    return <AuthPage />
  }

  const features = [
    { key: 'chat', icon: '💬' },
    { key: 'resume', icon: '📄' },
    { key: 'grammar', icon: '✏️' },
    { key: 'tools', icon: '🛠️' },
    { key: 'dashboard', icon: '📊' },
  ] as const

  const plans = [
    { key: 'free' as const, highlighted: false },
    { key: 'pro' as const, highlighted: true },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {t('app.name')}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {supportedLanguages.map((language) => (
                <button
                  key={language}
                  onClick={() => changeLanguage(language)}
                  className={`text-xs px-2 py-1 rounded border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0 ${
                    language === currentLanguage
                      ? 'border-blue-500 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {language}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm text-gray-300 hover:text-white px-4 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors min-h-[44px] sm:min-h-0"
            >
              {t('auth.login')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              {t('landing.hero.title')}
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all text-base"
            >
              {t('landing.hero.cta')}
            </button>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-3 text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 hover:text-white transition-colors text-center text-base"
            >
              {t('landing.hero.secondaryCta')}
            </a>
          </div>
          <p className="text-sm text-gray-500">{t('landing.hero.freeNote')}</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 border-t border-gray-800/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ key, icon }) => (
              <div
                key={key}
                className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-3 hover:border-gray-700 transition-colors"
              >
                <div className="text-3xl">{icon}</div>
                <h3 className="text-lg font-semibold text-white">
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t(`landing.features.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-16 border-t border-gray-800/50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-gray-400 text-center mb-12">
            {t('landing.pricing.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map(({ key, highlighted }) => (
              <div
                key={key}
                className={`rounded-2xl border p-6 space-y-4 ${
                  highlighted
                    ? 'border-blue-500 bg-gray-900/80 ring-1 ring-blue-500/30'
                    : 'border-gray-700 bg-gray-900/40'
                }`}
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {t(`pricing.${key}.name`)}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">
                      {t(`pricing.${key}.price`)}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {t(`pricing.${key}.period`)}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2">
                  {(t(`pricing.${key}.features`, { returnObjects: true }) as string[]).map(
                    (feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="text-green-400">✓</span>
                        {feature}
                      </li>
                    ),
                  )}
                </ul>

                <button
                  onClick={() => setShowAuth(true)}
                  className={`w-full py-3 font-semibold rounded-lg transition-all ${
                    highlighted
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600'
                      : 'text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {highlighted ? t('landing.pricing.cta') : t('landing.hero.cta')}
                </button>
                {highlighted && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    {t('landing.pricing.ctaNote')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center mt-6">
            {t('pricing.paymentMethods')}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-16 border-t border-gray-800/50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            {t('landing.faq.title')}
          </h2>
          <div className="space-y-3">
            {(t('landing.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>).map(
              (item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-gray-800 bg-gray-900/40 transition-colors hover:border-gray-700"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left text-white font-medium list-none [&::-webkit-details-marker]:hidden">
                    <span>{item.q}</span>
                    <span className="shrink-0 text-gray-500 transition-transform group-open:rotate-45 text-xl leading-none">
                      +
                    </span>
                  </summary>
                  <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-16 border-t border-gray-800/50 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold">
            {t('landing.finalCta.title')}
          </h2>
          <p className="text-gray-400">
            {t('landing.finalCta.subtitle')}
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all text-base"
          >
            {t('landing.hero.cta')}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-xs text-gray-500">
          &copy; 2026 貓魚印象有限公司 &middot;{' '}
          <a
            href={`/${currentLanguage}/privacy`}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('nav.privacy')}
          </a>
        </p>
      </footer>
    </div>
  )
}
