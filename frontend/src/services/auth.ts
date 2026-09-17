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

export async function login(email: string, password: string): Promise<AuthData> {
  const { data } = await api.post<AuthData>('/auth/login', { email, password })
  tokenStorage.set(data.access_token, data.refresh_token)
  return data
}

export async function fetchMe(): Promise<AuthData['user']> {
  const { data } = await api.get<AuthData['user']>('/auth/me')
  return data
}

export function logout(): void {
  tokenStorage.clear()
}

export function isAuthenticated(): boolean {
  return tokenStorage.getAccess() !== null
}

export default { login, fetchMe, logout, isAuthenticated }