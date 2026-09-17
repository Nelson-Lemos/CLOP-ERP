export default function StatCard({
  title,
  value,
  accent = 'gold',
  renderValue,
}: {
  title: string
  value?: string | number
  accent?: 'gold' | 'success' | 'danger' | 'warning' | 'blue'
  renderValue?: () => React.ReactNode
}) {
  const colors: Record<string, string> = {
    gold: 'var(--clop-gold-light)',
    success: 'var(--success)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    blue: '#4f86f7',
  }
  return (
    <div
      style={{
        background: 'var(--clop-card-bg)',
        border: '1px solid var(--clop-card-border)',
        borderRadius: 'var(--clop-card-radius)',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <span style={{ fontSize: '0.72rem', letterSpacing: '0.08em', color: 'var(--clop-gray)', textTransform: 'uppercase' }}>
        {title}
      </span>
      <span style={{ fontSize: '1.9rem', fontWeight: 700, color: colors[accent], lineHeight: 1 }}>
        {renderValue ? renderValue() : value}
      </span>
    </div>
  )
}