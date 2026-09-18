import { useEffect, useState } from 'react'
import type { CompanyProductivityResult, EmployeeDashboardData, MonthlyPoint } from '../types/report'
import { getCompanyProductivity, getDepartmentProductivity, getEmployeeDashboard } from '../services/dashboard'
import { useAuth } from '../hooks/useAuth'
import StatCard from '../components/ui/StatCard'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, tableStyle, tdStyle, thStyle } from '../components/ui/common'

interface FlatDepartment {
  id: number
  nome: string
  completion_rate: number
  overdue_tasks: number
  total_tasks: number
}

const METRIC_ITEMS: Array<[string, (m: CompanyProductivityResult['company']) => string | number, string]> = [
  ['Total', (m) => m.total_tasks, 'var(--clop-white)'],
  ['Concluídas', (m) => m.completed_tasks, 'var(--success)'],
  ['Pendentes', (m) => m.pending_tasks, 'var(--warning)'],
  ['Atrasadas', (m) => m.overdue_tasks, 'var(--danger)'],
  ['Rejeitadas', (m) => m.rejected_tasks, 'var(--clop-gray)'],
]

function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div>
      <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Evolução mensal</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, padding: '0.5rem' }}>
        {data.map((d) => (
          <div key={`${d.year}-${d.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--clop-gray)' }}>{d.count}</span>
            <div style={{ width: '100%', background: 'rgba(212,167,44,0.45)', borderRadius: '4px 4px 0 0', height: Math.max(2, Math.round((d.count / max) * 110)) }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--clop-gray)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
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

function EmployeePerformance() {
  const [data, setData] = useState<EmployeeDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getEmployeeDashboard()
      .then(setData)
      .catch(() => setError('Não foi possível carregar o seu desempenho.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'Sem dados.'} onRetry={() => window.location.reload()} />

  const m = data.metrics
  const entries = Object.entries(data.status_distribution)
  const totalDistribution = entries.reduce((acc, [, v]) => acc + v, 0)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <StatCard title="Tarefas atribuídas" value={data.all.total} />
        <StatCard title="Concluídas" value={data.all.completed} accent="success" />
        <StatCard title="Pendentes" value={data.all.pending} accent="warning" />
        <StatCard title="Atrasadas" value={data.all.overdue} accent="danger" />
        <StatCard title="Rejeitadas" value={data.all.rejected} accent="danger" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Indicadores</h3>
          {[
            ['Taxa de conclusão', m.completion_rate, 'var(--clop-gold)'],
            ['Cumprimento de prazo', m.on_time_rate, 'var(--success)'],
            ['Pontuação ponderada', m.weighted_score, '#4f86f7'],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--clop-gray)', minWidth: 150 }}>{String(label)}</span>
              <div style={{ flex: 1 }}>
                <ProgressBar value={Number(value)} color={String(color)} />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--clop-white)', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
                {String(value)}%
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Estado das minhas tarefas</h3>
          {totalDistribution === 0 ? (
            <EmptyState message="Sem tarefas para apresentar." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {entries.map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--clop-gray)', minWidth: 110 }}>{STATUS_LABELS[status] ?? status}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ProgressBar value={count > 0 ? (count / totalDistribution) * 100 : 0} color={STATUS_COLORS[status] ?? 'var(--clop-gray)'} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--clop-white)', minWidth: 28, textAlign: 'right' }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Productivity() {
  const { user: authUser } = useAuth()
  const [company, setCompany] = useState<CompanyProductivityResult | null>(null)
  const [departments, setDepartments] = useState<FlatDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        if (authUser?.role === 'CEO') setCompany(await getCompanyProductivity())
        else if (authUser?.role === 'MANAGER') setDepartments(await getDepartmentProductivity())
      } catch {
        setError('Não foi possível carregar a produtividade.')
      } finally {
        setLoading(false)
      }
    })()
  }, [authUser])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  const m = authUser?.role === 'CEO' ? company?.company : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title={
          authUser?.role === 'CEO' ? 'Produtividade' : authUser?.role === 'MANAGER' ? 'Desempenho do Departamento' : 'Meu Desempenho'
        }
        subtitle="Indicadores operacionais"
      />

      {authUser?.role === 'CEO' && company && m && (
        <>
          <section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {METRIC_ITEMS.map(([k, get, color]) => (
                <div key={k} style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--clop-gray)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{k}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color, marginTop: '0.3rem' }}>{String(get(m))}</div>
                </div>
              ))}
              <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--clop-gray)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Taxa de conclusão</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <ProgressBar value={m.completion_rate} color="var(--success)" />
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--clop-gold-light)' }}>{m.completion_rate}%</span>
                </div>
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Por departamento</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Departamento</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Atrasadas</th>
                    <th style={thStyle}>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{d.nome}</td>
                      <td style={tdStyle}>{d.total_tasks}</td>
                      <td style={{ ...tdStyle, color: 'var(--danger)' }}>{d.overdue_tasks}</td>
                      <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{d.completion_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {company.monthly.length > 0 && (
            <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
              <MonthlyChart data={company.monthly} />
            </section>
          )}
        </>
      )}

      {authUser?.role === 'MANAGER' && (
        <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Departamento</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Atrasadas</th>
                  <th style={thStyle}>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{d.nome}</td>
                    <td style={tdStyle}>{d.total_tasks}</td>
                    <td style={{ ...tdStyle, color: 'var(--danger)' }}>{d.overdue_tasks}</td>
                    <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{d.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {authUser?.role === 'EMPLOYEE' && <EmployeePerformance />}
    </div>
  )
}