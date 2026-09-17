import api from './api'
import type {
  AdminDashboardData,
  CompanyProductivityResult,
  DepartmentDashboardData,
  EmployeeDashboardData,
  EmployeeRow,
  ProductivityMetrics,
} from '../types/report'

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const { data } = await api.get<AdminDashboardData>('/dashboard/admin')
  return data
}

export async function getDepartmentDashboard(): Promise<DepartmentDashboardData> {
  const { data } = await api.get<DepartmentDashboardData>('/dashboard/department')
  return data
}

export async function getEmployeeDashboard(): Promise<EmployeeDashboardData> {
  const { data } = await api.get<EmployeeDashboardData>('/dashboard/employee')
  return data
}

export async function getCompanyProductivity(): Promise<CompanyProductivityResult> {
  const { data } = await api.get<CompanyProductivityResult>('/productivity/company')
  return data
}

export async function getDepartmentProductivity(): Promise<EmployeeRow[]> {
  const { data } = await api.get<EmployeeRow[]>('/productivity/departments')
  return data
}

export async function getEmployeeProductivity(id: number): Promise<ProductivityMetrics> {
  const { data } = await api.get<ProductivityMetrics>(`/productivity/employees/${id}`)
  return data
}