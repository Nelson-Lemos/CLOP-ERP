import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/user'

export default function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user, loading } = useAuth()

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

  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}