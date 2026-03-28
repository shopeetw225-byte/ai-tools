import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { UpgradePrompt } from './UpgradePrompt'
import { API_BASE } from '../lib/api'

const MIN_CHARS = 50
const MAX_CHARS = 5000

type ResumeUsage = {
  resumeToday: number
  resumeLimit: number | null
  totalToday: number
  totalLimit: number | null
}

type ResumeResponse = {
  output?: string
  suggestions?: string[]
  tool_run_id?: string
  usage?: ResumeUsage
  error?: string
  message?: string
  upgradeUrl?: string
}

export function ResumeOptimizer() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [input, setInput] = useState('')
  const [targetPosition, setTargetPosition] = useState('')
  const [output, setOutput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [usage, setUsage] = useState<ResumeUsage | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const inputLength = input.length
  const isUnderMin = inputLength > 0 && inputLength < MIN_CHARS
  const isOverMax = inputLength > MAX_CHARS

  const handleOptimize = async () => {
    if (!input.trim() || loading || isUnderMin || isOverMax) return
    setLoading(true)
    setOutput('')
    setSuggestions([])
    setError('')

    try {
      const options: Record<string, string> = {}
      if (targetPosition.trim()) {
        options.targetPosition = targetPosition.trim()
      }

      const res = await fetch(`${API_BASE}/api/v1/tools/resume-optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input, options }),
      })

      const data = (await res.json()) as ResumeResponse

      if (data.error === 'resume_quota_exceeded' || data.error === 'quota_exceeded') {
        setShowUpgrade(true)
        return
      }

      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? t('errors.generic'))
        return
      }

      setOutput(data.output ?? '')
      setSuggestions(data.suggestions ?? [])
      if (data.usage) setUsage(data.usage)
    } catch (err) {
      setError(t('errors.generic'))
      console.error('resume optimize error', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output])

  return (
    <div className="flex flex-col h-full py-4 sm:py-6">
      {/* Header */}
      <div className="px-4 pb-4 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{t('resume.title')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('resume.subtitle')}</p>
          </div>
          {usage && usage.resumeLimit !== null && (
            <div className="text-xs text-gray-500">
              {t('resume.quota', { used: usage.resumeToday, limit: usage.resumeLimit })}
            </div>
          )}
        </div>
      </div>

      {/* Main content — two columns on desktop, stacked on mobile */}
      <div className="flex-1 flex flex-col gap-4 px-4 overflow-y-auto lg:flex-row sm:px-0">
        {/* Input panel */}
        <div className="flex flex-col gap-3 lg:w-1/2">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('resume.placeholder')}
              rows={12}
              className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 resize-none ${
                isOverMax
                  ? 'focus:ring-red-500 border border-red-700/50'
                  : isUnderMin
                    ? 'focus:ring-yellow-500 border border-yellow-700/50'
                    : 'focus:ring-blue-500'
              }`}
            />
            <div
              className={`absolute bottom-2 right-3 text-xs ${
                isOverMax ? 'text-red-400' : isUnderMin ? 'text-yellow-400' : 'text-gray-600'
              }`}
            >
              {inputLength.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </div>
          </div>

          {isUnderMin && (
            <p className="text-xs text-yellow-400">
              {t('resume.minChars', { min: MIN_CHARS, current: inputLength })}
            </p>
          )}
          {isOverMax && (
            <p className="text-xs text-red-400">
              {t('resume.maxChars', { max: MAX_CHARS.toLocaleString() })}
            </p>
          )}

          <input
            type="text"
            value={targetPosition}
            onChange={(e) => setTargetPosition(e.target.value)}
            placeholder={t('resume.targetPositionPlaceholder')}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            onClick={handleOptimize}
            disabled={!input.trim() || loading || isUnderMin || isOverMax}
            className="min-h-[44px] w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-0"
          >
            {loading ? t('resume.optimizing') : t('resume.optimize')}
          </button>

          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Output panel */}
        <div className="flex flex-col gap-3 lg:w-1/2">
          {loading && (
            <div className="flex-1 flex items-center justify-center bg-gray-800/50 rounded-xl min-h-[200px]">
              <div className="text-center space-y-2">
                <div className="text-2xl animate-pulse">&#9998;</div>
                <p className="text-sm text-gray-400">{t('resume.analyzing')}</p>
              </div>
            </div>
          )}

          {!loading && output && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {t('resume.result')}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                  >
                    {copied ? t('tools.copied') : t('tools.copy')}
                  </button>
                </div>
                <div className="rounded-xl bg-gray-800 px-4 py-3 text-sm text-gray-100 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {output}
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {t('resume.suggestions')}
                  </p>
                  <div className="rounded-xl bg-gray-800/60 px-4 py-3 space-y-2">
                    {suggestions.map((s, i) => (
                      <div key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-indigo-400 shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !output && !error && (
            <div className="flex-1 flex items-center justify-center bg-gray-800/30 rounded-xl min-h-[200px] border border-dashed border-gray-700">
              <div className="text-center space-y-2 px-6">
                <div className="text-3xl">&#128196;</div>
                <p className="text-sm text-gray-500">{t('resume.emptyHint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpgrade && (
        <UpgradePrompt
          count={usage?.resumeToday ?? 2}
          limit={usage?.resumeLimit ?? 2}
          onDismiss={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
