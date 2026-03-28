import { useState, useCallback } from 'react'

type ToolId = 'summarize' | 'translate' | 'explain-code'

type Tool = {
  name: string
  id: ToolId
  description: string
  placeholder: string
  icon: string
  maxChars?: number
  maxLines?: number
}

const TOOLS: Tool[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Condense any text into structured bullet points',
    placeholder: 'Paste text to summarize (max 5,000 characters)...',
    icon: '📝',
    maxChars: 5000,
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text between languages',
    placeholder: 'Enter text to translate (max 3,000 characters)...',
    icon: '🌐',
    maxChars: 3000,
  },
  {
    id: 'explain-code',
    name: 'Explain Code',
    description: 'Get a structured explanation of any code',
    placeholder: 'Paste your code here (max 2,000 lines)...',
    icon: '💻',
    maxLines: 2000,
  },
]

const SUMMARY_LENGTHS = [
  { value: 'short', label: 'Short (~100 chars)' },
  { value: 'medium', label: 'Medium (~300 chars)' },
  { value: 'detailed', label: 'Detailed (~500 chars)' },
]

const TARGET_LANGUAGES = [
  '繁體中文', '簡體中文', 'English', '日本語', '한국어', 'Español', 'Français', 'Deutsch',
]

const SOURCE_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: '繁體中文', label: '繁體中文' },
  { value: '簡體中文', label: '簡體中文' },
  { value: 'English', label: 'English' },
  { value: '日本語', label: '日本語' },
  { value: '한국어', label: '한국어' },
  { value: 'Español', label: 'Español' },
  { value: 'Français', label: 'Français' },
  { value: 'Deutsch', label: 'Deutsch' },
]

const CODE_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
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

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

export function ToolPanel() {
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

      const res = await fetch(`${API_BASE}/tools/${activeTool.id}`, {
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
        <h2 className="font-semibold text-white">AI Tools</h2>
        <p className="text-xs text-gray-500">Instant AI-powered utilities</p>
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
            {tool.name}
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs text-gray-500">{activeTool.description}</p>

        {/* Tool-specific options */}
        {activeTool.id === 'summarize' && (
          <div className="flex gap-1.5">
            {SUMMARY_LENGTHS.map((len) => (
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
              {SOURCE_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <button
              onClick={handleSwapLanguages}
              disabled={sourceLanguage === 'auto'}
              className="px-2 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Swap languages"
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
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        )}

        {/* Input area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeTool.placeholder}
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
            Input exceeds the maximum{' '}
            {activeTool.maxChars
              ? `of ${activeTool.maxChars.toLocaleString()} characters`
              : `of ${activeTool.maxLines?.toLocaleString()} lines`
            }. Please shorten your input.
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={!input.trim() || loading || isOverLimit}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          {loading ? 'Running...' : `Run ${activeTool.name}`}
        </button>

        {error && (
          <div className="rounded-xl bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {output && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Result</p>
              <button
                onClick={handleCopy}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                {copied ? 'Copied!' : 'Copy'}
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
