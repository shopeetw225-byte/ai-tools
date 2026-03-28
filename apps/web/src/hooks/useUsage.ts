import { useState, useEffect, useCallback } from 'react'

type UsageData = {
  used: number
  limit: number
  isPro: boolean
}

import { API_BASE } from '../lib/api'

export function useUsage() {
  const [data, setData] = useState<UsageData>({ used: 0, limit: 10, isPro: false })
  const [loading, setLoading] = useState(true)

  const fetchUsage = useCallback(async () => {
    const token = localStorage.getItem('ai_tools_token')
    if (!token) return

    try {
      const res = await fetch(`${API_BASE}/api/v1/usage/today`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = (await res.json()) as UsageData
        setData(json)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsage()
  }, [fetchUsage])

  const incrementLocal = useCallback(() => {
    setData((prev) => ({ ...prev, used: prev.used + 1 }))
  }, [])

  return { ...data, loading, refetch: fetchUsage, incrementLocal }
}
