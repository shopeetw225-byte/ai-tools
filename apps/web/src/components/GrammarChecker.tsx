import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { UpgradePrompt } from './UpgradePrompt'
import { API_BASE } from '../lib/api'

const MAX_CHARS = 3000

type GrammarCorrection = {
  original: string
  corrected: string
  explanation: string
}

type GrammarUsage = {
  grammarToday: number
  grammarLimit: number | null
  totalToday: number
  totalLimit: number | null
}

type GrammarResponse = {
  corrections?: GrammarCorrection[]
  correctionCount?: number
  usage?: GrammarUsage
  error?: string
  message?: string
  upgradeUrl?: string
}

export function GrammarChecker() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [input, setInput] = useState('')
  const [corrections, setCorrections] = useState<GrammarCorrection[]>([])
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set())
  const [correctedText, setCorrectedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [usage, setUsage] = useState<GrammarUsage | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [hasResult, setHasResult] = useState(false)

  const inputLength = input.length
  const isOverMax = inputLength > MAX_CHARS

  const handleCheck = async () => {
    if (!input.trim() || loading || isOverMax) return
    setLoading(true)
    setCorrections([])
    setAppliedIndexes(new Set())
    setCorrectedText('')
    setError('')
    setHasResult(false)

    try {
      const res = await fetch(`${API_BASE}/api/v1/tools/grammar-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: input }),
      })

      const data = (await res.json()) as GrammarResponse

      if (data.error === 'quota_exceeded') {
        setShowUpgrade(true)
        return
      }

      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? t('errors.generic'))
        return
      }

      setCorrections(data.corrections ?? [])
      setCorrectedText(input)
      setHasResult(true)
      if (data.usage) setUsage(data.usage)
    } catch (err) {
      setError(t('errors.generic'))
      console.error('grammar check error', err)
    } finally {
      setLoading(false)
    }
  }

  const applyCorrection = useCallback((index: number) => {
    const correction = corrections[index]
    if (!correction || appliedIndexes.has(index)) return

    setCorrectedText((prev) => {
      const idx = prev.indexOf(correction.original)
      if (idx === -1) return prev
      return prev.slice(0, idx) + correction.corrected + prev.slice(idx + correction.original.length)
    })
    setAppliedIndexes((prev) => new Set(prev).add(index))
  }, [corrections, appliedIndexes])

  const applyAll = useCallback(() => {
    let text = correctedText
    corrections.forEach((c, i) => {
      if (appliedIndexes.has(i)) return
      const idx = text.indexOf(c.original)
      if (idx !== -1) {
        text = text.slice(0, idx) + c.corrected + text.slice(idx + c.original.length)
      }
    })
    setCorrectedText(text)
    setAppliedIndexes(new Set(corrections.map((_, i) => i)))
  }, [corrections, correctedText, appliedIndexes])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(correctedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('errors.copyFailed'))
    }
  }, [correctedText, t])

  const allApplied = corrections.length > 0 && appliedIndexes.size === corrections.length

  return (
    <div className="flex flex-col h-full py-4 sm:py-6">
      {/* Header */}
      <div className="px-4 pb-4 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{t('grammar.title')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('grammar.subtitle')}</p>
          </div>
          {usage && usage.grammarLimit !== null && (
            <div className="text-xs text-gray-500">
              {t('grammar.quota', { used: usage.grammarToday, limit: usage.grammarLimit })}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 px-4 overflow-y-auto lg:flex-row sm:px-0">
        {/* Input panel */}
        <div className="flex flex-col gap-3 lg:w-1/2">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('grammar.placeholder')}
              rows={12}
              className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 resize-none ${
                isOverMax
                  ? 'focus:ring-red-500 border border-red-700/50'
                  : 'focus:ring-blue-500'
              }`}
            />
            <div
              className={`absolute bottom-2 right-3 text-xs ${
                isOverMax ? 'text-red-400' : 'text-gray-600'
              }`}
            >
              {inputLength.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </div>
          </div>

          {isOverMax && (
            <p className="text-xs text-red-400">
              {t('grammar.maxChars', { max: MAX_CHARS.toLocaleString() })}
            </p>
          )}

          <button
            onClick={handleCheck}
            disabled={!input.trim() || loading || isOverMax}
            className="min-h-[44px] w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-0"
          >
            {loading ? t('grammar.checking') : t('grammar.check')}
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
                <div className="text-2xl animate-pulse">&#128270;</div>
                <p className="text-sm text-gray-400">{t('grammar.analyzing')}</p>
              </div>
            </div>
          )}

          {!loading && hasResult && corrections.length === 0 && (
            <div className="flex-1 flex items-center justify-center bg-green-900/20 rounded-xl min-h-[200px] border border-green-700/30">
              <div className="text-center space-y-2 px-6">
                <div className="text-3xl">&#10004;&#65039;</div>
                <p className="text-sm text-green-400">{t('grammar.noErrors')}</p>
              </div>
            </div>
          )}

          {!loading && corrections.length > 0 && (
            <>
              {/* Corrections list */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {t('grammar.corrections', { count: corrections.length })}
                  </p>
                  <div className="flex gap-2">
                    {!allApplied && (
                      <button
                        onClick={applyAll}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                      >
                        {t('grammar.applyAll')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-gray-800/60 divide-y divide-gray-700/50 max-h-[300px] overflow-y-auto">
                  {corrections.map((c, i) => {
                    const isApplied = appliedIndexes.has(i)
                    return (
                      <div key={i} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-red-400 line-through shrink-0 break-all">{c.original}</span>
                          <span className="text-gray-600 shrink-0">&rarr;</span>
                          <span className="text-green-400 break-all">{c.corrected}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">{c.explanation}</p>
                          <button
                            onClick={() => applyCorrection(i)}
                            disabled={isApplied}
                            className={`text-xs px-2 py-1 rounded transition-colors shrink-0 ml-2 ${
                              isApplied
                                ? 'text-gray-600 cursor-default'
                                : 'text-indigo-400 hover:text-indigo-300 hover:bg-gray-800'
                            }`}
                          >
                            {isApplied ? t('grammar.applied') : t('grammar.apply')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Corrected text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {t('grammar.result')}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                  >
                    {copied ? t('tools.copied') : t('tools.copy')}
                  </button>
                </div>
                <div className="rounded-xl bg-gray-800 px-4 py-3 text-sm text-gray-100 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {correctedText}
                </div>
              </div>
            </>
          )}

          {!loading && !hasResult && !error && (
            <div className="flex-1 flex items-center justify-center bg-gray-800/30 rounded-xl min-h-[200px] border border-dashed border-gray-700">
              <div className="text-center space-y-2 px-6">
                <div className="text-3xl">&#128221;</div>
                <p className="text-sm text-gray-500">{t('grammar.emptyHint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpgrade && (
        <UpgradePrompt
          count={usage?.grammarToday ?? 3}
          limit={usage?.grammarLimit ?? 3}
          onDismiss={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
