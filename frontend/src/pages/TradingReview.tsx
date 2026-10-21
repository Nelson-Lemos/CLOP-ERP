import { useCallback, useEffect, useState } from 'react'
import { evidenceImageUrl, getReviewQueue, reviewTrade } from '../services/trading'
import { isAdminRole } from '../types/user'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/ui/Modal'
import OperatorPicker from '../components/ui/OperatorPicker'
import {
  EmptyState,
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputStyle,
  selectStyle,
} from '../components/ui/common'
import {
  DIRECAO_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  EVIDENCIA_TIPO_LABELS,
  MINDSET_LABELS,
  REVISAO_ESTADO_COLORS,
  REVISAO_ESTADO_LABELS,
  type Evidence,
  type Mindset,
  type RevisaoDecision,
  type RevisaoEstado,
  type Trade,
  type TradeEstado,
} from '../types/trading'

function EvidencePreview({ evidence }: { evidence: Evidence }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    evidenceImageUrl(evidence.id)
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [evidence.id])
  return (
    <figure style={{ margin: 0, border: '1px solid rgba(212,167,44,0.25)', borderRadius: 8, overflow: 'hidden', background: '#050505' }}>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          <img src={src} alt={evidence.filename} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }} />
        </a>
      ) : (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--clop-gray)' }}>
          A carregar…
        </div>
      )}
      <figcaption style={{ fontSize: '0.66rem', color: 'var(--clop-gray)', padding: '0.3rem 0.45rem' }}>
        {EVIDENCIA_TIPO_LABELS[evidence.tipo]} · {evidence.uploader_nome ?? '—'} · {new Date(evidence.uploaded_at).toLocaleString('pt-PT')}
        {evidence.alerta_hash_duplicado && <strong style={{ color: 'var(--danger)' }}> · hash reutilizado</strong>}
        {evidence.alerta_upload_tardio && <strong style={{ color: 'var(--warning)' }}> · upload tardio</strong>}
      </figcaption>
    </figure>
  )
}

interface ReviewFilters {
  revisaoEstado: RevisaoEstado | ''
  resultado: TradeEstado | ''
  seguiuPlano: 'SIM' | 'NAO' | ''
  semEvidencia: 'SIM' | 'NAO' | ''
  ativo: string
}

const EMPTY_FILTERS: ReviewFilters = { revisaoEstado: 'NAO_REVISADA', resultado: '', seguiuPlano: '', semEvidencia: '', ativo: '' }

export default function TradingReview() {
  const { user } = useAuth()
  const canReview = !!user && (isAdminRole(user.role) || user.role === 'MANAGER' || user.role === 'TRADING_LEADER')

  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [filters, setFilters] = useState<ReviewFilters>(EMPTY_FILTERS)
  const [items, setItems] = useState<Trade[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [active, setActive] = useState<Trade | null>(null)
  const [decision, setDecision] = useState<RevisaoDecision>('APROVADA')
  const [comentario, setComentario] = useState('')
  const [divergencia, setDivergencia] = useState<boolean | null>(null)
  const [decisionError, setDecisionError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const queue = await getReviewQueue({
        operatorId,
        ativo: filters.ativo.trim() || undefined,
        revisaoEstado: filters.revisaoEstado || undefined,
        resultado: filters.resultado || undefined,
        seguiuPlano: filters.seguiuPlano === '' ? null : filters.seguiuPlano === 'SIM',
        semEvidencia: filters.semEvidencia === '' ? null : filters.semEvidencia === 'NAO',
        limit: 100,
      })
      setItems(queue.items)
      setTotal(queue.total)
    } catch {
      setError('Não foi possível carregar a fila de revisão.')
    } finally {
      setLoading(false)
    }
  }, [operatorId, filters])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const openReview = (trade: Trade) => {
    setActive(trade)
    setDecision('APROVADA')
    setComentario('')
    setDivergencia(null)
    setDecisionError('')
  }

  const submit = async () => {
    if (!active) return
    if (comentario.trim().length < 3) {
      setDecisionError('Escreva um comentário com pelo menos 3 caracteres.')
      return
    }
    setSaving(true)
    setDecisionError('')
    try {
      await reviewTrade(active.id, {
        decision,
        comentario: comentario.trim(),
        divergencia_plano: decision === 'APROVADA' ? null : divergencia,
      })
      setActive(null)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setDecisionError(typeof detail === 'string' ? detail : 'Erro ao registar a revisão.')
    } finally {
      setSaving(false)
    }
  }

  if (!canReview) {
    return <EmptyState message="A fila de revisão está disponível para líderes de produção, chefes e administração." />
  }

  const setFilter = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div>
      <PageHeader
        title="Fila de Revisão"
        subtitle="Operações fechadas ainda não revistas, com as capturas ao lado dos dados declarados."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <OperatorPicker value={operatorId} onChange={setOperatorId} />
            <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={filters.revisaoEstado} onChange={(e) => setFilter('revisaoEstado', e.target.value as RevisaoEstado | '')}>
              <option value="">Revisão: todas</option>
              {(Object.keys(REVISAO_ESTADO_LABELS) as RevisaoEstado[]).map((key) => (
                <option key={key} value={key}>
                  {REVISAO_ESTADO_LABELS[key]}
                </option>
              ))}
            </select>
            <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={filters.resultado} onChange={(e) => setFilter('resultado', e.target.value as TradeEstado | '')}>
              <option value="">Resultado: todos</option>
              <option value="GANHOU">Ganhou</option>
              <option value="PERDEU">Perdeu</option>
            </select>
            <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={filters.seguiuPlano} onChange={(e) => setFilter('seguiuPlano', e.target.value as 'SIM' | 'NAO' | '')}>
              <option value="">Plano: todos</option>
              <option value="SIM">Seguiu o plano</option>
              <option value="NAO">Não seguiu</option>
            </select>
            <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={filters.semEvidencia} onChange={(e) => setFilter('semEvidencia', e.target.value as 'SIM' | 'NAO' | '')}>
              <option value="">Evidência: todas</option>
              <option value="NAO">Com evidência</option>
              <option value="SIM">Sem evidência</option>
            </select>
            <input
              style={{ ...inputStyle, width: 120, fontSize: '0.8rem' }}
              placeholder="Ativo"
              maxLength={30}
              value={filters.ativo}
              onChange={(e) => setFilter('ativo', e.target.value)}
            />
            <GhostButton onClick={() => setFilters(EMPTY_FILTERS)}>Limpar</GhostButton>
          </div>
        }
      />

      <p style={{ fontSize: '0.8rem', color: 'var(--clop-gray)', marginBottom: '0.8rem' }}>
        {total} operação(ões) na fila.
      </p>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && <EmptyState message="Sem operações para os filtros seleccionados." />}

      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {items.map((trade) => (
            <div
              key={trade.id}
              style={{
                background: 'var(--clop-card-bg)',
                border: '1px solid var(--clop-card-border)',
                borderRadius: 'var(--clop-card-radius)',
                padding: '0.9rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) minmax(240px, 2fr) auto',
                gap: '0.9rem',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--clop-white)', fontSize: '0.95rem' }}>{trade.ativo}</strong>
                  <span>{DIRECAO_LABELS[trade.direcao]}</span>
                  <span style={{ color: ESTADO_COLORS[trade.estado] }}>{ESTADO_LABELS[trade.estado]}</span>
                </div>
                <span style={{ color: 'var(--clop-gray)' }}>
                  {new Date(`${trade.data_operacao}T00:00:00`).toLocaleDateString('pt-PT')} · {trade.operator_nome ?? 'Operador'}
                </span>
                <span style={{ color: 'var(--clop-gray)' }}>
                  Entrada: {trade.preco_entrada ?? '—'} · Stop: {trade.preco_stop ?? '—'} · Alvo: {trade.preco_alvo ?? '—'} · Saída:{' '}
                  {trade.preco_saida ?? '—'}
                </span>
                <span style={{ color: trade.valor_finaneiro === null ? 'var(--clop-gray)' : trade.valor_finaneiro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  Valor: {trade.valor_finaneiro !== null ? `US$ ${trade.valor_finaneiro.toFixed(2)}` : '—'} · R:R{' '}
                  {trade.risco_retorno !== null ? `1:${trade.risco_retorno}` : '—'}
                </span>
                <span style={{ color: trade.seguiu_plano ? 'var(--success)' : 'var(--danger)' }}>
                  {trade.seguiu_plano ? 'Seguiu o plano' : 'Não seguiu o plano'}
                  {trade.divergencia_plano && <strong style={{ color: 'var(--danger)' }}> · divergência do líder</strong>}
                </span>
                {trade.mindset && <span style={{ color: 'var(--clop-gray)' }}>Mindset: {MINDSET_LABELS[trade.mindset as Mindset] ?? trade.mindset}</span>}
                {trade.observacoes && <span style={{ color: 'var(--clop-gray)', fontStyle: 'italic' }}>“{trade.observacoes}”</span>}
                <span
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start',
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 999,
                    color: REVISAO_ESTADO_COLORS[trade.revisao_estado],
                    background: `${REVISAO_ESTADO_COLORS[trade.revisao_estado]}1f`,
                    border: `1px solid ${REVISAO_ESTADO_COLORS[trade.revisao_estado]}55`,
                  }}
                >
                  {REVISAO_ESTADO_LABELS[trade.revisao_estado]}
                </span>
                {trade.revisoes.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: '1px solid var(--clop-card-border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {trade.revisoes.map((r) => (
                      <p key={r.id} style={{ margin: 0, fontSize: '0.72rem', color: 'var(--clop-gray)' }}>
                        <strong style={{ color: 'var(--clop-gold-light)' }}>{r.user_nome ?? '—'}:</strong> {r.comentario}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {trade.evidencias.length === 0 ? (
                  <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0, border: '1px dashed rgba(220,38,38,0.4)', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                    Sem evidência anexada — fica sinalizada e excluída das estatísticas validadas.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                    {trade.evidencias.map((e) => (
                      <EvidencePreview key={e.id} evidence={e} />
                    ))}
                  </div>
                )}
              </div>

              <PrimaryButton onClick={() => openReview(trade)}>Rever</PrimaryButton>
            </div>
          ))}
        </div>
      )}

      <Modal open={active !== null} title={`Revisar ${active?.ativo ?? ''} · ${active ? new Date(`${active.data_operacao}T00:00:00`).toLocaleDateString('pt-PT') : ''}`} onClose={() => setActive(null)} width={560}>
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <FormField label="Decisão">
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {([
                  ['APROVADA', 'Aprovar'],
                  ['INCONSISTENTE', 'Reprovar / inconsistente'],
                  ['CORRECAO_PEDIDA', 'Pedir correcção'],
                ] as Array<[RevisaoDecision, string]>).map(([value, label]) => (
                  <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === value}
                      onChange={() => setDecision(value)}
                      style={{ accentColor: 'var(--clop-gold)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FormField>

            {decision !== 'APROVADA' && (
              <FormField label="O operador divergiu do plano?">
                <select
                  style={selectStyle}
                  value={divergencia === null ? '' : divergencia ? 'S' : 'N'}
                  onChange={(e) => setDivergencia(e.target.value === '' ? null : e.target.value === 'S')}
                >
                  <option value="">Não avaliar</option>
                  <option value="N">Não — o operador está de acordo</option>
                  <option value="S">Sim — marcar divergência</option>
                </select>
              </FormField>
            )}

            <FormField label="Comentário (obrigatório)">
              <textarea
                style={{ ...inputStyle, width: '100%', minHeight: 90, resize: 'vertical' }}
                value={comentario}
                maxLength={2000}
                placeholder={decision === 'APROVADA' ? 'Ex.: Entrada conforme o método, evidências consistentes.' : 'Descreva a inconsistência ou o que deve ser corrigido.'}
                onChange={(e) => setComentario(e.target.value)}
              />
            </FormField>

            {decisionError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{decisionError}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
              <GhostButton onClick={() => setActive(null)} disabled={saving}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={() => void submit()} disabled={saving}>
                {saving ? 'A registar…' : 'Registar revisão'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
