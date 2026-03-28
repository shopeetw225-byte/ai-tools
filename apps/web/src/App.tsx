import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChatPanel } from './components/ChatPanel'
import { ToolPanel } from './components/ToolPanel'
import { AuthPage } from './components/AuthPage'
import { DashboardPanel } from './components/DashboardPanel'
import { useAuth } from './hooks/useAuth'
import {
  detectLanguageFromPath,
  getDefaultLanguage,
  getLocalizedPath,
  isSupportedLanguage,
  supportedLanguages,
  type AppLanguage,
} from './lib/i18n-routing'

function AppShell() {
  const { user, loading, isAuthenticated, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ lang: string }>()
  const currentLanguage = isSupportedLanguage(params.lang)
    ? params.lang
    : getDefaultLanguage()

  useEffect(() => {
    if (i18n.language !== currentLanguage) {
      void i18n.changeLanguage(currentLanguage)
    }
  }, [currentLanguage, i18n])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-600 text-sm">{t('loading.app')}</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage />
  }

  const changeLanguage = (language: AppLanguage) => {
    navigate(getLocalizedPath(location.pathname, language))
  }

  const navItems = [
    { to: `/${currentLanguage}/chat`, label: t('nav.chat') },
    { to: `/${currentLanguage}/tools`, label: t('nav.tools') },
    { to: `/${currentLanguage}/dashboard`, label: t('nav.dashboard') },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            to={`/${currentLanguage}/chat`}
            className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
          >
            {t('app.name')}
          </Link>
          <span className="text-xs text-gray-600 font-mono">{t('app.tagline')}</span>
        </div>

        <nav className="flex gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('nav.language')}</span>
            {supportedLanguages.map((language) => (
              <button
                key={language}
                onClick={() => changeLanguage(language)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  language === currentLanguage
                    ? 'border-blue-500 text-blue-300'
                    : 'border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {language}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
        <Routes>
          <Route index element={<Navigate to="chat" replace />} />
          <Route path="chat" element={<ChatPanel />} />
          <Route path="tools" element={<ToolPanel />} />
          <Route path="dashboard" element={<DashboardPanel />} />
          <Route path="*" element={<Navigate to="chat" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const currentLanguage = detectLanguageFromPath(window.location.pathname)

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${getDefaultLanguage()}/`} replace />} />
      <Route path="/:lang/*" element={<AppShell />} />
      <Route
        path="*"
        element={
          <Navigate
            to={getLocalizedPath(window.location.pathname, currentLanguage ?? getDefaultLanguage())}
            replace
          />
        }
      />
    </Routes>
  )
}
