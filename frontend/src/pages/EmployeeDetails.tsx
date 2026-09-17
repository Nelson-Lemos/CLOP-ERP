import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { User } from '../types/user'
import type { TaskDetail } from '../types/task'
import { getUser } from '../services/users'
import { listTasks } from '../services/tasks'
import { getEmployeeProductivity } from '../services/dashboard'
import type { ProductivityMetrics } from '../types/report'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, tdStyle, thStyle, tableStyle } from '../components/ui/common'
import StatCard from '../components/ui/StatCard'

const ROLE_LABELS: Record<string, string> = {
  CEO: 'Administrador',
  MANAGER: 'Chefe',
  EMPLOYEE: 'Funcionário',
}

export default function EmployeeDetails() {
  const { id } = useParams()
  const userId = Number(id)
  const { user: authUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null)
  const [tasks, setTasks] = useState<TaskDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [u, m, t] = await Promise.all([getUser(userId), getEmployeeProductivity(userId), listTasks({ assigned_to: userId })])
        if (!active) return
        setUser(u)
        setMetrics(m)
        setTasks(t)
      } catch {
        if (active) setError('Não foi possível carregar os dados do funcionário.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [userId])

  if (loading) return <LoadingState />
  if (error || !user) return <ErrorState message={error || 'Funcionário não encontrado.'} onRetry={() => window.location.reload()} />

  const cardMeta = [
    { title: 'Tarefas', value: metrics?.total_tasks ?? 0, accent: 'gold' as const },
    { title: 'Concluídas', value: metrics?.completed_tasks ?? 0, accent: 'success' as const },
    { title: 'Atrasadas', value: metrics?.overdue_tasks ?? 0, accent: 'danger' as const },
    { title: 'Taxa de conclusão', value: `${metrics?.completion_rate ?? 0}%`, accent: 'gold' as const },
    { title: 'No prazo', value: `${metrics?.on_time_rate ?? 0}%`, accent: 'success' as const },
    { title: 'Pontuação', value: `${metrics?.weighted_score ?? 0}%`, accent: 'warning' as const },
  ]

  return (
    <div>
      <PageHeader
        title={user.nome_completo}
        subtitle={`${ROLE_LABELS[user.role]} · ${user.email}`}
        actions={
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <StatusBadge value={user.estado} />
            {authUser?.role !== 'EMPLOYEE' && <Link to="/employees" style={{ color: 'var(--clop-gold-light)', fontSize: '0.85rem' }}>Voltar</Link>}
          </div>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {cardMeta.map((c) => (
          <div key={c.title} style={{ flex: '1 1 150px', minWidth: 140 }}>
            <StatCard title={c.title} value={c.value} accent={c.accent} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Indicadores operacionais</h3>
          {metrics && (
            <table style={tableStyle}>
              <tbody>
                {[
                  ['Total de tarefas', metrics.total_tasks],
                  ['Concluídas', metrics.completed_tasks],
                  ['Pendentes', metrics.pending_tasks],
                  ['Atrasadas', metrics.overdue_tasks],
                  ['Rejeitadas', metrics.rejected_tasks],
                  ['Tempo médio de conclusão (h)', metrics.average_completion_time],
                ].map(([k, v]) => (
                  <tr key={String(k)}>
                    <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{String(k)}</td>
                    <td style={{ ...tdStyle, color: 'var(--clop-white)', fontWeight: 600 }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Tarefas recentes</h3>
          {tasks.length === 0 ? (
            <EmptyState message="Sem tarefas atribuídas." />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tarefa</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Progresso</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td style={{ ...tdStyle, color: 'var(--clop-white)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link to={`/tasks/${t.id}`} style={{ color: 'var(--clop-white)', textDecoration: 'none' }}>
                        {t.titulo}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge value={t.status} />
                    </td>
                    <td style={{ ...tdStyle, width: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ProgressBar value={t.progress} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--clop-gray)' }}>{t.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}