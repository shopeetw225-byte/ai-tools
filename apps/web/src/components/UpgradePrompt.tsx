import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

type UpgradePromptProps = {
  count: number
  limit: number
  onDismiss: () => void
}

export function UpgradePrompt({ count, limit, onDismiss }: UpgradePromptProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useParams<{ lang: string }>()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-white">
            {t('upgrade.title')}
          </h2>
          <p className="text-gray-400 text-sm">
            {t('upgrade.description', { count, limit })}
          </p>
        </div>

        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-red-500 h-2 rounded-full"
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/${lang}/pricing`)}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all"
          >
            {t('upgrade.cta')}
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-200 transition-colors"
          >
            {t('upgrade.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
