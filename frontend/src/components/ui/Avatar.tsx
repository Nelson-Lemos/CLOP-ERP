import { useEffect, useState, type CSSProperties } from 'react'
import { mediaUrl } from '../../services/api'

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
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [foto])

  if (foto && foto.trim() && !imageFailed) {
    return (
      <img
        src={mediaUrl(foto)}
        alt={nome}
        title={nome}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
        style={{
          width: size,
          height: size,
          display: 'block',
          flex: '0 0 auto',
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