import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

interface OnboardingModalProps {
  onComplete: () => void
}

const FEATURES = [
  { icon: '\uD83D\uDCAC', titleKey: 'onboarding.feature.chat.title', descKey: 'onboarding.feature.chat.desc' },
  { icon: '\u26A1', titleKey: 'onboarding.feature.tools.title', descKey: 'onboarding.feature.tools.desc' },
  { icon: '\uD83D\uDCCA', titleKey: 'onboarding.feature.dashboard.title', descKey: 'onboarding.feature.dashboard.desc' },
] as const

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'zh-TW'

  const handleCta = () => {
    localStorage.setItem('ai_tools_onboarded', 'true')
    onComplete()
    navigate(`/${lang}/tools`)
  }

  const handleSkip = () => {
    localStorage.setItem('ai_tools_onboarded', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">{t('onboarding.title')}</h2>
          <p className="text-sm text-gray-400">{t('onboarding.subtitle')}</p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <div className="text-sm font-medium text-white">{t(f.titleKey)}</div>
                <div className="text-xs text-gray-400">{t(f.descKey)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleCta}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition-all"
          >
            {t('onboarding.cta')}
          </button>
          <button
            onClick={handleSkip}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {t('onboarding.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
