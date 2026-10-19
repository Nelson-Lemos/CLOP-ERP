import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checklistStatus,
  createTrade,
  deleteTrade,
  getMethodTemplate,
  listTrades,
  updateTrade,
} from '../services/trading'
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
  DangerButton,
  inputStyle,
  selectStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../components/ui/common'
import {
  DIRECAO_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  MACRO_DIRECAO_LABELS,
  MACRO_VIES_LABELS,
  MINDSET_LABELS,
  REGIAO_LABELS,
  type MacroBias,
  type MacroDirection,
  type Mindset,
  type MethodPayload,
  type PriceRegion,
  type Trade,
  type TradeDirection,
  type TradeEstado,
  type TradePayload,
} from '../types/trading'

const EMPTY_METHOD: MethodPayload = {
  passo1_captura_liquidez: false,
  macro_direcao: null,
  macro_vies: null,
  mediana_corretivo: false,
  mediana_regiao: null,
  mediana_captura_asia: false,
  micro_capturou_liquidez: false,
  micro_reagiu_poi: false,
  micro_ineficiencia: false,
  micro_quebrou_estrutura: false,
  proj_fibonacci: false,
  proj_ote: false,
  proj_order_blocks: false,
  proj_fvg: false,
  entrada_aguardou_interna: false,
  entrada_captura_interna: false,
  entrada_reagiu_ob: false,
  entrada_executada: false,
  ger_stop_110: false,
  alvo_fib_extensao: false,
  alvo_liquidez_externa: false,
  alvo_pdl_pdh: false,
  alvo_asia: false,
  alvo_ponto_parada: false,
  observacoes: null,
}

interface TradeForm {
  data_operacao: string
  ativo: string
  direcao: TradeDirection
  estado: TradeEstado
  valor_finaneiro: string
  risco_retorno: string
  seguiu_plano: boolean
  mindset: string
  observacoes: string
  method: MethodPayload
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function emptyForm(): TradeForm {
  return {
    data_operacao: todayIso(),
    ativo: '',
    direcao: 'COMPRA',
    estado: 'PENDENTE',
    valor_finaneiro: '',
    risco_retorno: '',
    seguiu_plano: true,
    mindset: '',
    observacoes: '',
    method: EMPTY_METHOD,
  }
}

function tradeToForm(trade: Trade): TradeForm {
  return {
    data_operacao: trade.data_operacao,
    ativo: trade.ativo,
    direcao: trade.direcao,
    estado: trade.estado,
    valor_finaneiro: trade.valor_finaneiro !== null ? String(trade.valor_finaneiro) : '',
    risco_retorno: trade.risco_retorno !== null ? String(trade.risco_retorno) : '',
    seguiu_plano: trade.seguiu_plano,
    mindset: trade.mindset ?? '',
    observacoes: trade.observacoes ?? '',
    method: trade.method ? methodFrom(trade) : EMPTY_METHOD,
  }
}

function methodFrom(trade: Trade): MethodPayload {
  const { id: _id, trade_id: _tradeId, ...method } = trade.method as NonNullable<Trade['method']>
  return method
}

function validateForm(form: TradeForm): string | null {
  if (!form.data_operacao) return 'Indique a data da operação.'
  if (!form.ativo.trim()) return 'Indique o ativo.'
  const closed = form.estado === 'GANHOU' || form.estado === 'PERDEU'
  if (closed) {
    const value = Number(form.valor_finaneiro)
    if (!form.valor_finaneiro.trim() || Number.isNaN(value) || value === 0) return 'Informe o valor financeiro da operação fechada.'
    if (form.estado === 'GANHOU' && value < 0) return 'Operações ganhas devem ter valor positivo.'
    if (form.estado === 'PERDEU' && value > 0) return 'Operações perdidas devem ter valor negativo.'
  }
  if (form.risco_retorno.trim() && Number.isNaN(Number(form.risco_retorno))) return 'Risco:Retorno deve ser numérico (ex.: 3 para 1:3).'
  return null
}

function toPayload(form: TradeForm): TradePayload {
  const closed = form.estado === 'GANHOU' || form.estado === 'PERDEU'
  return {
    data_operacao: form.data_operacao,
    ativo: form.ativo.trim(),
    direcao: form.direcao,
    estado: form.estado,
    valor_finaneiro: closed && form.valor_finaneiro.trim() ? Number(form.valor_finaneiro) : null,
    risco_retorno: form.risco_retorno.trim() ? Number(form.risco_retorno) : null,
    seguiu_plano: form.seguiu_plano,
    mindset: form.mindset || null,
    observacoes: form.observacoes.trim() || null,
    method: form.method,
  }
}

function MethodChecks({
  method,
  onChange,
  disabled,
}: {
  method: MethodPayload
  onChange: (next: MethodPayload) => void
  disabled?: boolean
}) {
  const set = <K extends keyof MethodPayload>(key: K, value: MethodPayload[K]) => onChange({ ...method, [key]: value })
  const boxes: Array<[string, keyof MethodPayload]> = [
    ['Passo 1 · O preço já capturou a máxima (PDH) ou a mínima (PDL) do dia anterior?', 'passo1_captura_liquidez'],
    ['Identifiquei o movimento corretivo', 'mediana_corretivo'],
    ['Capturou a máxima ou mínima da Ásia', 'mediana_captura_asia'],
    ['Capturou uma liquidez importante', 'micro_capturou_liquidez'],
    ['Reagiu em um POI (Order Block) válido', 'micro_reagiu_poi'],
    ['Gerou ineficiência (movimento agressivo)', 'micro_ineficiencia'],
    ['Quebrou uma estrutura válida', 'micro_quebrou_estrutura'],
    ['Projete a Fibonacci de extensão', 'proj_fibonacci'],
    ['Identifique níveis de OTE (Premium e Discount)', 'proj_ote'],
    ['Marque os Order Blocks válidos', 'proj_order_blocks'],
    ['Na ausência de Order Block, utilize um FVG', 'proj_fvg'],
    ['Aguarde o ativo gerar liquidez interna', 'entrada_aguardou_interna'],
    ['Aguarde a captura da liquidez interna', 'entrada_captura_interna'],
    ['O preço reagiu no Order Block da microestrutura', 'entrada_reagiu_ob'],
    ['Entrada executada', 'entrada_executada'],
    ['Stop posicionado em 110% da Fibonacci', 'ger_stop_110'],
  ]
  const alvos: Array<[string, keyof MethodPayload]> = [
    ['Fibonacci de extensão (100%)', 'alvo_fib_extensao'],
    ['Liquidez externa', 'alvo_liquidez_externa'],
    ['Captura de PDL ou PDH', 'alvo_pdl_pdh'],
    ['Máxima ou mínima da Ásia', 'alvo_asia'],
    ['Ponto de parada do preço (Order Block válido)', 'alvo_ponto_parada'],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--clop-gold-light)', margin: '0.4rem 0' }}>
        Passo 2 · Análise tendência macro
      </p>
      <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
        {(['ALTA', 'BAIXA'] as MacroDirection[]).map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="macro_direcao"
              checked={method.macro_direcao === option}
              disabled={disabled}
              onChange={() => set('macro_direcao', option)}
              style={{ accentColor: 'var(--clop-gold)' }}
            />
            {MACRO_DIRECAO_LABELS[option]}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem' }}>
        {(['A_FAVOR', 'CONTRA'] as MacroBias[]).map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="macro_vies"
              checked={method.macro_vies === option}
              disabled={disabled}
              onChange={() => set('macro_vies', option)}
              style={{ accentColor: 'var(--clop-gold)' }}
            />
            {MACRO_VIES_LABELS[option]}
          </label>
        ))}
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--clop-gold-light)', margin: '0.6rem 0 0' }}>
        Passo 3 · O preço está em região cara ou barata?
      </p>
      <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
        {(['CARA', 'BARATA'] as PriceRegion[]).map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mediana_regiao"
              checked={method.mediana_regiao === option}
              disabled={disabled}
              onChange={() => set('mediana_regiao', option)}
              style={{ accentColor: 'var(--clop-gold)' }}
            />
            {REGIAO_LABELS[option]}
          </label>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--clop-gray)', margin: '0.35rem 0 0' }}>
        Macro de baixa: capture primeiro o PDH e os topos da correção. Macro de alta: capture primeiro o PDL e os fundos da correção.
      </p>

      <p style={{ fontSize: '0.78rem', color: 'var(--clop-gold-light)', margin: '0.7rem 0 0.2rem' }}>Passos 1, 4, 5 e 6</p>
      {boxes.map(([label, key]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.15rem 0' }}>
          <input
            type="checkbox"
            checked={Boolean(method[key])}
            disabled={disabled}
            onChange={(e) => set(key, e.target.checked as never)}
            style={{ accentColor: 'var(--clop-gold)', width: 15, height: 15 }}
          />
          {label}
        </label>
      ))}

      <p style={{ fontSize: '0.78rem', color: 'var(--clop-gold-light)', margin: '0.6rem 0 0.2rem' }}>Passo 7 · Alvos (multi-seleção)</p>
      {alvos.map(([label, key]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.15rem 0' }}>
          <input
            type="checkbox"
            checked={Boolean(method[key])}
            disabled={disabled}
            onChange={(e) => set(key, e.target.checked as never)}
            style={{ accentColor: 'var(--clop-gold)', width: 15, height: 15 }}
          />
          {label}
        </label>
      ))}

      <div style={{ marginTop: '0.6rem' }}>
        <FormField label="Observações do método">
          <textarea
            style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical' }}
            value={method.observacoes ?? ''}
            disabled={disabled}
            maxLength={2000}
            onChange={(e) => set('observacoes', e.target.value || null)}
          />
        </FormField>
      </div>
    </div>
  )
}

export default function TradingJournal() {
  const { user } = useAuth()
  const canManage = !!user && (isAdminRole(user.role) || user.role === 'MANAGER')

  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [month, setMonth] = useState(todayIso().slice(0, 7))
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Trade | null>(null)
  const [form, setForm] = useState<TradeForm>(emptyForm)
  const [methodOpen, setMethodOpen] = useState(false)
  const [dayPrecheck, setDayPrecheck] = useState<{ existe: boolean; precheck_concluido: boolean }>({ existe: false, precheck_concluido: false })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const inicio = `${month}-01`
      const [year, m] = month.split('-').map(Number)
      const lastDay = new Date(year, m, 0).getDate()
      const items = await listTrades({
        operatorId,
        dataInicio: inicio,
        dataFim: `${month}-${String(lastDay).padStart(2, '0')}`,
      })
      setTrades(items)
    } catch {
      setError('Não foi possível carregar as operações.')
    } finally {
      setLoading(false)
    }
  }, [month, operatorId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  useEffect(() => {
    if (!modalOpen) return
    let active = true
    checklistStatus(form.data_operacao, editing ? null : operatorId)
      .then((status) => {
        if (active) setDayPrecheck({ existe: status.existe, precheck_concluido: status.precheck_concluido })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [modalOpen, form.data_operacao, operatorId, editing])

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.estado === 'GANHOU' || t.estado === 'PERDEU')
    const resultado = closed.reduce((sum, t) => sum + (t.valor_finaneiro ?? 0), 0)
    return {
      total: trades.length,
      ganhou: trades.filter((t) => t.estado === 'GANHOU').length,
      perdeu: trades.filter((t) => t.estado === 'PERDEU').length,
      pendente: trades.filter((t) => t.estado === 'PENDENTE').length,
      em_andamento: trades.filter((t) => t.estado === 'EM_ANDAMENTO').length,
      resultado: Math.round(resultado * 100) / 100,
    }
  }, [trades])

  const openNew = async () => {
    setEditing(null)
    setForm(emptyForm())
    setMethodOpen(false)
    setFormError('')
    setModalOpen(true)
    try {
      const template = await getMethodTemplate(operatorId)
      if (template) setForm((current) => ({ ...current, method: template }))
    } catch {
      return
    }
  }

  const openEdit = (trade: Trade) => {
    setEditing(trade)
    setForm(tradeToForm(trade))
    setMethodOpen(trade.method !== null)
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    const validation = validateForm(form)
    if (validation) {
      setFormError(validation)
      return
    }
    if (!editing && !dayPrecheck.precheck_concluido) {
      setFormError('Preencha primeiro as secções 01 a 03 do Checklist Operacional deste dia.')
      return
    }
    setSaving(true)
    setFormError('')
    const payload = toPayload(form)
    try {
      if (editing) {
        await updateTrade(editing.id, payload)
      } else {
        await createTrade(payload, operatorId)
      }
      setModalOpen(false)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFormError(typeof detail === 'string' ? detail : 'Erro ao guardar a operação.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!window.confirm('Eliminar esta operação? O registo fica em auditoria.')) return
    setSaving(true)
    try {
      await deleteTrade(editing.id)
      setModalOpen(false)
      void load()
    } catch {
      setFormError('Erro ao eliminar a operação.')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof TradeForm>(key: K, value: TradeForm[K]) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div>
      <PageHeader
        title="Diário de Operações"
        subtitle="Uma linha por operação. Pendente → Em andamento → Ganhou/Perdeu."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="month" style={inputStyle} value={month} onChange={(e) => setMonth(e.target.value || todayIso().slice(0, 7))} />
            {canManage && <OperatorPicker value={operatorId} onChange={setOperatorId} />}
            <PrimaryButton onClick={() => void openNew()}>Registar operação</PrimaryButton>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.6rem',
          marginBottom: '1rem',
        }}
      >
        {[
          { label: 'Operações', value: stats.total, color: 'var(--clop-white)' },
          { label: 'Ganhou', value: stats.ganhou, color: 'var(--success)' },
          { label: 'Perdeu', value: stats.perdeu, color: 'var(--danger)' },
          { label: 'Pendentes', value: stats.pendente, color: 'var(--warning)' },
          { label: 'Em andamento', value: stats.em_andamento, color: '#4f86f7' },
          { label: 'Resultado (US$)', value: stats.resultado.toFixed(2), color: stats.resultado >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: 'var(--clop-card-bg)',
              border: '1px solid var(--clop-card-border)',
              borderRadius: 'var(--clop-card-radius)',
              padding: '0.8rem 0.9rem',
            }}
          >
            <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>{card.label}</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: card.color, margin: '0.25rem 0 0' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && trades.length === 0 && <EmptyState message="Sem operações registadas neste mês." />}

      {!loading && !error && trades.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ativo</th>
                <th style={thStyle}>Direção</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Valor (US$)</th>
                <th style={thStyle}>R:R</th>
                <th style={thStyle}>Plano</th>
                <th style={thStyle}>Mindset</th>
                <th style={thStyle}>Observações</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td style={tdStyle}>{new Date(`${trade.data_operacao}T00:00:00`).toLocaleDateString('pt-PT')}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{trade.ativo}</td>
                  <td style={tdStyle}>{DIRECAO_LABELS[trade.direcao]}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 999,
                        color: ESTADO_COLORS[trade.estado],
                        background: `${ESTADO_COLORS[trade.estado]}1f`,
                        border: `1px solid ${ESTADO_COLORS[trade.estado]}55`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ESTADO_LABELS[trade.estado]}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: trade.valor_finaneiro === null ? 'var(--clop-gray)' : trade.valor_finaneiro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {trade.valor_finaneiro === null ? '—' : trade.valor_finaneiro.toFixed(2)}
                  </td>
                  <td style={tdStyle}>{trade.risco_retorno !== null ? `1:${trade.risco_retorno}` : '—'}</td>
                  <td style={{ ...tdStyle, color: trade.seguiu_plano ? 'var(--success)' : 'var(--danger)' }}>{trade.seguiu_plano ? 'Sim' : 'Não'}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{trade.mindset ? MINDSET_LABELS[trade.mindset as Mindset] ?? trade.mindset : '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={trade.observacoes ?? ''}>
                    {trade.observacoes ?? '—'}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => openEdit(trade)}
                      style={{ background: 'transparent', border: '1px solid var(--clop-card-border)', borderRadius: 6, color: 'var(--clop-gold-light)', padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} title={editing ? 'Editar operação' : 'Registar operação'} onClose={() => setModalOpen(false)} width={760}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <FormField label="Data da operação">
            <input type="date" style={inputStyle} value={form.data_operacao} onChange={(e) => set('data_operacao', e.target.value)} />
          </FormField>
          <FormField label="Ativo">
            <input style={inputStyle} value={form.ativo} maxLength={30} placeholder="EURUSD" onChange={(e) => set('ativo', e.target.value)} />
          </FormField>
          <FormField label="Direção">
            <select style={selectStyle} value={form.direcao} onChange={(e) => set('direcao', e.target.value as TradeDirection)}>
              <option value="COMPRA">{DIRECAO_LABELS.COMPRA}</option>
              <option value="VENDA">{DIRECAO_LABELS.VENDA}</option>
            </select>
          </FormField>
          <FormField label="Resultado (estado)">
            <select style={selectStyle} value={form.estado} onChange={(e) => set('estado', e.target.value as TradeEstado)}>
              <option value="PENDENTE">{ESTADO_LABELS.PENDENTE}</option>
              <option value="EM_ANDAMENTO">{ESTADO_LABELS.EM_ANDAMENTO}</option>
              <option value="GANHOU">{ESTADO_LABELS.GANHOU}</option>
              <option value="PERDEU">{ESTADO_LABELS.PERDEU}</option>
            </select>
          </FormField>
          <FormField label="Valor financeiro (US$)">
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={form.valor_finaneiro}
              disabled={form.estado === 'PENDENTE' || form.estado === 'EM_ANDAMENTO'}
              placeholder={form.estado === 'PERDEU' ? 'ex.: -50' : 'ex.: 120'}
              onChange={(e) => set('valor_finaneiro', e.target.value)}
            />
          </FormField>
          <FormField label="Risco:Retorno (N de 1:N)">
            <input type="number" step="0.1" min="0" style={inputStyle} value={form.risco_retorno} placeholder="ex.: 3 → 1:3" onChange={(e) => set('risco_retorno', e.target.value)} />
          </FormField>
          <FormField label="Seguiu o plano?">
            <select style={selectStyle} value={form.seguiu_plano ? 'S' : 'N'} onChange={(e) => set('seguiu_plano', e.target.value === 'S')}>
              <option value="S">Sim</option>
              <option value="N">Não</option>
            </select>
          </FormField>
          <FormField label="Como está se sentindo? (mindset)">
            <select style={selectStyle} value={form.mindset} onChange={(e) => set('mindset', e.target.value)}>
              <option value="">—</option>
              {Object.entries(MINDSET_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Observações (o que aconteceu na operação)">
              <textarea
                style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical' }}
                value={form.observacoes}
                maxLength={4000}
                onChange={(e) => set('observacoes', e.target.value)}
              />
            </FormField>
          </div>
        </div>

        {!editing && !dayPrecheck.precheck_concluido && (
          <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginTop: '0.8rem' }}>
            Aviso: o checklist pré-operacional (secções 01 a 03) deste dia ainda não está concluído. Conclua-o em “Checklist do Dia” antes de registar operações.
          </p>
        )}

        <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--clop-card-border)', paddingTop: '0.7rem' }}>
          <button
            type="button"
            onClick={() => setMethodOpen((current) => !current)}
            style={{ background: 'transparent', border: 'none', color: 'var(--clop-gold-light)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {methodOpen ? '▾' : '▸'} Secção 04 · Execução do Método
          </button>
          {methodOpen && (
            <div style={{ marginTop: '0.5rem' }}>
              {!editing && (
                <p style={{ fontSize: '0.75rem', color: 'var(--clop-gray)', margin: '0 0 0.5rem' }}>
                  Pode copiar o método do trade mais recente e ajustar. O preenchimento deste bloco é opcional por operação.
                </p>
              )}
              <MethodChecks method={form.method} onChange={(next) => set('method', next)} />
            </div>
          )}
        </div>

        {formError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{formError}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div>
            {editing && <DangerButton onClick={() => void handleDelete()} disabled={saving}>Eliminar</DangerButton>}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <GhostButton onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </GhostButton>
            <PrimaryButton onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
