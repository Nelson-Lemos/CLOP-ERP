export type UserRole = 'CEO' | 'PCA' | 'MANAGER' | 'EMPLOYEE'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export const ADMIN_ROLES: UserRole[] = ['CEO', 'PCA']

export const ROLE_LABELS: Record<UserRole, string> = {
  CEO: 'CEO',
  PCA: 'PCA',
  MANAGER: 'Chefe de Departamento',
  EMPLOYEE: 'Funcionário',
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

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
  password_changed_at: string | null
  created_at: string
  updated_at: string
  departamento_nome?: string | null
  chefe_nome?: string | null
}