import { useState, useEffect, useCallback } from 'react'
import i18n from '../i18n'

export type User = {
  id: string
  email: string
  name: string | null
}

type AuthState = {
  user: User | null
  token: string | null
  loading: boolean
}

import { API_BASE } from '../lib/api'

const TOKEN_KEY = 'ai_tools_token'

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem(TOKEN_KEY),
    loading: true,
  })

  const setToken = useCallback((token: string | null) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    setState((s) => ({ ...s, token }))
  }, [])

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setState({ user: null, token: null, loading: false })
      return
    }

    fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { user: User }) => {
        setState({ user: data.user, token, loading: false })
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setState({ user: null, token: null, loading: false })
      })
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json() as { token?: string; user?: User; error?: string }
      if (!res.ok) throw new Error(data.error ?? i18n.t('errors.auth.loginFailed'))
      setToken(data.token!)
      setState((s) => ({ ...s, user: data.user!, token: data.token! }))
    },
    [setToken],
  )

  const register = useCallback(
    async (email: string, password: string, name?: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json() as { token?: string; user?: User; error?: string }
      if (!res.ok) throw new Error(data.error ?? i18n.t('errors.auth.registrationFailed'))
      setToken(data.token!)
      setState((s) => ({ ...s, user: data.user!, token: data.token! }))
    },
    [setToken],
  )

  const logout = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    setToken(null)
    setState({ user: null, token: null, loading: false })
  }, [setToken])

  return {
    user: state.user,
    token: state.token,
    loading: state.loading,
    isAuthenticated: !!state.user,
    login,
    register,
    logout,
  }
}
