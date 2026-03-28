import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'ai_tools_tools_visited'

export function ToolsHintBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY))

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  return (
    <div className="bg-blue-950 border border-blue-800 rounded-lg px-4 py-2 text-sm text-blue-300 flex items-center justify-between mb-4">
      <span>{t('onboarding.toolsHint')}</span>
      <button
        onClick={dismiss}
        className="text-xs text-blue-400 hover:text-blue-200 ml-4 whitespace-nowrap transition-colors"
      >
        {t('onboarding.toolsHintDismiss')} &times;
      </button>
    </div>
  )
}
