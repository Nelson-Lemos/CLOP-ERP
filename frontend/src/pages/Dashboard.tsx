import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminDashboard, getDepartmentDashboard, getEmployeeDashboard } from '../services/dashboard'
import type { AdminDashboardData, DepartmentDashboardData, EmployeeDashboardData, MonthlyPoint } from '../types/report'
import { useAuth } from '../hooks/useAuth'
import StatCard from '../components/ui/StatCard'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, tdStyle, thStyle, tableStyle } from '../components/ui/common'

function BarChart({ data, color }: { data: MonthlyPoint[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '0.5rem' }}>
      {data.map((d) => (
        <div key={`${d.year}-${d.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--clop-gray)' }}>{d.count}</span>
          <div
            style={{
              width: '100%',
              height: `${Math.max(4, (d.count / max) * 110)}px`,
              background: color ?? 'var(--clop-gold)',
              borderRadius: '4px 4px 0 0',
              opacity: d.count === 0 ? 0.25 : 1,
            }}
          />
          <span style={{ fontSize: '0.62rem', color: 'var(--clop-gray)', whiteSpace: 'nowrap' }}>{d.label.slice(0, 3)}</span>
        </div>
      ))}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'var(--success)',
  IN_PROGRESS: '#4f86f7',
  PENDING: 'var(--warning)',
  OVERDUE: 'var(--danger)',
  REJECTED: 'var(--danger)',
  SUBMITTED: 'var(--clop-gold)',
  UNDER_REVIEW: 'var(--clop-gold)',
  CANCELLED: 'var(--clop-gray)',
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Concluídas',
  IN_PROGRESS: 'Em andamento',
  PENDING: 'Pendentes',
  OVERDUE: 'Atrasadas',
  REJECTED: 'Rejeitadas',
  SUBMITTED: 'Submetidas',
  UNDER_REVIEW: 'Em revisão',
  CANCELLED: 'Canceladas',
}

function StatusDistribution({ distribution }: { distribution: Record<string, number> }) {
  const entries = Object.entries(distribution)
  const total = entries.reduce((acc, [, v]) => acc + v, 0)
  if (total === 0) return <EmptyState message="Sem tarefas para apresentar." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {entries.map(([status, count]) => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--clop-gray)', minWidth: 100 }}>{STATUS_LABELS[status] ?? status}</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ProgressBar value={(count / total) * 100} color={STATUS_COLORS[status] ?? 'var(--clop-gray)'} />
            <span style={{ fontSize: '0.75rem', color: 'var(--clop-white)', minWidth: 30, textAlign: 'right' }}>{count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'Sem dados.'} onRetry={() => window.location.reload()} />

  return (
    <div>
      <PageHeader title="CLOP MANAGEMENT" subtitle="Dashboard da administração" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard title="Funcionários" value={data.total_employees} />
        <StatCard title="Departamentos" value={data.total_departments} />
        <StatCard title="Tarefas hoje" value={data.tasks_today} />
        <StatCard title="Concluídas hoje" value={data.completed_today} accent="success" />
        <StatCard title="Pendentes hoje" value={data.pending_today} accent="warning" />
        <StatCard title="Atrasadas hoje" value={data.overdue_today} accent="danger" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Produtividade geral — evolução por mês</h3>
          <BarChart data={data.monthly} />
        </div>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Estado das tarefas</h3>
          <StatusDistribution distribution={data.status_distribution} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Produtividade por departamento</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Departamento</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Concluídas</th>
                <th style={thStyle}>Atrasadas</th>
                <th style={thStyle}>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{d.nome}</td>
                  <td style={tdStyle}>{d.total_tasks}</td>
                  <td style={tdStyle}>{d.completed_tasks}</td>
                  <td style={tdStyle}>{d.overdue_tasks}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{d.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
        <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', margin: '1.25rem 1.25rem 0' }}>Funcionários</h3>
        <table style={{ ...tableStyle, marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Departamento</th>
              <th style={thStyle}>Concluídas</th>
              <th style={thStyle}>Pendentes</th>
              <th style={thStyle}>Atrasadas</th>
              <th style={thStyle}>Taxa de conclusão</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.map((e) => (
              <tr key={e.id}>
                <td style={tdStyle}>
                  <Link to={`/employees/${e.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                    {e.nome}
                  </Link>
                </td>
                <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{e.departamento_nome ?? '—'}</td>
                <td style={tdStyle}>{e.completed_tasks}</td>
                <td style={tdStyle}>{e.pending_tasks}</td>
                <td style={tdStyle}>{e.overdue_tasks}</td>
                <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{e.completion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DepartmentDash() {
  const [data, setData] = useState<DepartmentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getDepartmentDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'Sem dados.'} onRetry={() => window.location.reload()} />

  return (
    <div>
      <PageHeader title={`Departamento: ${data.department_nome ?? '—'}`} subtitle={`Funcionários: ${data.total_employees}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard title="Concluídas" value={data.completed_tasks} accent="success" />
        <StatCard title="Em andamento" value={data.pending_tasks} accent="blue" />
        <StatCard title="Pendentes" value={data.pending_tasks} accent="warning" />
        <StatCard title="Atrasadas" value={data.overdue_tasks} accent="danger" />
        <StatCard title="Taxa de conclusão" value={`${data.completion_rate}%`} />
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Funcionário</th>
              <th style={thStyle}>Atribuídas</th>
              <th style={thStyle}>Concluídas</th>
              <th style={thStyle}>Pendentes</th>
              <th style={thStyle}>Atrasadas</th>
              <th style={thStyle}>Taxa de conclusão</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.length === 0 ? (
              <tr>
                <td style={{ ...tdStyle, color: 'var(--clop-gray)' }} colSpan={6}>
                  Sem funcionários no departamento.
                </td>
              </tr>
            ) : (
              data.employees.map((e) => (
                <tr key={e.id}>
                  <td style={tdStyle}>
                    <Link to={`/employees/${e.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                      {e.nome}
                    </Link>
                  </td>
                  <td style={tdStyle}>{e.total_tasks}</td>
                  <td style={tdStyle}>{e.completed_tasks}</td>
                  <td style={tdStyle}>{e.pending_tasks}</td>
                  <td style={tdStyle}>{e.overdue_tasks}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{e.completion_rate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmployeeDash() {
  const [data, setData] = useState<EmployeeDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getEmployeeDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'Sem dados.'} onRetry={() => window.location.reload()} />

  return (
    <div>
      <PageHeader title={`Olá, ${data.nome}`} subtitle="As suas tarefas" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard title="Tarefas hoje" value={data.today.total} />
        <StatCard title="Concluídas" value={data.today.completed} accent="success" />
        <StatCard title="Em andamento" value={data.today.in_progress} accent="blue" />
        <StatCard title="Pendentes" value={data.today.pending} accent="warning" />
        <StatCard title="Atrasadas" value={data.all.overdue} accent="danger" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {(['today', 'week', 'month'] as const).map((period) => {
          const c = data[period]
          return (
            <div key={period} style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.9rem', marginTop: 0, textTransform: 'capitalize' }}>
                {period === 'today' ? 'Hoje' : period === 'week' ? 'Esta semana' : 'Este mês'}
              </h3>
              <table style={tableStyle}>
                <tbody>
                  {[
                    ['Total', c.total],
                    ['Concluídas', c.completed],
                    ['Em andamento', c.in_progress],
                    ['Submetidas', c.submitted],
                    ['Rejeitadas', c.rejected],
                    ['Atrasadas', c.overdue],
                  ].map(([k, v]) => (
                    <tr key={String(k)}>
                      <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{String(k)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem', marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Minha produtividade</h3>
        <StatusDistribution distribution={data.status_distribution} />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--clop-gray)' }}>Taxa de conclusão: <b style={{ color: 'var(--clop-gold-light)' }}>{data.metrics.completion_rate}%</b></span>
          <span style={{ fontSize: '0.78rem', color: 'var(--clop-gray)' }}>No prazo: <b style={{ color: 'var(--success)' }}>{data.metrics.on_time_rate}%</b></span>
          <span style={{ fontSize: '0.78rem', color: 'var(--clop-gray)' }}>Pontuação: <b style={{ color: 'var(--clop-white)' }}>{data.metrics.weighted_score}%</b></span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === 'CEO') return <AdminDashboard />
  if (user.role === 'MANAGER') return <DepartmentDash />
  return <EmployeeDash />
}