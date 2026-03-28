import { useAnalytics } from '../hooks/useAnalytics'

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'red' | 'green' | 'blue' | 'yellow'
}) {
  const accentClass =
    accent === 'red'
      ? 'text-red-400'
      : accent === 'green'
        ? 'text-green-400'
        : accent === 'yellow'
          ? 'text-yellow-400'
          : 'text-blue-400'

  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold font-mono ${accentClass}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function DashboardPanel() {
  const { data, loading, error, refresh } = useAnalytics()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading analytics…</span>
      </div>
    )
  }

  if (error) {
    const isNotConfigured = error.toLowerCase().includes('cloudflare_api_token')
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">📊</div>
        <div className="text-gray-300 text-sm font-medium">
          {isNotConfigured ? 'Analytics not configured' : 'Failed to load analytics'}
        </div>
        {isNotConfigured ? (
          <div className="text-gray-500 text-xs max-w-sm leading-relaxed">
            Set your Cloudflare API token to enable AI Gateway analytics:
            <code className="block mt-2 bg-gray-800 rounded px-3 py-2 text-green-400 text-left whitespace-pre">
              {'cd apps/api\nwrangler secret put CLOUDFLARE_API_TOKEN'}
            </code>
            <span className="block mt-1">
              Token needs <strong>AI Gateway: Read</strong> permission.
            </span>
          </div>
        ) : (
          <div className="text-red-400 text-xs">{error}</div>
        )}
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const { summary, daily } = data
  const errorPct = (summary.errorRate * 100).toFixed(1)
  const maxRequests = Math.max(...daily.map((d) => d.requests), 1)

  const topModels = Object.entries(summary.modelBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">AI Gateway</h2>
          <p className="text-xs text-gray-500 mt-0.5">Last 7 days · Cloudflare AI Gateway Analytics</p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Total Requests"
          value={summary.totalRequests.toLocaleString()}
          sub="7-day total"
          accent="blue"
        />
        <MetricCard
          label="Avg Latency"
          value={`${summary.avgLatencyMs.toLocaleString()} ms`}
          sub="mean response time"
          accent={summary.avgLatencyMs > 3000 ? 'red' : summary.avgLatencyMs > 1500 ? 'yellow' : 'green'}
        />
        <MetricCard
          label="Error Rate"
          value={`${errorPct}%`}
          sub={`${summary.errorRequests} failed`}
          accent={summary.errorRate > 0.05 ? 'red' : summary.errorRate > 0.01 ? 'yellow' : 'green'}
        />
        <MetricCard
          label="Total Cost"
          value={`$${summary.totalCostUsd.toFixed(4)}`}
          sub="estimated USD"
          accent="yellow"
        />
      </div>

      {/* Daily request chart */}
      {daily.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
            Daily Request Volume
          </h3>
          <div className="space-y-2">
            {daily.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 font-mono">{d.date}</span>
                <div className="flex-1">
                  <MiniBar value={d.requests} max={maxRequests} />
                </div>
                <span className="text-xs text-gray-400 w-14 text-right font-mono">
                  {d.requests.toLocaleString()}
                </span>
                <span
                  className={`text-xs w-14 text-right font-mono ${
                    d.errorRate > 0.05
                      ? 'text-red-400'
                      : d.errorRate > 0.01
                        ? 'text-yellow-400'
                        : 'text-gray-600'
                  }`}
                >
                  {(d.errorRate * 100).toFixed(1)}% err
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model breakdown */}
      {topModels.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
            Model Usage
          </h3>
          <div className="space-y-2">
            {topModels.map(([model, count]) => (
              <div key={model} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex-1 truncate font-mono">{model}</span>
                <div className="w-32">
                  <MiniBar value={count} max={topModels[0][1]} />
                </div>
                <span className="text-xs text-gray-400 w-12 text-right font-mono">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.cached && (
        <p className="text-xs text-gray-600 text-right">Cached — refreshes every 5 min</p>
      )}
    </div>
  )
}
