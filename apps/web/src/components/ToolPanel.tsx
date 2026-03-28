import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

type ToolId = 'summarize' | 'translate' | 'explain-code'

type Tool = {
  id: ToolId
  icon: string
  maxChars?: number
  maxLines?: number
}

type CodeLanguageOption =
  | { value: string; label: string }
  | { value: string; labelKey: string }

const TOOLS: Tool[] = [
  {
    id: 'summarize',
    icon: '📝',
    maxChars: 5000,
  },
  {
    id: 'translate',
    icon: '🌐',
    maxChars: 3000,
  },
  {
    id: 'explain-code',
    icon: '💻',
    maxLines: 2000,
  },
]

const TARGET_LANGUAGES = [
  '繁體中文', '簡體中文', 'English', '日本語', '한국어', 'Español', 'Français', 'Deutsch',
]

const CODE_LANGUAGES: CodeLanguageOption[] = [
  { value: 'auto', labelKey: 'tools.codeLanguage.autoDetect' },
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'TypeScript', label: 'TypeScript' },
  { value: 'Python', label: 'Python' },
  { value: 'Rust', label: 'Rust' },
  { value: 'Go', label: 'Go' },
  { value: 'Java', label: 'Java' },
  { value: 'C++', label: 'C++' },
  { value: 'C#', label: 'C#' },
  { value: 'Ruby', label: 'Ruby' },
  { value: 'PHP', label: 'PHP' },
  { value: 'Swift', label: 'Swift' },
  { value: 'Kotlin', label: 'Kotlin' },
  { value: 'SQL', label: 'SQL' },
  { value: 'HTML/CSS', label: 'HTML/CSS' },
  { value: 'Shell', label: 'Shell' },
]

import { API_BASE } from '../lib/api'

export function ToolPanel() {
  const { t } = useTranslation()
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Summarize options
  const [summaryLength, setSummaryLength] = useState('medium')

  // Translate options
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [targetLanguage, setTargetLanguage] = useState('English')

  // Explain-code options
  const [codeLanguage, setCodeLanguage] = useState('auto')

  const toolLabels = {
    summarize: {
      name: t('tools.summarize.name'),
      description: t('tools.summarize.description'),
      placeholder: t('tools.summarize.placeholder'),
    },
    translate: {
      name: t('tools.translate.name'),
      description: t('tools.translate.description'),
      placeholder: t('tools.translate.placeholder'),
    },
    'explain-code': {
      name: t('tools.explainCode.name'),
      description: t('tools.explainCode.description'),
      placeholder: t('tools.explainCode.placeholder'),
    },
  } as const

  const summaryLengths = [
    { value: 'short', label: t('tools.summaryLength.short') },
    { value: 'medium', label: t('tools.summaryLength.medium') },
    { value: 'detailed', label: t('tools.summaryLength.detailed') },
  ]

  const sourceLanguages = [
    { value: 'auto', label: t('tools.translate.autoDetect') },
    { value: '繁體中文', label: '繁體中文' },
    { value: '簡體中文', label: '簡體中文' },
    { value: 'English', label: 'English' },
    { value: '日本語', label: '日本語' },
    { value: '한국어', label: '한국어' },
    { value: 'Español', label: 'Español' },
    { value: 'Français', label: 'Français' },
    { value: 'Deutsch', label: 'Deutsch' },
  ]
  const codeLanguages = CODE_LANGUAGES.map((language) => ({
    value: language.value,
    label: 'labelKey' in language ? t(language.labelKey) : language.label,
  }))

  const inputLength = input.length
  const inputLines = input.split('\n').length
  const isOverLimit = activeTool.maxChars
    ? inputLength > activeTool.maxChars
    : activeTool.maxLines
      ? inputLines > activeTool.maxLines
      : false

  const handleRun = async () => {
    if (!input.trim() || loading || isOverLimit) return
    setLoading(true)
    setOutput('')
    setError('')

    try {
      const options: Record<string, string> = {}
      if (activeTool.id === 'summarize') {
        options.summaryLength = summaryLength
      } else if (activeTool.id === 'translate') {
        options.sourceLanguage = sourceLanguage
        options.targetLanguage = targetLanguage
      } else if (activeTool.id === 'explain-code') {
        options.language = codeLanguage
      }

      const res = await fetch(`${API_BASE}/api/v1/tools/${activeTool.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, options }),
      })

      const data = await res.json() as { output?: string; error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? `Error ${res.status}`)
      } else {
        setOutput(data.output ?? '')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool)
    setInput('')
    setOutput('')
    setError('')
    setCopied(false)
  }

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output])

  const handleSwapLanguages = () => {
    if (sourceLanguage !== 'auto') {
      const prev = sourceLanguage
      setSourceLanguage(targetLanguage)
      setTargetLanguage(prev)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="font-semibold text-white">{t('tools.title')}</h2>
        <p className="text-xs text-gray-500">{t('tools.subtitle')}</p>
      </div>

      {/* Tool Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-800">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolChange(tool)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTool.id === tool.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span>{tool.icon}</span>
            {toolLabels[tool.id].name}
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs text-gray-500">{toolLabels[activeTool.id].description}</p>

        {/* Tool-specific options */}
        {activeTool.id === 'summarize' && (
          <div className="flex gap-1.5">
            {summaryLengths.map((len) => (
              <button
                key={len.value}
                onClick={() => setSummaryLength(len.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  summaryLength === len.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {len.label}
              </button>
            ))}
          </div>
        )}

        {activeTool.id === 'translate' && (
          <div className="flex items-center gap-2">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
            >
              {sourceLanguages.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <button
              onClick={handleSwapLanguages}
              disabled={sourceLanguage === 'auto'}
              className="px-2 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={t('tools.translate.swap')}
            >
              ⇄
            </button>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        )}

        {activeTool.id === 'explain-code' && (
          <select
            value={codeLanguage}
            onChange={(e) => setCodeLanguage(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
          >
            {codeLanguages.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        )}

        {/* Input area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={toolLabels[activeTool.id].placeholder}
            rows={activeTool.id === 'explain-code' ? 10 : 6}
            className={`w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 resize-none ${
              activeTool.id === 'explain-code' ? 'font-mono text-xs' : ''
            } ${isOverLimit ? 'focus:ring-red-500 border border-red-700/50' : 'focus:ring-blue-500'}`}
          />
          <div className={`absolute bottom-2 right-3 text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-600'}`}>
            {activeTool.maxChars
              ? `${inputLength.toLocaleString()} / ${activeTool.maxChars.toLocaleString()}`
              : `${inputLines.toLocaleString()} / ${activeTool.maxLines?.toLocaleString()} lines`
            }
          </div>
        </div>

        {isOverLimit && (
          <p className="text-xs text-red-400">
            {activeTool.maxChars
              ? t('tools.inputExceedsChars', { max: activeTool.maxChars.toLocaleString() })
              : t('tools.inputExceedsLines', {
                  max: activeTool.maxLines?.toLocaleString() ?? '0',
                })}
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={!input.trim() || loading || isOverLimit}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          {loading ? t('tools.running') : t('tools.run', { name: toolLabels[activeTool.id].name })}
        </button>

        {error && (
          <div className="rounded-xl bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {output && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('tools.result')}</p>
              <button
                onClick={handleCopy}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                {copied ? t('tools.copied') : t('tools.copy')}
              </button>
            </div>
            <div className="rounded-xl bg-gray-800 px-4 py-3 text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
              {output}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
