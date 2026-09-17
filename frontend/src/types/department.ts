export type DepartmentStatus = 'ACTIVE' | 'INACTIVE'

export interface Department {
  id: number
  nome: string
  descricao: string | null
  manager_id: number | null
  manager_nome: string | null
  manager_email: string | null
  employee_count: number
  estado: DepartmentStatus
  created_at: string
  updated_at: string
}

export interface DepartmentCreatePayload {
  nome: string
  descricao?: string | null
  manager_id?: number | null
}

export interface DepartmentUpdatePayload {
  nome?: string
  descricao?: string | null
  manager_id?: number | null
  estado?: DepartmentStatus
}