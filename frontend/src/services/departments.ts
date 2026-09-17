import api from './api'
import type { Department, DepartmentCreatePayload, DepartmentUpdatePayload } from '../types/department'
import type { User } from '../types/user'

export async function listDepartments(q?: string): Promise<Department[]> {
  const { data } = await api.get<Department[]>('/departments', { params: { q } })
  return data
}

export async function getDepartment(id: number): Promise<Department> {
  const { data } = await api.get<Department>(`/departments/${id}`)
  return data
}

export async function createDepartment(payload: DepartmentCreatePayload): Promise<Department> {
  const { data } = await api.post<Department>('/departments', payload)
  return data
}

export async function updateDepartment(id: number, payload: DepartmentUpdatePayload): Promise<Department> {
  const { data } = await api.put<Department>(`/departments/${id}`, payload)
  return data
}

export async function listDepartmentEmployees(id: number): Promise<User[]> {
  const { data } = await api.get<User[]>(`/departments/${id}/employees`)
  return data
}