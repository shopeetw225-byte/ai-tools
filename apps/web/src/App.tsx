import { useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { ToolPanel } from './components/ToolPanel'
import { AuthPage } from './components/AuthPage'
import { DashboardPanel } from './components/DashboardPanel'
import { LandingPage } from './components/LandingPage'
import { useAuth } from './hooks/useAuth'

type Tab = 'chat' | 'tools' | 'dashboard'
type View = 'landing' | 'auth' | 'app'

export default function App() {
  const { user, loading, isAuthenticated, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('chat')
  const [view, setView] = useState<View>('landing')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm">Loading…</div>
      </div>
    )
  }

  if (isAuthenticated) {
    // Authenticated users go straight to app
  } else if (view === 'auth') {
    return <AuthPage />
  } else {
    return <LandingPage onEnter={() => setView('auth')} />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            AI Tools
          </span>
          <span className="text-xs text-gray-600 font-mono">on Cloudflare</span>
        </div>

        <nav className="flex gap-1">
          <button
            onClick={() => setTab('chat')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'chat' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setTab('tools')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'tools' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ Tools
          </button>
          <button
            onClick={() => setTab('dashboard')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'dashboard' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Dashboard
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
        {tab === 'chat' && <ChatPanel />}
        {tab === 'tools' && <ToolPanel />}
        {tab === 'dashboard' && <DashboardPanel />}
      </main>
    </div>
  )
}
