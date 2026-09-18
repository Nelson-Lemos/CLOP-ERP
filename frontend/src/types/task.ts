export type TaskType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'NORMAL'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DECLINED'

export interface Task {
  id: number
  titulo: string
  descricao: string | null
  tipo: TaskType
  prioridade: TaskPriority
  status: TaskStatus
  progress: number
  created_by: number
  assigned_to: number | null
  department_id: number | null
  start_date: string | null
  deadline: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskDetail extends Task {
  created_by_nome: string | null
  assigned_to_nome: string | null
  department_nome: string | null
  is_overdue: boolean
}

export interface TaskHistoryItem {
  id: number
  task_id: number
  user_id: number | null
  user_nome: string | null
  action: string
  description: string | null
  created_at: string
}

export interface TaskUpdateItem {
  id: number
  task_id: number
  user_id: number
  user_nome: string | null
  progress: number
  descricao: string | null
  created_at: string
}

export interface TaskReviewItem {
  id: number
  task_id: number
  reviewed_by: number
  decision: string
  motivo: string | null
  created_at: string
}

export interface Attachment {
  id: number
  task_id: number
  user_id: number
  filename: string
  content_type: string | null
  size: number | null
  created_at: string
}

export interface TaskCreatePayload {
  titulo: string
  descricao?: string | null
  tipo: TaskType
  prioridade: TaskPriority
  assigned_to?: number | null
  department_id?: number | null
  start_date?: string | null
  deadline?: string | null
}

export interface TaskUpdatePayload {
  titulo?: string
  descricao?: string | null
  tipo?: TaskType
  prioridade?: TaskPriority
  assigned_to?: number | null
  department_id?: number | null
  start_date?: string | null
  deadline?: string | null
}

export interface TaskSubmitPayload {
  progress: number
  descricao?: string | null
}

export interface TaskRejectPayload {
  motivo: string
}