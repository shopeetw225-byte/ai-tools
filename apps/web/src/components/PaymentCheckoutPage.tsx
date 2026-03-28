import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

type EcpayFields = Record<string, string | number>

type CreateOrderResponse = {
  orderId: string
  method: string
  serviceUrl: string
  fields: EcpayFields
}

export function PaymentCheckoutPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const [orderData, setOrderData] = useState<CreateOrderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const amount = parseInt(searchParams.get('amount') ?? '0', 10)
  const itemName = searchParams.get('itemName') ?? ''
  const choosePayment = searchParams.get('choosePayment') ?? 'Credit'

  useEffect(() => {
    if (!amount || !itemName) {
      setError(t('payment.checkout.missingParams'))
      setLoading(false)
      return
    }

    const token = localStorage.getItem('session_token')
    if (!token) {
      setError(t('payment.checkout.notLoggedIn'))
      setLoading(false)
      return
    }

    fetch('/api/v1/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, itemName, choosePayment }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json() as { error?: string }
          throw new Error(body.error ?? t('payment.checkout.createFailed'))
        }
        return res.json() as Promise<CreateOrderResponse>
      })
      .then((data) => {
        setOrderData(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [amount, itemName, choosePayment, t])

  // Auto-submit form when order data is ready
  useEffect(() => {
    if (orderData && formRef.current) {
      formRef.current.submit()
    }
  }, [orderData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">{t('payment.checkout.preparing')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => window.history.back()}
            className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg border border-gray-700"
          >
            {t('payment.back')}
          </button>
        </div>
      </div>
    )
  }

  if (!orderData) return null

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-gray-400 text-sm mb-2">{t('payment.checkout.redirecting')}</div>
        <div className="text-xs text-gray-600">{t('payment.checkout.doNotClose')}</div>
        {/* Hidden form — auto-submitted via useEffect */}
        <form
          ref={formRef}
          action={orderData.serviceUrl}
          method="POST"
          className="hidden"
        >
          {Object.entries(orderData.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={String(value)} />
          ))}
        </form>
      </div>
    </div>
  )
}
