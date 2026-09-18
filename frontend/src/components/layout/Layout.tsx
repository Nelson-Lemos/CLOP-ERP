import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  ScrollText,
  Send,
  User,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import { unreadCount } from '../../services/notifications'
import type { UserRole } from '../../types/user'

interface MenuItem {
  to: string
  label: string
  icon: LucideIcon
  roles: UserRole[]
}

const MENU: MenuItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['CEO', 'MANAGER', 'EMPLOYEE'] },
  { to: '/employees', label: 'Funcionários', icon: Users, roles: ['CEO'] },
  { to: '/employees', label: 'Minha Equipe', icon: Users, roles: ['MANAGER'] },
  { to: '/departments', label: 'Departamentos', icon: Building2, roles: ['CEO'] },
  { to: '/tasks', label: 'Minhas Tarefas', icon: ClipboardList, roles: ['EMPLOYEE'] },
  { to: '/tasks', label: 'Tarefas', icon: ClipboardList, roles: ['CEO', 'MANAGER'] },
  { to: '/delegar', label: 'Delegar Tarefa', icon: Send, roles: ['CEO', 'MANAGER'] },
  { to: '/productivity', label: 'Meu Desempenho', icon: BarChart3, roles: ['EMPLOYEE'] },
  { to: '/productivity', label: 'Desempenho', icon: BarChart3, roles: ['MANAGER'] },
  { to: '/productivity', label: 'Produtividade', icon: BarChart3, roles: ['CEO'] },
  { to: '/reports', label: 'Relatórios', icon: FileText, roles: ['CEO', 'MANAGER'] },
  { to: '/notifications', label: 'Notificações', icon: Bell, roles: ['CEO', 'MANAGER', 'EMPLOYEE'] },
  { to: '/audit', label: 'Auditoria', icon: ScrollText, roles: ['CEO'] },
  { to: '/profile', label: 'Meu Perfil', icon: User, roles: ['CEO', 'MANAGER', 'EMPLOYEE'] },
]

const ROLE_LABEL: Record<UserRole, string> = {
  CEO: 'Administrador',
  MANAGER: 'Chefe de Departamento',
  EMPLOYEE: 'Funcionário',
}

export default function Layout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const n = await unreadCount()
        if (active) setUnread(n)
      } catch {
        return
      }
    }
    void load()
    const timer = window.setInterval(load, 30000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const items = user ? MENU.filter((item) => item.roles.includes(user.role)) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--clop-black)' }}>
      <aside
        className={`clop-sidebar${menuOpen ? ' open' : ''}`}
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
        <nav
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0.75rem 0' }}
          onClick={() => setMenuOpen(false)}
        >
          {items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.6rem 1.25rem',
                fontSize: '0.9rem',
                color: isActive ? 'var(--clop-gold-light)' : 'var(--clop-gray)',
                background: isActive ? 'var(--clop-sidebar-active-bg)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--clop-gold)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              })}
            >
              <item.icon size={18} strokeWidth={2} style={{ opacity: 0.9 }} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {menuOpen && <div className="clop-sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          className="clop-topbar"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="clop-menu-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="clop-topbar-brand" style={{ color: 'var(--clop-gray)', fontSize: '0.85rem' }}>
              CLOP Management
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              to="/notifications"
              title="Notificações"
              style={{ position: 'relative', display: 'flex', color: 'var(--clop-gray)', textDecoration: 'none' }}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    background: 'var(--clop-gold)',
                    color: '#050505',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    borderRadius: 999,
                    minWidth: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                  }}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            {user && (
              <div className="clop-topbar-user" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Avatar nome={user.nome_completo} foto={user.foto} size={34} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <span style={{ color: 'var(--clop-white)', fontSize: '0.8rem', fontWeight: 600 }}>
                    {user.nome_completo}
                  </span>
                  <span style={{ color: 'var(--clop-gray)', fontSize: '0.68rem' }}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </div>
              </div>
            )}
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
          </div>
        </header>

        <main className="clop-main" style={{ flex: 1, padding: '1.5rem', overflow: 'auto', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}