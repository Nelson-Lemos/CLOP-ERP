export interface NotificationItem {
  id: number
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export interface ProductivityMetrics {
  total_tasks: number
  completed_tasks: number
  pending_tasks: number
  overdue_tasks: number
  rejected_tasks: number
  completion_rate: number
  on_time_rate: number
  average_completion_time: number
  weighted_score: number
}

export interface EmployeeRow extends ProductivityMetrics {
  id: number
  nome: string
  email: string
  cargo: string | null
  departamento_id: number | null
  departamento_nome: string | null
}

export interface DepartmentRow extends ProductivityMetrics {
  id: number
  nome: string
}

export interface MonthlyPoint {
  month: number
  year: number
  label: string
  count: number
}

export interface AdminDashboardData {
  total_employees: number
  total_departments: number
  tasks_today: number
  completed_today: number
  pending_today: number
  overdue_today: number
  monthly: MonthlyPoint[]
  departments: DepartmentRow[]
  status_distribution: Record<string, number>
  employees: EmployeeRow[]
}

export interface DepartmentDashboardData extends ProductivityMetrics {
  department_id: number
  department_nome: string | null
  total_employees: number
  employees: EmployeeRow[]
}

export interface EmployeeDashboardData {
  nome: string
  today: Counts
  week: Counts
  month: Counts
  all: Counts
  status_distribution: Record<string, number>
  metrics: ProductivityMetrics
}

export interface Counts {
  total: number
  completed: number
  in_progress: number
  pending: number
  submitted: number
  rejected: number
  overdue: number
}

export interface CompanyProductivityResult {
  company: ProductivityMetrics
  departments: { id: number; nome: string; completion_rate: number; overdue_tasks: number; total_tasks: number }[]
  monthly: MonthlyPoint[]
}

export interface ReportData {
  label: string
  periodo: string
  generated_at: string
  metrics: ProductivityMetrics
  status_distribution: Record<string, number>
  department_breakdown: DepartmentRow[] | null
  monthly: MonthlyPoint[] | null
  department_nome: string | null
  user_nome: string | null
}

export interface AuditLogItem {
  id: number
  user_id: number | null
  username: string | null
  action: string
  entity: string
  entity_id: number | null
  ip_address: string | null
  created_at: string
}