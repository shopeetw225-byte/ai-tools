import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChatPanel } from './components/ChatPanel'
import { ToolPanel } from './components/ToolPanel'
import { AuthPage } from './components/AuthPage'
import { DashboardPanel } from './components/DashboardPanel'
import { PaymentCheckoutPage } from './components/PaymentCheckoutPage'
import { PaymentResultPage } from './components/PaymentResultPage'
import { PricingPage } from './components/PricingPage'
import { PrivacyPage } from './components/PrivacyPage'
import { OnboardingModal } from './components/OnboardingModal'
import { UsageProgress } from './components/UsageProgress'
import { EngagementUpsell } from './components/EngagementUpsell'
import { ResumeOptimizer } from './components/ResumeOptimizer'
import { useAuth } from './hooks/useAuth'
import { useUsage } from './hooks/useUsage'
import { useStreak } from './hooks/useStreak'
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
  const { used, limit, isPro } = useUsage()
  const streak = useStreak()
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('ai_tools_onboarded'),
  )
  const [showEngagementUpsell, setShowEngagementUpsell] = useState(false)

  useEffect(() => {
    if (streak >= 3 && !isPro && !localStorage.getItem('ai_tools_upsell_dismissed')) {
      setShowEngagementUpsell(true)
    }
  }, [streak, isPro])
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
    // Privacy page is public — accessible without login
    const currentPath = location.pathname
    if (currentPath.endsWith('/privacy')) {
      return <PrivacyPage />
    }
    return <AuthPage />
  }

  const changeLanguage = (language: AppLanguage) => {
    navigate(getLocalizedPath(location.pathname, language))
  }

  const navItems = [
    { to: `/${currentLanguage}/chat`, label: t('nav.chat') },
    { to: `/${currentLanguage}/resume`, label: t('nav.resume') },
    { to: `/${currentLanguage}/tools`, label: t('nav.tools') },
    { to: `/${currentLanguage}/dashboard`, label: t('nav.dashboard') },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to={`/${currentLanguage}/chat`}
                className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
              >
                {t('app.name')}
              </Link>
              <span className="hidden text-xs text-gray-600 font-mono sm:inline">{t('app.tagline')}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="flex items-center gap-1">
                {supportedLanguages.map((language) => (
                  <button
                    key={language}
                    onClick={() => changeLanguage(language)}
                    className={`text-xs px-2 py-1 rounded border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0 ${
                      language === currentLanguage
                        ? 'border-blue-500 text-blue-300'
                        : 'border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {language}
                  </button>
                ))}
              </div>
              <span className="hidden text-xs text-gray-500 sm:inline">{user?.email}</span>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 min-h-[44px] sm:min-h-0"
              >
                {t('nav.signOut')}
              </button>
            </div>
          </div>
          <UsageProgress used={used} limit={limit} isPro={isPro} />

          <nav className="flex flex-wrap gap-1" role="navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center sm:min-h-0 ${
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
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-0 sm:px-4">
        <Routes>
          <Route index element={<Navigate to="chat" replace />} />
          <Route path="chat" element={<ChatPanel />} />
          <Route path="resume" element={<ResumeOptimizer />} />
          <Route path="tools" element={<ToolPanel />} />
          <Route path="dashboard" element={<DashboardPanel />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="payment/checkout" element={<PaymentCheckoutPage />} />
          <Route path="payment/result" element={<PaymentResultPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="chat" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-800 px-6 py-3 text-center">
        <p className="text-xs text-gray-500">
          &copy; 2026 貓魚印象有限公司 &middot;{' '}
          <Link to={`/${currentLanguage}/privacy`} className="text-gray-400 hover:text-gray-200 transition-colors">
            {t('nav.privacy')}
          </Link>
        </p>
      </footer>

      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      {showEngagementUpsell && !showOnboarding && (
        <EngagementUpsell
          streak={streak}
          onDismiss={() => {
            localStorage.setItem('ai_tools_upsell_dismissed', new Date().toISOString().split('T')[0])
            setShowEngagementUpsell(false)
          }}
        />
      )}
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
