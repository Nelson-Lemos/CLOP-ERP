import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closeChecklist,
  getChecklist,
  reopenChecklist,
  saveChecklist,
} from '../services/trading'
import { isAdminRole } from '../types/user'
import { useAuth } from '../hooks/useAuth'
import OperatorPicker from '../components/ui/OperatorPicker'
import {
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputStyle,
} from '../components/ui/common'
import type { Checklist, ChecklistPayload } from '../types/trading'

const EMPTY_FORM: ChecklistPayload = {
  s01_sono: false,
  s01_fisico: false,
  s01_emocional: false,
  s01_plano: false,
  s01_gestao_risco: false,
  s02_pre_trading: false,
  s02_atividade: null,
  s03_noticias: false,
  s03_360: false,
  s03_ativos: null,
  s05_planilha: false,
  s05_gerenciamento: false,
  s05_seguimento: false,
  s05_nota: null,
  s05_aprendizado: null,
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function precheckDone(form: ChecklistPayload): boolean {
  return (
    form.s01_sono &&
    form.s01_fisico &&
    form.s01_emocional &&
    form.s01_plano &&
    form.s01_gestao_risco &&
    form.s02_pre_trading &&
    form.s03_noticias &&
    form.s03_360
  )
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        fontSize: '0.88rem',
        color: disabled ? 'var(--clop-gray)' : 'var(--clop-white)',
        cursor: disabled ? 'default' : 'pointer',
        padding: '0.25rem 0',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--clop-gold)', width: 16, height: 16 }}
      />
      {label}
    </label>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--clop-card-bg)',
        border: '1px solid var(--clop-card-border)',
        borderRadius: 'var(--clop-card-radius)',
        padding: '1.25rem',
      }}
    >
      <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>{title}</h2>
      {children}
    </section>
  )
}

export default function TradingChecklist() {
  const { user } = useAuth()
  const canManage = !!user && (isAdminRole(user.role) || user.role === 'MANAGER')

  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [day, setDay] = useState(todayIso())
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [form, setForm] = useState<ChecklistPayload>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const item = await getChecklist(day, operatorId)
      setChecklist(item)
      if (item) {
        const { s02_atividade, s03_ativos, s05_aprendizado, ...rest } = item
        setForm({
          ...rest,
          s02_atividade: s02_atividade ?? null,
          s03_ativos: s03_ativos ?? null,
          s05_aprendizado: s05_aprendizado ?? null,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    } catch {
      setError('Não foi possível carregar o checklist do dia.')
    } finally {
      setLoading(false)
    }
  }, [day, operatorId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const readonly = !!checklist?.fechado && !canManage
  const precheck = precheckDone(form)

  const handleSave = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const saved = await saveChecklist(day, form, operatorId)
      setChecklist(saved)
      setFeedback('Rascunho guardado.')
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : 'Erro ao guardar o checklist.')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseDay = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const closed = await closeChecklist(day, operatorId)
      setChecklist(closed)
      setFeedback('Dia fechado. O checklist passou a somente leitura.')
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : 'Erro ao fechar o dia.')
    } finally {
      setSaving(false)
    }
  }

  const handleReopen = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const reopened = await reopenChecklist(day, operatorId)
      setChecklist(reopened)
      setFeedback('Dia reaberto (registo de auditoria criado).')
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : 'Erro ao reabrir o dia.')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof ChecklistPayload>(key: K, value: ChecklistPayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title="Checklist Operacional do Dia"
        subtitle="Preencha antes de operar. Secções 01 a 03 são pré-requisito para registar operações."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="date" style={inputStyle} value={day} onChange={(e) => setDay(e.target.value)} />
            {canManage && <OperatorPicker value={operatorId} onChange={setOperatorId} />}
          </div>
        }
      />

      {canManage && !operatorId && (
        <p style={{ color: 'var(--clop-gray)', fontSize: '0.8rem', marginTop: '-0.75rem' }}>
          Está a ver os seus próprios registos. Use o selector para ver outro operador.
        </p>
      )}

      {checklist?.fechado && canManage && (
        <div
          style={{
            background: 'rgba(212,167,44,0.08)',
            border: '1px solid rgba(212,167,44,0.35)',
            borderRadius: 10,
            padding: '0.7rem 1rem',
            marginBottom: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            color: 'var(--clop-gold-light)',
            fontSize: '0.82rem',
          }}
        >
          <span>
            Dia fechado {checklist.fechado_em ? `em ${new Date(checklist.fechado_em).toLocaleString('pt-PT')}` : ''}. Alterações registadas em auditoria.
          </span>
          <GhostButton onClick={() => void handleReopen()} disabled={saving}>
            Reabrir dia
          </GhostButton>
        </div>
      )}

      {!checklist?.fechado && !precheck && (
        <div
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.35)',
            borderRadius: 10,
            padding: '0.7rem 1rem',
            marginBottom: '0.9rem',
            color: 'var(--warning)',
            fontSize: '0.82rem',
          }}
        >
          Aviso: as secções 01 a 03 ainda não estão concluídas. Não poderá registar operações no diário deste dia até as concluir.
        </div>
      )}

      {feedback && (
        <div
          style={{
            background: 'rgba(212,167,44,0.08)',
            border: '1px solid var(--clop-card-border)',
            borderRadius: 10,
            padding: '0.7rem 1rem',
            marginBottom: '0.9rem',
            color: 'var(--clop-gold-light)',
            fontSize: '0.82rem',
          }}
        >
          {feedback}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <SectionCard title="Secção 01 · Estado Mental — Como estou me sentindo hoje?">
          <Check label="Tive uma boa noite de sono" checked={form.s01_sono} onChange={(v) => set('s01_sono', v)} disabled={readonly} />
          <Check label="Estou fisicamente bem" checked={form.s01_fisico} onChange={(v) => set('s01_fisico', v)} disabled={readonly} />
          <Check label="Estou emocionalmente estável" checked={form.s01_emocional} onChange={(v) => set('s01_emocional', v)} disabled={readonly} />
          <Check label="Estou disposto(a) a seguir meu plano operacional" checked={form.s01_plano} onChange={(v) => set('s01_plano', v)} disabled={readonly} />
          <Check label="Gestão de risco definida" checked={form.s01_gestao_risco} onChange={(v) => set('s01_gestao_risco', v)} disabled={readonly} />
        </SectionCard>

        <SectionCard title="Secção 02 · Pré-Trading">
          <Check label="Realizei meu pré-trading antes de operar" checked={form.s02_pre_trading} onChange={(v) => set('s02_pre_trading', v)} disabled={readonly} />
          <div style={{ marginTop: '0.6rem' }}>
            <FormField label="Qual atividade realizei hoje?">
              <input
                style={{ ...inputStyle, width: '100%' }}
                value={form.s02_atividade ?? ''}
                disabled={readonly}
                maxLength={1000}
                onChange={(e) => set('s02_atividade', e.target.value || null)}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Secção 03 · Preparação para o Mercado">
          <Check label="Verifiquei as notícias do dia" checked={form.s03_noticias} onChange={(v) => set('s03_noticias', v)} disabled={readonly} />
          <Check label="Fiz meu 360°" checked={form.s03_360} onChange={(v) => set('s03_360', v)} disabled={readonly} />
          <div style={{ marginTop: '0.6rem' }}>
            <FormField label="Ativos escolhidos para operar hoje (separe por vírgula)">
              <input
                style={{ ...inputStyle, width: '100%' }}
                value={form.s03_ativos ?? ''}
                disabled={readonly}
                placeholder="EURUSD, BTCUSD, XAUUSD…"
                maxLength={500}
                onChange={(e) => set('s03_ativos', e.target.value || null)}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Secção 04 · Execução do Método">
          <p style={{ color: 'var(--clop-gray)', fontSize: '0.85rem', margin: 0 }}>
            Os passos 1 a 7 (captura de liquidez, tendências macro/mediana/micro, projeção, entrada e gerenciamento) são
            registados <strong style={{ color: 'var(--clop-gold-light)' }}>por operação</strong>, no{' '}
            <Link to="/trading/diario" style={{ color: 'var(--clop-gold-light)' }}>
              Diário de Operações
            </Link>
            .
          </p>
        </SectionCard>

        <SectionCard title="Secção 05 · Pós-Operação (fim do dia)">
          <Check label="Preenchi minha planilha" checked={form.s05_planilha} onChange={(v) => set('s05_planilha', v)} disabled={readonly} />
          <Check label="Respeitei meu gerenciamento de risco" checked={form.s05_gerenciamento} onChange={(v) => set('s05_gerenciamento', v)} disabled={readonly} />
          <Check label="Segui meu plano operacional" checked={form.s05_seguimento} onChange={(v) => set('s05_seguimento', v)} disabled={readonly} />
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
            <FormField label="Nota para minha execução (1 a 5)">
              <select
                style={{ ...inputStyle, minWidth: 120 }}
                value={form.s05_nota ?? ''}
                disabled={readonly}
                onChange={(e) => set('s05_nota', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div style={{ marginTop: '0.7rem' }}>
            <FormField label="Maior aprendizado de hoje">
              <textarea
                style={{ ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical' }}
                value={form.s05_aprendizado ?? ''}
                disabled={readonly}
                maxLength={2000}
                onChange={(e) => set('s05_aprendizado', e.target.value || null)}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      {!readonly && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
          <PrimaryButton onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar rascunho'}
          </PrimaryButton>
          <GhostButton onClick={() => void handleCloseDay()} disabled={saving || !precheck}>
            Fechar o dia
          </GhostButton>
          {!precheck && (
            <span style={{ color: 'var(--clop-gray)', fontSize: '0.78rem', alignSelf: 'center' }}>
              Conclua as secções 01 a 03 para poder fechar o dia.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
