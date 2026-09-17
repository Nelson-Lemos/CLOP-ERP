import { type FormEvent, useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    window.location.href = '/'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError('Email ou password inválidos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--clop-black)',
        padding: '2rem',
      }}
    >
      <img
        src="/branding/logo-dark.jpeg"
        alt="CLOP"
        style={{ maxWidth: 220, height: 'auto', marginBottom: '1rem' }}
      />
      <p
        style={{
          color: 'var(--clop-gray)',
          fontSize: '0.85rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '2rem',
        }}
      >
        CLOP Management System
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            background: 'var(--clop-black-soft)',
            border: '1px solid var(--clop-card-border)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: 'var(--clop-white)',
            fontSize: '1rem',
            outline: 'none',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={{
            background: 'var(--clop-black-soft)',
            border: '1px solid var(--clop-card-border)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: 'var(--clop-white)',
            fontSize: '1rem',
            outline: 'none',
          }}
        />
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: 'var(--clop-gold)',
            color: '#050505',
            border: 'none',
            borderRadius: 8,
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            if (!submitting) e.currentTarget.style.background = 'var(--clop-gold-light)'
          }}
          onMouseOut={(e) => {
            if (!submitting) e.currentTarget.style.background = 'var(--clop-gold)'
          }}
        >
          {submitting ? 'A entrar…' : 'Entrar'}
        </button>
      </form>

      <p
        style={{
          marginTop: '3rem',
          color: 'var(--clop-gray)',
          fontSize: '0.75rem',
        }}
      >
        CLOP Academia Digital, LDA
      </p>
    </main>
  )
}