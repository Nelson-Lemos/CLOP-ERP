import { Component, type ErrorInfo, type ReactNode } from 'react'
import { tokenStorage } from '../../services/api'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[CLOP] Erro inesperado na interface:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleBackToLogin = (): void => {
    tokenStorage.clear()
    window.location.href = '/login'
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

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
          textAlign: 'center',
        }}
      >
        <img src="/branding/logo-dark.jpeg" alt="CLOP" style={{ maxWidth: 200, height: 'auto', marginBottom: '1.5rem' }} />
        <h1 style={{ color: 'var(--clop-gold-light)', fontSize: '1.15rem', margin: 0 }}>
          Ocorreu um erro inesperado
        </h1>
        <p style={{ color: 'var(--clop-gray)', fontSize: '0.85rem', maxWidth: 480, margin: '0.75rem 0 1.5rem' }}>
          {error.message || 'Não foi possível renderizar esta página.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: 'var(--clop-gold)',
              color: '#050505',
              border: 'none',
              borderRadius: 8,
              padding: '0.6rem 1.2rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          <button
            type="button"
            onClick={this.handleBackToLogin}
            style={{
              background: 'transparent',
              border: '1px solid rgba(212,167,44,0.4)',
              color: 'var(--clop-gold-light)',
              borderRadius: 8,
              padding: '0.6rem 1.2rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Voltar ao início de sessão
          </button>
        </div>
        <p style={{ marginTop: '2.5rem', color: 'var(--clop-gray)', fontSize: '0.75rem' }}>
          CLOP Academia Digital, LDA
        </p>
      </main>
    )
  }
}
