import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'

export interface TokenPair {
  access_token: string
  refresh_token: string
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

const TOKEN_KEY = 'clop_access_token'
const REFRESH_KEY = 'clop_refresh_token'

export const tokenStorage = {
  getAccess(): string | null {
    return sessionStorage.getItem(TOKEN_KEY)
  },
  getRefresh(): string | null {
    return sessionStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string): void {
    sessionStorage.setItem(TOKEN_KEY, access)
    sessionStorage.setItem(REFRESH_KEY, refresh)
  },
  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  },
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) {
    throw new Error('Sem refresh token')
  }
  const { data } = await axios.post<TokenPair>('/api/auth/refresh', {
    refresh_token: refreshToken,
  })
  tokenStorage.set(data.access_token, data.refresh_token)
  return data.access_token
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const isAuthError = error.response?.status === 401
    const canRetry = config != null && !config._retried && !config.url?.includes('/auth/login')

    if (isAuthError && canRetry) {
      config._retried = true
      try {
        refreshPromise = refreshPromise ?? performRefresh()
        const newToken = await refreshPromise
        refreshPromise = null
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config)
      } catch {
        refreshPromise = null
        tokenStorage.clear()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>('/health')
  return data
}

export default api