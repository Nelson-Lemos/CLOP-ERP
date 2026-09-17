import api from './api'
import type { AuditLogItem, ReportData } from '../types/report'

export interface ReportFilters {
  start?: string
  end?: string
}

function buildParams(filters: ReportFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.start) params.start = filters.start
  if (filters.end) params.end = filters.end
  return params
}

export async function getPeriodReport(period: 'daily' | 'weekly' | 'monthly'): Promise<ReportData> {
  const { data } = await api.get<ReportData>(`/reports/${period}`)
  return data
}

export async function getCompanyReport(filters: ReportFilters = {}): Promise<ReportData> {
  const { data } = await api.get<ReportData>('/reports/company', { params: buildParams(filters) })
  return data
}

export async function getDepartmentReport(id: number, filters: ReportFilters = {}): Promise<ReportData> {
  const { data } = await api.get<ReportData>(`/reports/department/${id}`, { params: buildParams(filters) })
  return data
}

export function reportPdfUrl(path: string, filters: ReportFilters = {}): string {
  const base = import.meta.env.VITE_API_URL || '/api'
  const params = new URLSearchParams(buildParams(filters)).toString()
  return `${base}${path}${params ? `?${params}` : ''}`
}

export async function listAuditLogs(params: { action?: string; entity?: string; limit?: number } = {}): Promise<{
  total: number
  offset: number
  limit: number
  items: AuditLogItem[]
}> {
  const { data } = await api.get('/audit/logs', { params })
  return data
}