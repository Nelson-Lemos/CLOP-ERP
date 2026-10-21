import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout } from '../services/auth'
import { apiErrorMessage } from '../services/api'
import type { User } from '../types/user'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function statusOf(error: unknown): number | null {
  const response = (error as { response?: { status?: number } } | undefined)?.response
  return typeof response?.status === 'number' ? response.status : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchMe()
      .then((me) => {
        if (!active) return
        setUser(me)
        setError('')
      })
      .catch((e: unknown) => {
        if (!active) return
        setUser(null)
        const status = statusOf(e)
        if (status !== 401) {
          setError(apiErrorMessage(e, 'Não foi possível contactar o servidor.'))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
    setError('')
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await fetchMe()
    setUser(me)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      refreshUser,
      isAuthenticated: user !== null,
    }),
    [user, loading, error, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
