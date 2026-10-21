import api, { tokenStorage } from './api'
import type { User } from '../types/user'

export interface LoginRequestData {
  email: string
  password: string
}

export interface AuthData {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface ChangePasswordData {
  senha_atual: string
  nova_password: string
  confirmar_password: string
}

function isUserPayload(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<User>
  return typeof candidate.id === 'number' && typeof candidate.role === 'string'
}

export async function login(email: string, password: string): Promise<AuthData> {
  const { data } = await api.post<AuthData>('/auth/login', { email, password })
  if (!data?.access_token || !data?.refresh_token || !isUserPayload(data.user)) {
    throw new Error('Resposta de autenticação inválida.')
  }
  tokenStorage.set(data.access_token, data.refresh_token)
  return data
}

export async function changePassword(payload: ChangePasswordData): Promise<void> {
  const { data } = await api.post<Omit<AuthData, 'user'>>('/auth/change-password', payload)
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Resposta de autenticação inválida.')
  }
  tokenStorage.set(data.access_token, data.refresh_token)
}

export async function fetchMe(): Promise<AuthData['user']> {
  const { data } = await api.get<AuthData['user']>('/auth/me')
  if (!isUserPayload(data)) {
    throw new Error('Resposta inválida em /auth/me.')
  }
  return data
}

export function logout(): void {
  tokenStorage.clear()
}

export function isAuthenticated(): boolean {
  return tokenStorage.getAccess() !== null
}

export default { login, changePassword, fetchMe, logout, isAuthenticated }
