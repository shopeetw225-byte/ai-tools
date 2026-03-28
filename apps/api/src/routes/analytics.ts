/**
 * AI Gateway Analytics route
 * Exposes aggregated metrics from Cloudflare AI Gateway for the in-app dashboard.
 *
 * GET /api/v1/analytics/gateway — returns last-24h summary
 * GET /api/v1/analytics/gateway/daily — returns per-day counts for the last 7 days
 */

import { Hono } from 'hono'
import type { Env } from '../index'

const analytics = new Hono<{ Bindings: Env }>()

const CF_API = 'https://api.cloudflare.com/client/v4'
const CACHE_TTL_SECONDS = 300 // 5 minutes

interface GatewayLog {
  id: string
  created_at: string
  provider: string
  model: string
  success: boolean
  latency: number // ms
  tokens_in: number
  tokens_out: number
  cost: number
}

interface GatewayLogsResponse {
  success: boolean
  result: GatewayLog[]
  result_info: { count: number; page: number; per_page: number; total_count: number }
}

async function fetchGatewayLogs(
  accountId: string,
  gatewayId: string,
  apiToken: string,
  startTime: string,
  page = 1,
): Promise<GatewayLogsResponse> {
  const url = new URL(
    `${CF_API}/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs`,
  )
  url.searchParams.set('per_page', '1000')
  url.searchParams.set('page', String(page))
  url.searchParams.set('start_time', startTime)
  url.searchParams.set('order', 'asc')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Cloudflare API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<GatewayLogsResponse>
}

interface DailyStat {
  date: string
  requests: number
  errors: number
  totalLatency: number
  totalCost: number
}

function aggregateLogs(logs: GatewayLog[]): {
  summary: {
    totalRequests: number
    successRequests: number
    errorRequests: number
    errorRate: number
    avgLatencyMs: number
    totalCostUsd: number
    modelBreakdown: Record<string, number>
  }
  daily: Array<{
    date: string
    requests: number
    errorRate: number
    avgLatencyMs: number
    costUsd: number
  }>
} {
  const dailyMap = new Map<string, DailyStat>()

  let totalRequests = 0
  let successRequests = 0
  let errorRequests = 0
  let totalLatency = 0
  let totalCost = 0
  const modelBreakdown: Record<string, number> = {}

  for (const log of logs) {
    totalRequests++
    if (log.success) {
      successRequests++
    } else {
      errorRequests++
    }
    totalLatency += log.latency || 0
    totalCost += log.cost || 0

    const modelKey = log.model || 'unknown'
    modelBreakdown[modelKey] = (modelBreakdown[modelKey] || 0) + 1

    const date = log.created_at.slice(0, 10) // YYYY-MM-DD
    const dayStat = dailyMap.get(date) ?? {
      date,
      requests: 0,
      errors: 0,
      totalLatency: 0,
      totalCost: 0,
    }
    dayStat.requests++
    if (!log.success) dayStat.errors++
    dayStat.totalLatency += log.latency || 0
    dayStat.totalCost += log.cost || 0
    dailyMap.set(date, dayStat)
  }

  const daily = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      requests: d.requests,
      errorRate: d.requests > 0 ? d.errors / d.requests : 0,
      avgLatencyMs: d.requests > 0 ? Math.round(d.totalLatency / d.requests) : 0,
      costUsd: Math.round(d.totalCost * 1e6) / 1e6,
    }))

  return {
    summary: {
      totalRequests,
      successRequests,
      errorRequests,
      errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
      avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
      totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
      modelBreakdown,
    },
    daily,
  }
}

/**
 * Derive Cloudflare account ID and gateway ID from AI_GATEWAY_URL.
 * URL format: https://gateway.ai.cloudflare.com/v1/{account-id}/{gateway-id}
 */
function parseGatewayUrl(
  url: string,
): { accountId: string; gatewayId: string } | null {
  try {
    const parts = url.replace(/\/$/, '').split('/')
    // [..., 'v1', '{account}', '{gateway}']
    const v1Idx = parts.indexOf('v1')
    if (v1Idx < 0 || parts.length < v1Idx + 3) return null
    return { accountId: parts[v1Idx + 1], gatewayId: parts[v1Idx + 2] }
  } catch {
    return null
  }
}

// GET /api/v1/analytics/gateway
// Admin-only: exposes company-wide cost data
analytics.get('/gateway', async (c) => {
  const userId = c.get('userId' as never) as string | undefined
  const adminIds = (c.env.ADMIN_USER_IDS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
  if (!userId || (adminIds.length > 0 && !adminIds.includes(userId))) {
    return c.json({ error: 'Forbidden: admin access required' }, 403)
  }

  const apiToken = c.env.CLOUDFLARE_API_TOKEN
  const gatewayUrl = c.env.AI_GATEWAY_URL

  if (!apiToken) {
    return c.json(
      {
        error:
          'CLOUDFLARE_API_TOKEN not configured. Set it via: wrangler secret put CLOUDFLARE_API_TOKEN',
      },
      503,
    )
  }

  if (!gatewayUrl) {
    return c.json({ error: 'AI_GATEWAY_URL not configured' }, 503)
  }

  const gateway = parseGatewayUrl(gatewayUrl)
  if (!gateway) {
    return c.json({ error: 'Could not parse AI_GATEWAY_URL' }, 500)
  }

  // Check KV cache
  const cacheKey = `analytics:gateway:summary`
  const cached = await c.env.KV.get(cacheKey)
  if (cached) {
    return c.json({ cached: true, ...JSON.parse(cached) })
  }

  // Last 7 days of data
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const firstPage = await fetchGatewayLogs(
      gateway.accountId,
      gateway.gatewayId,
      apiToken,
      start,
    )

    let logs = firstPage.result

    // Fetch remaining pages if any (capped at 5000 records to avoid overload)
    const totalCount = firstPage.result_info?.total_count ?? logs.length
    const perPage = firstPage.result_info?.per_page ?? 1000
    const totalPages = Math.min(Math.ceil(totalCount / perPage), 5)

    for (let page = 2; page <= totalPages; page++) {
      const next = await fetchGatewayLogs(
        gateway.accountId,
        gateway.gatewayId,
        apiToken,
        start,
        page,
      )
      logs = logs.concat(next.result)
    }

    const result = aggregateLogs(logs)

    // Store in cache
    await c.env.KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: CACHE_TTL_SECONDS,
    })

    return c.json({ cached: false, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export default analytics
