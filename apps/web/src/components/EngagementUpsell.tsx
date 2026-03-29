import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

type EngagementUpsellProps = {
  streak: number
  trialUsed: boolean
  onDismiss: () => void
}

export function EngagementUpsell({ streak, trialUsed, onDismiss }: EngagementUpsellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useParams<{ lang: string }>()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔥</div>
          <h2 className="text-xl font-bold text-white">
            {t('engagementUpsell.title', { streak })}
          </h2>
          <p className="text-gray-400 text-sm">
            {t('engagementUpsell.description')}
          </p>
        </div>

        <div className="flex justify-center gap-1">
          {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-xs font-bold">
              {i + 1}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/${lang}/pricing`)}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
          >
            {trialUsed ? t('engagementUpsell.cta') : t('engagementUpsell.ctaTrial')}
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-200 transition-colors"
          >
            {t('engagementUpsell.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
