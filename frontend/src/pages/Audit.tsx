import { useEffect, useState } from 'react'
import type { AuditLogItem } from '../types/report'
import { listAuditLogs } from '../services/reports'
import { EmptyState, ErrorState, LoadingState, PageHeader, tableStyle, tdStyle, thStyle } from '../components/ui/common'
import StatusBadge from '../components/ui/StatusBadge'

export default function Audit() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listAuditLogs({ limit: 300 })
      setItems(res.items)
    } catch {
      setError('Não foi possível carregar os registos de auditoria.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title="Auditoria" subtitle="Registo de ações administrativas" />

      {items.length === 0 ? (
        <EmptyState message="Sem registos de auditoria." />
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Utilizador</th>
                <th style={thStyle}>Ação</th>
                <th style={thStyle}>Entidade</th>
                <th style={thStyle}>IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('pt-PT')}</td>
                  <td style={tdStyle}>{log.username ?? `#${log.user_id}`}</td>
                  <td style={tdStyle}>
                    <StatusBadge value={log.action} />
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>
                    {log.entity}
                    {log.entity_id ? ` #${log.entity_id}` : ''}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{log.ip_address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}