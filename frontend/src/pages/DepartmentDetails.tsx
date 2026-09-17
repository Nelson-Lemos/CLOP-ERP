import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Department } from '../types/department'
import type { User } from '../types/user'
import { getDepartment, listDepartmentEmployees } from '../services/departments'
import StatusBadge from '../components/ui/StatusBadge'
import { ErrorState, LoadingState, PageHeader, tableStyle, tdStyle, thStyle } from '../components/ui/common'

export default function DepartmentDetails() {
  const { id } = useParams()
  const deptId = Number(id)
  const [dept, setDept] = useState<Department | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [d, e] = await Promise.all([getDepartment(deptId), listDepartmentEmployees(deptId)])
        if (!active) return
        setDept(d)
        setEmployees(e)
      } catch {
        if (active) setError('Não foi possível carregar o departamento.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [deptId])

  if (loading) return <LoadingState />
  if (error || !dept) return <ErrorState message={error || 'Departamento não encontrado.'} onRetry={() => window.location.reload()} />

  return (
    <div>
      <PageHeader title={dept.nome} subtitle={dept.descricao ?? undefined} actions={<StatusBadge value={dept.estado} />} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 12, padding: '1.1rem' }}>
          <span style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--clop-gray)', textTransform: 'uppercase' }}>Chefe</span>
          <span style={{ fontSize: '1.1rem', color: 'var(--clop-white)', fontWeight: 600 }}>{dept.manager_nome ?? '—'}</span>
        </div>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 12, padding: '1.1rem' }}>
          <span style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--clop-gray)', textTransform: 'uppercase' }}>Funcionários</span>
          <span style={{ fontSize: '1.1rem', color: 'var(--clop-gold-light)', fontWeight: 600 }}>{dept.employee_count}</span>
        </div>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 12, padding: '1.1rem' }}>
          <span style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--clop-gray)', textTransform: 'uppercase' }}>Criado em</span>
          <span style={{ fontSize: '1rem', color: 'var(--clop-white)', fontWeight: 600 }}>{new Date(dept.created_at).toLocaleDateString('pt-PT')}</span>
        </div>
      </div>

      <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem' }}>Funcionários</h3>
      <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Cargo</th>
              <th style={thStyle}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td style={{ ...tdStyle, color: 'var(--clop-gray)' }} colSpan={4}>
                  Sem funcionários neste departamento.
                </td>
              </tr>
            ) : (
              employees.map((u) => (
                <tr key={u.id}>
                  <td style={tdStyle}>
                    <Link to={`/employees/${u.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                      {u.nome_completo}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{u.email}</td>
                  <td style={tdStyle}>{u.cargo || '—'}</td>
                  <td style={tdStyle}>
                    <StatusBadge value={u.estado} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}