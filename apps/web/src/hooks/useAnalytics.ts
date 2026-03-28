import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface DailyMetric {
  date: string
  requests: number
  errorRate: number
  avgLatencyMs: number
  costUsd: number
}

export interface GatewaySummary {
  totalRequests: number
  successRequests: number
  errorRequests: number
  errorRate: number
  avgLatencyMs: number
  totalCostUsd: number
  modelBreakdown: Record<string, number>
}

export interface AnalyticsData {
  cached: boolean
  summary: GatewaySummary
  daily: DailyMetric[]
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/analytics/gateway`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as AnalyticsData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return { data, loading, error, refresh: fetchAnalytics }
}
