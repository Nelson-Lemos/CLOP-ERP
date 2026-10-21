import axios, { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export interface TokenPair {
  access_token: string
  refresh_token: string
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

const TOKEN_KEY = 'clop_access_token'
const REFRESH_KEY = 'clop_refresh_token'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const API_ORIGIN = (() => {
  const base = API_BASE_URL
  return /^https?:\/\//i.test(base) ? base.replace(/\/api\/?$/, '') : ''
})()

export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  const value = path.trim()
  if (!value) return ''
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value
  if (value.startsWith('/api/')) return `${API_ORIGIN}${value}`
  return value
}

export const NON_JSON_RESPONSE_MESSAGE =
  'A API não devolveu JSON. Verifique a configuração de VITE_API_URL em produção ou o proxy /api.'

function isNonJsonResponse(response: AxiosResponse): boolean {
  const data: unknown = response.data
  if (typeof data !== 'string') return false
  const contentType = String(response.headers?.['content-type'] ?? '')
  if (contentType.includes('text/html')) return true
  return data.trimStart().startsWith('<')
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail) return detail
    if (error.code === 'ERR_BAD_RESPONSE' && error.message === NON_JSON_RESPONSE_MESSAGE) return error.message
    if (error.code === 'ECONNABORTED') return 'O servidor demorou demasiado a responder.'
    if (!error.response) return 'Não foi possível contactar o servidor.'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

let refreshPromise: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) {
    throw new Error('Sem refresh token')
  }
  const { data } = await axios.post<TokenPair>(`${API_ORIGIN}/api/auth/refresh`, {
    refresh_token: refreshToken,
  })
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Resposta de refresh inválida')
  }
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
  (response) => {
    if (isNonJsonResponse(response)) {
      return Promise.reject(
        new AxiosError(NON_JSON_RESPONSE_MESSAGE, 'ERR_BAD_RESPONSE', response.config, response.request, response),
      )
    }
    return response
  },
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
