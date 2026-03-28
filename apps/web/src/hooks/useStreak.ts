import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function useStreak() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('ai_tools_token')
    if (!token) return

    fetch(`${API_BASE}/api/v1/usage/streak`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && typeof (json as { streak: number }).streak === 'number') {
          setStreak((json as { streak: number }).streak)
        }
      })
      .catch(() => {})
  }, [])

  return streak
}
