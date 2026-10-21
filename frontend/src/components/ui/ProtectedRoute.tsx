import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ErrorState } from './common'
import type { UserRole } from '../../types/user'

export default function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { isAuthenticated, loading, error, user } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--clop-gray)',
        }}
      >
        A carregar…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
