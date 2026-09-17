import api from './api'
import type {
  Attachment,
  TaskCreatePayload,
  TaskDetail,
  TaskHistoryItem,
  TaskPriority,
  TaskRejectPayload,
  TaskStatus,
  TaskSubmitPayload,
  TaskType,
  TaskUpdateItem,
  TaskUpdatePayload,
} from '../types/task'

export interface TaskFilters {
  status?: TaskStatus
  tipo?: TaskType
  prioridade?: TaskPriority
  department_id?: number
  assigned_to?: number
  q?: string
}

export async function listTasks(filters: TaskFilters = {}): Promise<TaskDetail[]> {
  const params: Record<string, string | number> = {}
  if (filters.status) params.status = filters.status
  if (filters.tipo) params.tipo = filters.tipo
  if (filters.prioridade) params.prioridade = filters.prioridade
  if (filters.department_id) params.department_id = filters.department_id
  if (filters.assigned_to) params.assigned_to = filters.assigned_to
  if (filters.q) params.q = filters.q
  const { data } = await api.get<TaskDetail[]>('/tasks', { params })
  return data
}

export async function createTask(payload: TaskCreatePayload): Promise<TaskDetail> {
  const { data } = await api.post<TaskDetail>('/tasks', payload)
  return data
}

export async function getTask(id: number): Promise<TaskDetail> {
  const { data } = await api.get<TaskDetail>(`/tasks/${id}`)
  return data
}

export async function updateTask(id: number, payload: TaskUpdatePayload): Promise<TaskDetail> {
  const { data } = await api.put<TaskDetail>(`/tasks/${id}`, payload)
  return data
}

export async function updateTaskStatus(id: number, status: TaskStatus): Promise<TaskDetail> {
  const { data } = await api.patch<TaskDetail>(`/tasks/${id}/status`, { status })
  return data
}

export async function updateTaskProgress(id: number, progress: number, descricao?: string | null): Promise<TaskDetail> {
  const { data } = await api.patch<TaskDetail>(`/tasks/${id}/progress`, { progress, descricao })
  return data
}

export async function submitTask(id: number, payload: TaskSubmitPayload): Promise<TaskDetail> {
  const { data } = await api.post<TaskDetail>(`/tasks/${id}/submit`, payload)
  return data
}

export async function approveTask(id: number): Promise<TaskDetail> {
  const { data } = await api.post<TaskDetail>(`/tasks/${id}/approve`)
  return data
}

export async function rejectTask(id: number, payload: TaskRejectPayload): Promise<TaskDetail> {
  const { data } = await api.post<TaskDetail>(`/tasks/${id}/reject`, payload)
  return data
}

export async function getTaskHistory(id: number): Promise<TaskHistoryItem[]> {
  const { data } = await api.get<TaskHistoryItem[]>(`/tasks/${id}/history`)
  return data
}

export async function getTaskUpdates(id: number): Promise<TaskUpdateItem[]> {
  const { data } = await api.get<TaskUpdateItem[]>(`/tasks/${id}/updates`)
  return data
}

export async function listTaskAttachments(id: number): Promise<Attachment[]> {
  const { data } = await api.get<Attachment[]>(`/tasks/${id}/attachments`)
  return data
}

export async function uploadAttachment(id: number, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Attachment>(`/tasks/${id}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function attachmentUrl(taskId: number, attachmentId: number): string {
  const base = import.meta.env.VITE_API_URL || '/api'
  return `${base}/tasks/${taskId}/attachments/${attachmentId}/download`
}