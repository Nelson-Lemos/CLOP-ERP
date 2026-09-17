import { useEffect, useState } from 'react'
import type { NotificationItem } from '../types/report'
import { listNotifications, markAllRead, markRead } from '../services/notifications'
import { EmptyState, ErrorState, LoadingState, PageHeader, PrimaryButton } from '../components/ui/common'

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listNotifications())
    } catch {
      setError('Não foi possível carregar as notificações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const clickRead = async (n: NotificationItem) => {
    if (n.is_read) return
    try {
      await markRead(n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    } catch {
      setError('Não foi possível marcar como lida.')
    }
  }

  const readAll = async () => {
    try {
      await markAllRead()
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    } catch {
      setError('Não foi possível marcar tudo como lido.')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle={unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo lido'}
        actions={
          unread > 0 ? (
            <>
              <PrimaryButton onClick={() => void readAll()}>Marcar todas como lidas</PrimaryButton>
            </>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState message="Sem notificações." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => void clickRead(n)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: n.is_read ? 'var(--clop-card-bg)' : 'rgba(212,167,44,0.07)',
                border: `1px solid ${n.is_read ? 'var(--clop-card-border)' : 'rgba(212,167,44,0.4)'}`,
                borderRadius: 'var(--clop-card-radius)',
                padding: '0.9rem 1.1rem',
                cursor: 'pointer',
                color: 'var(--clop-white)',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                <span style={{ fontWeight: n.is_read ? 500 : 700, color: n.is_read ? 'var(--clop-white)' : 'var(--clop-gold-light)' }}>{n.title}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--clop-gray)', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString('pt-PT')}</span>
              </div>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--clop-gray)' }}>{n.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}