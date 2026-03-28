import { useState } from 'react'

type Tool = {
  name: string
  id: 'summarize' | 'translate' | 'explain-code'
  description: string
  placeholder: string
  icon: string
  extra?: { label: string; key: string; placeholder: string }
}

const TOOLS: Tool[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Condense any text into 2-3 sentences',
    placeholder: 'Paste text to summarize...',
    icon: '📝',
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to any language',
    placeholder: 'Enter text to translate...',
    icon: '🌐',
    extra: { label: 'Target Language', key: 'targetLanguage', placeholder: 'e.g. Spanish, Japanese, French' },
  },
  {
    id: 'explain-code',
    name: 'Explain Code',
    description: 'Get a plain-English explanation of any code',
    placeholder: 'Paste your code here...',
    icon: '💻',
  },
]

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

export function ToolPanel() {
  const [activeTool, setActiveTool] = useState<Tool>(TOOLS[0])
  const [input, setInput] = useState('')
  const [extraValue, setExtraValue] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRun = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setOutput('')
    setError('')

    try {
      const options: Record<string, string> = {}
      if (activeTool.extra && extraValue.trim()) {
        options[activeTool.extra.key] = extraValue.trim()
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
    setExtraValue('')
    setOutput('')
    setError('')
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

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeTool.placeholder}
          rows={6}
          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />

        {activeTool.extra && (
          <input
            type="text"
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
            placeholder={activeTool.extra.placeholder}
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}

        <button
          onClick={handleRun}
          disabled={!input.trim() || loading}
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
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Result</p>
            <div className="rounded-xl bg-gray-800 px-4 py-3 text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
              {output}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
