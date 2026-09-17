import api from './api'
import type { NotificationItem } from '../types/report'

export async function listNotifications(): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>('/notifications')
  return data
}

export async function unreadCount(): Promise<number> {
  const { data } = await api.get<{ unread: number }>('/notifications/unread-count')
  return data.unread
}

export async function markRead(id: number): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllRead(): Promise<void> {
  await api.patch('/notifications/read-all')
}