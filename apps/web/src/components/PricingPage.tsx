import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/api'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type SubscriptionInfo = {
  plan: string
  expiresAt: string | null
  isTrial: boolean
  trialExpiresAt: string | null
  trialDaysRemaining: number | null
  trialUsed: boolean
}

export function PricingPage() {
  const { t } = useTranslation()
  const { lang } = useParams<{ lang: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/api/v1/payments/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setSubInfo(data as SubscriptionInfo))
      .catch(() => {})
  }, [token])

  const handleSubscribe = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: 99,
          itemName: 'AI Tools Pro 月費方案',
          choosePayment: 'ALL',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'trial_active') {
          setError(t('trial.cannotSubscribe'))
        } else {
          setError(data.error ?? t('errors.generic'))
        }
        return
      }

      const data = await res.json()

      // Auto-submit form to ECPay
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.serviceUrl
      for (const [key, value] of Object.entries(data.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
    } catch {
      setError(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleStartTrial = async () => {
    if (!token) return
    setTrialLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/v1/trial/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? t('errors.generic'))
        return
      }

      // Trial started — refresh subscription info and redirect to chat
      navigate(`/${lang}/chat`)
    } catch {
      setError(t('errors.generic'))
    } finally {
      setTrialLoading(false)
    }
  }

  const isCurrentlyTrial = subInfo?.isTrial === true
  const isCurrentlyPro = subInfo?.plan === 'pro' && !subInfo.isTrial
  const canTrial = !subInfo?.trialUsed && subInfo?.plan !== 'pro'

  const plans = [
    {
      key: 'free' as const,
      highlighted: false,
    },
    {
      key: 'pro' as const,
      highlighted: true,
    },
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('pricing.title')}</h1>
        <p className="text-gray-400">{t('pricing.subtitle')}</p>
      </div>

      {/* Trial expiry warning banner */}
      {isCurrentlyTrial && subInfo?.trialDaysRemaining != null && subInfo.trialDaysRemaining <= 1 && (
        <div className="w-full max-w-2xl bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3 text-center">
          <p className="text-amber-300 text-sm font-medium">
            {t('trial.expiringBanner', { days: subInfo.trialDaysRemaining })}
          </p>
        </div>
      )}

      {/* Active trial info banner */}
      {isCurrentlyTrial && subInfo?.trialDaysRemaining != null && subInfo.trialDaysRemaining > 1 && (
        <div className="w-full max-w-2xl bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-3 text-center">
          <p className="text-blue-300 text-sm font-medium">
            {t('trial.activeBanner', { days: subInfo.trialDaysRemaining })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
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

            {highlighted ? (
              <div className="space-y-2">
                <button
                  onClick={handleSubscribe}
                  disabled={loading || isCurrentlyTrial || isCurrentlyPro}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                >
                  {loading ? t('auth.submitLoading') : isCurrentlyPro ? t('pricing.currentPlan') : isCurrentlyTrial ? t('trial.inProgress') : t(`pricing.${key}.cta`)}
                </button>
                {canTrial && (
                  <button
                    onClick={handleStartTrial}
                    disabled={trialLoading}
                    className="w-full py-2.5 text-blue-400 border border-blue-500/40 rounded-lg text-sm font-medium hover:bg-blue-500/10 transition-all disabled:opacity-50"
                  >
                    {trialLoading ? t('auth.submitLoading') : t('trial.cta')}
                  </button>
                )}
                {subInfo?.trialUsed && !isCurrentlyTrial && !isCurrentlyPro && (
                  <p className="text-xs text-gray-500 text-center">{t('trial.alreadyUsed')}</p>
                )}
              </div>
            ) : (
              <div className="w-full py-3 text-center text-gray-500 border border-gray-700 rounded-lg text-sm">
                {t(`pricing.${key}.cta`)}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">{t('pricing.paymentMethods')}</p>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <button
        onClick={() => navigate(`/${lang}/chat`)}
        className="text-gray-400 text-sm hover:text-gray-200 transition-colors"
      >
        {t('payment.back')}
      </button>
    </div>
  )
}
