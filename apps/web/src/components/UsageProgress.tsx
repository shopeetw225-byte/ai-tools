import { useTranslation } from 'react-i18next'

interface UsageProgressProps {
  used: number
  limit: number
  isPro: boolean
  isTrial?: boolean
  trialDaysRemaining?: number | null
}

export function UsageProgress({ used, limit, isPro, isTrial, trialDaysRemaining }: UsageProgressProps) {
  const { t } = useTranslation()

  if (isTrial && trialDaysRemaining != null) {
    return (
      <span className="text-xs text-blue-400 font-medium">
        {t('trial.badge', { days: trialDaysRemaining })}
      </span>
    )
  }

  if (isPro) return null

  const remaining = limit - used
  const isWarning = used >= 8 && used < limit

  if (isWarning) {
    return (
      <span className="text-xs text-amber-400 font-medium">
        {'\u26A0\uFE0F'} {t('usage.warningShort', { remaining })}
      </span>
    )
  }

  return (
    <span className="text-xs text-gray-400">
      {t('usage.counter', { used, limit })}
    </span>
  )
}
