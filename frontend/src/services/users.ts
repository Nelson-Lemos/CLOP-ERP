import api from './api'
import type { User, UserStatus } from '../types/user'

export interface UserCreatePayload {
  nome_completo: string
  email: string
  password: string
  telefone?: string | null
  cargo?: string | null
  departamento_id?: number | null
  role: 'CEO' | 'MANAGER' | 'EMPLOYEE'
  data_admissao?: string | null
}

export interface UserUpdatePayload {
  nome_completo?: string
  email?: string
  password?: string
  telefone?: string | null
  cargo?: string | null
  departamento_id?: number | null
  role?: 'CEO' | 'MANAGER' | 'EMPLOYEE'
  data_admissao?: string | null
}

export async function listUsers(q?: string): Promise<User[]> {
  const { data } = await api.get<User[]>('/users', { params: { q } })
  return data
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await api.post<User>('/users', payload)
  return data
}

export async function getUser(id: number): Promise<User> {
  const { data } = await api.get<User>(`/users/${id}`)
  return data
}

export async function updateUser(id: number, payload: UserUpdatePayload): Promise<User> {
  const { data } = await api.put<User>(`/users/${id}`, payload)
  return data
}

export async function updateUserStatus(id: number, estado: UserStatus): Promise<User> {
  const { data } = await api.patch<User>(`/users/${id}/status`, { estado })
  return data
}

export async function uploadUserPhoto(id: number, file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<User>(`/users/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}