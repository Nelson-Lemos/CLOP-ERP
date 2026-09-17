export function LoadingState() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
      <span style={{ color: 'var(--clop-gray)', fontSize: '0.9rem' }}>A carregar…</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        border: '1px solid rgba(220,38,38,0.35)',
        background: 'rgba(220,38,38,0.08)',
        borderRadius: 'var(--clop-card-radius)',
        padding: '1.25rem',
      }}
    >
      <p style={{ color: 'var(--danger)', margin: '0 0 0.75rem' }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
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
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        border: '1px dashed var(--clop-card-border)',
        borderRadius: 'var(--clop-card-radius)',
        padding: '2.5rem',
        textAlign: 'center',
        color: 'var(--clop-gray)',
        fontSize: '0.9rem',
      }}
    >
      {message}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.3rem', color: 'var(--clop-gold-light)', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--clop-gray)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'var(--clop-gold)',
        color: '#050505',
        border: 'none',
        borderRadius: 8,
        padding: '0.5rem 1.1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick, disabled, type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        color: 'var(--clop-gold-light)',
        border: '1px solid rgba(212,167,44,0.4)',
        borderRadius: 8,
        padding: '0.5rem 1.1rem',
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function DangerButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        color: 'var(--danger)',
        border: '1px solid rgba(220,38,38,0.4)',
        borderRadius: 8,
        padding: '0.5rem 1.1rem',
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--clop-gray)' }}>
      {label}
      {children}
    </label>
  )
}

export const inputStyle: React.CSSProperties = {
  background: '#141414',
  border: '1px solid var(--clop-card-border)',
  borderRadius: 8,
  color: 'var(--clop-white)',
  padding: '0.5rem 0.7rem',
  fontSize: '0.88rem',
  outline: 'none',
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

export const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
}

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.65rem 0.85rem',
  color: 'var(--clop-gray)',
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--clop-card-border)',
  whiteSpace: 'nowrap',
}

export const tdStyle: React.CSSProperties = {
  padding: '0.7rem 0.85rem',
  borderBottom: '1px solid rgba(212,167,44,0.08)',
  color: 'var(--clop-white)',
}

export function ProgressBar({ value, color = 'var(--clop-gold)' }: { value: number; color?: string }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(212,167,44,0.15)', overflow: 'hidden', minWidth: 80 }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: 999 }} />
    </div>
  )
}