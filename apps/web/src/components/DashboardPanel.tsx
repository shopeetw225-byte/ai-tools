import { useAnalytics } from '../hooks/useAnalytics'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { data, loading, error, refresh } = useAnalytics()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-500 text-sm">{t('loading.analytics')}</span>
      </div>
    )
  }

  if (error) {
    const isNotConfigured = error.toLowerCase().includes('cloudflare_api_token')
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">📊</div>
        <div className="text-gray-300 text-sm font-medium">
          {isNotConfigured ? t('dashboard.notConfigured') : t('dashboard.loadError')}
        </div>
        {isNotConfigured ? (
          <div className="text-gray-500 text-xs max-w-sm leading-relaxed">
            {t('dashboard.notConfiguredHelp')}
            <code className="block mt-2 bg-gray-800 rounded px-3 py-2 text-green-400 text-left whitespace-pre">
              {'cd apps/api\nwrangler secret put CLOUDFLARE_API_TOKEN'}
            </code>
            <span className="block mt-1">
              {t('dashboard.tokenPermission')}
            </span>
          </div>
        ) : (
          <div className="text-red-400 text-xs">{error}</div>
        )}
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          {t('dashboard.retry')}
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
          <h2 className="text-sm font-semibold text-gray-200">{t('dashboard.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
        >
          {t('dashboard.refresh')}
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label={t('dashboard.metrics.totalRequests')}
          value={summary.totalRequests.toLocaleString()}
          sub={t('dashboard.metrics.totalRequestsSub')}
          accent="blue"
        />
        <MetricCard
          label={t('dashboard.metrics.avgLatency')}
          value={`${summary.avgLatencyMs.toLocaleString()} ms`}
          sub={t('dashboard.metrics.avgLatencySub')}
          accent={summary.avgLatencyMs > 3000 ? 'red' : summary.avgLatencyMs > 1500 ? 'yellow' : 'green'}
        />
        <MetricCard
          label={t('dashboard.metrics.errorRate')}
          value={`${errorPct}%`}
          sub={t('dashboard.metrics.errorRateSub', { count: summary.errorRequests })}
          accent={summary.errorRate > 0.05 ? 'red' : summary.errorRate > 0.01 ? 'yellow' : 'green'}
        />
        <MetricCard
          label={t('dashboard.metrics.totalCost')}
          value={`$${summary.totalCostUsd.toFixed(4)}`}
          sub={t('dashboard.metrics.totalCostSub')}
          accent="yellow"
        />
      </div>

      {/* Daily request chart */}
      {daily.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-4">
            {t('dashboard.dailyVolume')}
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
                  {(d.errorRate * 100).toFixed(1)}{t('dashboard.errorSuffix')}
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
            {t('dashboard.modelUsage')}
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
        <p className="text-xs text-gray-600 text-right">{t('dashboard.cached')}</p>
      )}
    </div>
  )
}
