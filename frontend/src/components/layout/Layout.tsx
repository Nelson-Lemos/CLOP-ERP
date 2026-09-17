import { NavLink, Outlet } from 'react-router-dom'

const menu = [
  { to: '/', label: 'Dashboard' },
  { to: '/employees', label: 'Funcionários' },
  { to: '/departments', label: 'Departamentos' },
  { to: '/tasks', label: 'Tarefas' },
  { to: '/productivity', label: 'Produtividade' },
  { to: '/reports', label: 'Relatórios' },
  { to: '/notifications', label: 'Notificações' },
  { to: '/audit', label: 'Auditoria' },
]

export default function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--clop-black)' }}>
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: 'var(--clop-black)',
          borderRight: '1px solid var(--clop-card-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '1.25rem 0',
        }}
      >
        <div style={{ padding: '0 1.25rem 1rem', borderBottom: '1px solid var(--clop-card-border)' }}>
          <img src="/branding/logo-dark.jpeg" alt="CLOP" style={{ width: 140, height: 'auto' }} />
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0.75rem 0' }}>
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.6rem 1.25rem',
                fontSize: '0.9rem',
                color: isActive ? 'var(--clop-gold-light)' : 'var(--clop-gray)',
                background: isActive ? 'var(--clop-sidebar-active-bg)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--clop-gold)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            borderBottom: '1px solid var(--clop-card-border)',
            background: 'var(--clop-black-soft)',
          }}
        >
          <span style={{ color: 'var(--clop-gray)', fontSize: '0.85rem' }}>
            CLOP Management
          </span>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid var(--clop-card-border)',
              borderRadius: 6,
              color: 'var(--clop-gray)',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </header>

        <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}