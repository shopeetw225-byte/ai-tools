import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/api'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { isSupportedLanguage, getDefaultLanguage } from '../lib/i18n-routing'

type OrderStatus = 'pending' | 'paid' | 'failed' | 'error' | 'success'

export function PaymentResultPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const params = useParams<{ lang: string }>()
  const lang = isSupportedLanguage(params.lang) ? params.lang : getDefaultLanguage()

  const orderId = searchParams.get('orderId')
  const initialStatus = (searchParams.get('status') ?? 'pending') as OrderStatus

  const [status, setStatus] = useState<OrderStatus>(initialStatus)
  const [pollCount, setPollCount] = useState(0)

  // Poll order status if pending (webhook may arrive shortly after browser redirect)
  useEffect(() => {
    if (status !== 'pending' || !orderId || pollCount >= 10) return

    const token = localStorage.getItem('session_token')
    if (!token) {
      setStatus('error')
      return
    }

    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/v1/payments/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json() as { status: string }
          if (data.status === 'paid') setStatus('success')
          else if (data.status === 'failed') setStatus('failed')
          else setPollCount((n) => n + 1)
        })
        .catch(() => {
          setPollCount((n) => n + 1)
        })
    }, 2000)

    return () => clearTimeout(timer)
  }, [status, orderId, pollCount])

  const isSuccess = status === 'success' || status === 'paid'
  const isFailed = status === 'failed' || status === 'error'
  const isPending = status === 'pending'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-sm w-full mx-auto px-6">
        {isPending && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-white text-xl font-semibold mb-2">
              {t('payment.result.pending.title')}
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {t('payment.result.pending.subtitle')}
            </p>
          </>
        )}

        {isSuccess && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-white text-xl font-semibold mb-2">
              {t('payment.result.success.title')}
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {t('payment.result.success.subtitle')}
            </p>
          </>
        )}

        {isFailed && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-white text-xl font-semibold mb-2">
              {t('payment.result.failed.title')}
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {t('payment.result.failed.subtitle')}
            </p>
          </>
        )}

        <Link
          to={`/${lang}/dashboard`}
          className="inline-block text-sm text-blue-400 hover:text-blue-300 px-4 py-2 rounded-lg border border-blue-800 hover:border-blue-600 transition-colors"
        >
          {t('payment.result.goToDashboard')}
        </Link>
      </div>
    </div>
  )
}
