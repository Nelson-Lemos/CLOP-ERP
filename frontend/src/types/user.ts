export type UserRole = 'CEO' | 'MANAGER' | 'EMPLOYEE'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface User {
  id: number
  nome_completo: string
  email: string
  telefone: string | null
  cargo: string | null
  departamento_id: number | null
  role: UserRole
  data_admissao: string | null
  foto: string | null
  estado: UserStatus
  created_at: string
  updated_at: string
  departamento_nome?: string | null
  chefe_nome?: string | null
}