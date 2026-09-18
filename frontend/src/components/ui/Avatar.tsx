import type { CSSProperties } from 'react'

export function initialsOf(nome: string): string {
  return (
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

interface AvatarProps {
  nome: string
  foto?: string | null
  size?: number
}

export default function Avatar({ nome, foto, size = 36 }: AvatarProps) {
  if (foto && foto.trim()) {
    return (
      <img
        src={foto.trim()}
        alt={nome}
        title={nome}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--clop-card-border)',
          background: 'var(--clop-black-soft)',
        }}
      />
    )
  }

  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(212,167,44,0.15)',
    border: '1px solid rgba(212,167,44,0.4)',
    color: 'var(--clop-gold-light)',
    fontSize: Math.round(size * 0.38),
    fontWeight: 600,
    userSelect: 'none',
  }

  return <span style={box}>{initialsOf(nome)}</span>
}