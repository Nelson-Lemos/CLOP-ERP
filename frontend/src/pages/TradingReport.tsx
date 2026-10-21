import { useCallback, useEffect, useState } from 'react'
import { downloadReportCsv, downloadReportPdf, evidenceImageUrl, getMonthlyReport } from '../services/trading'
import { isAdminRole } from '../types/user'
import { useAuth } from '../hooks/useAuth'
import OperatorPicker from '../components/ui/OperatorPicker'
import {
  EmptyState,
  ErrorState,
  GhostButton,
  LoadingState,
  PageHeader,
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
  EVIDENCIA_TIPO_LABELS,
  MINDSET_LABELS,
  MONTHS_PT,
  REVISAO_ESTADO_COLORS,
  REVISAO_ESTADO_LABELS,
  type CapturaItem,
  type Mindset,
  type MonthlyReport,
  type TradeEstado,
} from '../types/trading'

function currentYear(): number {
  return new Date().getFullYear()
}

function money(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ITENS_LABELS: Record<string, string> = {
  sem_bom_sono: 'Dias sem boa noite de sono',
  sem_estado_fisico: 'Dias sem estar fisicamente bem',
  sem_estabilidade_emocional: 'Dias sem estabilidade emocional',
  sem_disposicao_plano: 'Dias sem disposição para o plano',
  sem_gestao_risco: 'Dias sem gestão de risco definida',
  sem_pre_trading: 'Dias sem pré-trading',
  sem_noticias: 'Dias sem verificar notícias',
  sem_360: 'Dias sem fazer o 360°',
  sem_planilha: 'Dias sem preencher a planilha',
  sem_gerenciamento: 'Dias sem respeitar o gerenciamento',
  sem_seguimento_plano: 'Dias sem seguir o plano operacional',
}

function CapturaThumb({ imagem }: { imagem: CapturaItem['imagens'][number] }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    evidenceImageUrl(imagem.id)
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [imagem.id])
  return (
    <figure
      title={`${EVIDENCIA_TIPO_LABELS[imagem.tipo]} · ${imagem.filename}`}
      style={{ margin: 0, width: 96, border: '1px solid rgba(212,167,44,0.25)', borderRadius: 6, overflow: 'hidden', background: '#050505', flex: '0 0 auto' }}
    >
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          <img src={src} alt={imagem.filename} style={{ width: 96, height: 64, objectFit: 'cover', display: 'block' }} />
        </a>
      ) : (
        <div style={{ width: 96, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', color: 'var(--clop-gray)' }}>
          …
        </div>
      )}
    </figure>
  )
}

function CapturaCard({ captura }: { captura: CapturaItem }) {
  return (
    <div style={{ border: '1px solid rgba(212,167,44,0.12)', borderRadius: 10, padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--clop-gray)' }}>
        <span>{new Date(`${captura.data_operacao}T00:00:00`).toLocaleDateString('pt-PT')}</span>
        <strong style={{ color: 'var(--clop-white)' }}>{captura.ativo}</strong>
        <span>{DIRECAO_LABELS[captura.direcao]}</span>
        <span style={{ color: ESTADO_COLORS[captura.estado] }}>{ESTADO_LABELS[captura.estado]}</span>
        {captura.valor_finaneiro !== null && (
          <span style={{ color: captura.valor_finaneiro >= 0 ? 'var(--success)' : 'var(--danger)' }}>US$ {money(captura.valor_finaneiro)}</span>
        )}
        <span style={{ color: captura.seguiu_plano ? 'var(--success)' : 'var(--danger)' }}>{captura.seguiu_plano ? 'Seguiu o plano' : 'Não seguiu o plano'}</span>
        <span style={{ color: REVISAO_ESTADO_COLORS[captura.revisao_estado] }}>{REVISAO_ESTADO_LABELS[captura.revisao_estado]}</span>
        {captura.divergencia_plano && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Divergência ao plano</span>}
      </div>
      {captura.sem_evidencia ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--danger)' }}>Sem evidência carregada para esta operação.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {captura.imagens.map((imagem) => (
            <CapturaThumb key={imagem.id} imagem={imagem} />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupTable({ title, rows, label }: { title: string; rows: MonthlyReport['ativos']; label?: (key: string) => string }) {
  if (rows.length === 0) return null
  return (
    <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
      <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>{title}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>{label ? 'Categoria' : 'Chave'}</th>
              <th style={thStyle}>Operações</th>
              <th style={thStyle}>Resultado (US$)</th>
              <th style={thStyle}>Taxa de acerto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.chave}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{label ? label(row.chave) : row.chave}</td>
                <td style={tdStyle}>{row.total}</td>
                <td style={{ ...tdStyle, color: row.resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(row.resultado)}</td>
                <td style={tdStyle}>{row.taxa_acerto !== undefined ? `${row.taxa_acerto}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function TradingReport() {
  const { user } = useAuth()
  const canManage = !!user && (isAdminRole(user.role) || user.role === 'MANAGER')

  const now = new Date()
  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [estadoFilter, setEstadoFilter] = useState<TradeEstado | 'TODOS'>('PERDEU')
  const [planoFilter, setPlanoFilter] = useState<'TODOS' | 'SIM' | 'NAO'>('TODOS')
  const [mindsetFilter, setMindsetFilter] = useState<Mindset | 'TODOS'>('TODOS')
  const [apenasValidadas, setApenasValidadas] = useState(false)
  const [incluirEvidencias, setIncluirEvidencias] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setReport(await getMonthlyReport(ano, mes, operatorId, { apenasValidadas, incluirEvidencias }))
    } catch {
      setError('Não foi possível carregar o relatório mensal.')
    } finally {
      setLoading(false)
    }
  }, [ano, mes, operatorId, apenasValidadas, incluirEvidencias])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const observacoes = (report?.observacoes ?? []).filter((row) => {
    if (estadoFilter !== 'TODOS' && row.estado !== estadoFilter) return false
    if (planoFilter === 'SIM' && !row.seguiu_plano) return false
    if (planoFilter === 'NAO' && row.seguiu_plano) return false
    if (mindsetFilter !== 'TODOS' && row.mindset !== mindsetFilter) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="Relatório Mensal de Trading"
        subtitle="Resumo, análise de falhas, mindset, execução e observações do mês."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={inputStyle} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => currentYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select style={inputStyle} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MONTHS_PT.map((nome, index) => (
                <option key={nome} value={index + 1}>
                  {nome}
                </option>
              ))}
            </select>
            {canManage && <OperatorPicker value={operatorId} onChange={setOperatorId} />}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--clop-gray)', cursor: 'pointer' }}>
              <input type="checkbox" checked={apenasValidadas} onChange={(e) => setApenasValidadas(e.target.checked)} />
              Só validadas
            </label>
            <GhostButton onClick={() => void downloadReportCsv(ano, mes, operatorId, apenasValidadas)}>CSV</GhostButton>
            <GhostButton onClick={() => void downloadReportPdf(ano, mes, operatorId, apenasValidadas)}>PDF</GhostButton>
          </div>
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Operações', value: String(report.resumo.total_operacoes), color: 'var(--clop-white)' },
              { label: 'Ganhou', value: String(report.resumo.ganhou), color: 'var(--success)' },
              { label: 'Perdeu', value: String(report.resumo.perdeu), color: 'var(--danger)' },
              { label: 'Pendentes', value: String(report.resumo.pendente), color: 'var(--warning)' },
              { label: 'Em andamento', value: String(report.resumo.em_andamento), color: '#4f86f7' },
              { label: 'Taxa de acerto', value: `${report.resumo.taxa_acerto}%`, color: 'var(--clop-gold-light)' },
              { label: 'Resultado (US$)', value: money(report.resumo.resultado), color: report.resumo.resultado >= 0 ? 'var(--success)' : 'var(--danger)' },
              { label: 'Saldo final (US$)', value: money(report.resumo.saldo_final), color: 'var(--clop-white)' },
              { label: 'Risco:Retorno médio', value: `1:${report.resumo.risco_retorno_medio}`, color: 'var(--clop-gold-light)' },
            ].map((card) => (
              <div key={card.label} style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '0.8rem 0.9rem' }}>
                <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>{card.label}</p>
                <p style={{ fontSize: '1.15rem', fontWeight: 700, color: card.color, margin: '0.25rem 0 0' }}>{card.value}</p>
              </div>
            ))}
          </div>

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>Evidências e revisão do líder</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
              {[
                { label: 'Operações fechadas', value: String(report.evidencia.total_fechadas), color: 'var(--clop-white)' },
                { label: 'Com evidência', value: `${report.evidencia.pct_com_evidencia}%`, color: report.evidencia.sem_evidencia === 0 ? 'var(--success)' : 'var(--warning)' },
                { label: 'Sem evidência', value: String(report.evidencia.sem_evidencia), color: report.evidencia.sem_evidencia === 0 ? 'var(--success)' : 'var(--danger)' },
                { label: 'Aprovadas', value: `${report.evidencia.aprovadas} (${report.evidencia.pct_aprovadas}%)`, color: 'var(--success)' },
                { label: 'Não revistas', value: String(report.evidencia.nao_revisadas), color: 'var(--clop-gray)' },
                { label: 'Correcções pedidas', value: String(report.evidencia.correcoes_pedidas), color: 'var(--warning)' },
                { label: 'Inconsistentes', value: String(report.evidencia.inconsistentes), color: 'var(--danger)' },
                { label: 'Divergências ao plano', value: String(report.evidencia.divergencias_plano), color: 'var(--danger)' },
              ].map((card) => (
                <div key={card.label} style={{ background: 'rgba(13,13,13,0.6)', border: '1px solid rgba(212,167,44,0.1)', borderRadius: 10, padding: '0.65rem 0.8rem' }}>
                  <p style={{ fontSize: '0.66rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>{card.label}</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: card.color, margin: '0.2rem 0 0' }}>{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: 0 }}>Capturas das operações</h2>
              <GhostButton onClick={() => setIncluirEvidencias((value) => !value)}>
                {incluirEvidencias ? 'Ocultar capturas' : 'Mostrar capturas'}
              </GhostButton>
            </div>
            {!incluirEvidencias ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--clop-gray)' }}>
                As imagens de evidência não estão carregadas. Clique em “Mostrar capturas” para visualizar.
              </p>
            ) : report.capturas.length === 0 ? (
              <EmptyState message="Sem capturas para o mês seleccionado." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {report.capturas.map((captura) => (
                  <CapturaCard key={captura.trade_id} captura={captura} />
                ))}
              </div>
            )}
          </section>

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>Seguiu o plano?</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Seguiu o plano</th>
                    <th style={thStyle}>Operações fechadas</th>
                    <th style={thStyle}>Resultado (US$)</th>
                    <th style={thStyle}>Não seguiu</th>
                    <th style={thStyle}>Resultado (US$)</th>
                    <th style={thStyle}>Taxa de seguimento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...tdStyle, color: 'var(--success)', fontWeight: 600 }}>Sim</td>
                    <td style={tdStyle}>{report.plano.seguhou_total}</td>
                    <td style={{ ...tdStyle, color: report.plano.seguhou_resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(report.plano.seguhou_resultado)}</td>
                    <td style={{ ...tdStyle, color: 'var(--danger)', fontWeight: 600 }}>Não</td>
                    <td style={{ ...tdStyle, color: report.plano.nao_seguhou_resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(report.plano.nao_seguhou_resultado)}</td>
                    <td style={tdStyle}>{report.plano.taxa_seguimento}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <GroupTable title="Perdas por estado emocional (mindset)" rows={report.mindset} label={(key) => MINDSET_LABELS[key as Mindset] ?? key} />
          <GroupTable title="Resultado por ativo" rows={report.ativos} />
          <GroupTable title="Resultado por direção" rows={report.direcoes} label={(key) => DIRECAO_LABELS[key as 'COMPRA' | 'VENDA'] ?? key} />
          <GroupTable title="Resultado por dia da semana" rows={report.dias_semana} />

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>Execução e checklist</h2>
            <p style={{ color: 'var(--clop-white)', fontSize: '0.88rem', margin: '0 0 0.6rem' }}>
              Nota média de execução: <strong style={{ color: 'var(--clop-gold-light)' }}>{report.execucao.nota_media}</strong> / 5 · Dias com checklist no
              mês: <strong>{report.execucao.dias_com_checklist}</strong>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.35rem' }}>
              {Object.entries(report.execucao.itens_nao_cumpridos).map(([key, count]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.82rem', borderBottom: '1px solid rgba(212,167,44,0.08)', padding: '0.3rem 0' }}>
                  <span style={{ color: 'var(--clop-gray)' }}>{ITENS_LABELS[key] ?? key}</span>
                  <span style={{ color: count > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{count} dia(s)</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: 0 }}>Observações das operações</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as TradeEstado | 'TODOS')}>
                  <option value="TODOS">Todos os estados</option>
                  <option value="GANHOU">Ganhou</option>
                  <option value="PERDEU">Perdeu</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                </select>
                <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={planoFilter} onChange={(e) => setPlanoFilter(e.target.value as 'TODOS' | 'SIM' | 'NAO')}>
                  <option value="TODOS">Plano: todos</option>
                  <option value="SIM">Seguiu o plano</option>
                  <option value="NAO">Não seguiu o plano</option>
                </select>
                <select style={{ ...selectStyle, fontSize: '0.8rem' }} value={mindsetFilter} onChange={(e) => setMindsetFilter(e.target.value as Mindset | 'TODOS')}>
                  <option value="TODOS">Mindset: todos</option>
                  {Object.entries(MINDSET_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {observacoes.length === 0 ? (
              <EmptyState message="Sem observações para os filtros seleccionados." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {observacoes.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      border: '1px solid rgba(212,167,44,0.12)',
                      borderRadius: 10,
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'var(--clop-gray)' }}>
                      <span>{new Date(`${row.data_operacao}T00:00:00`).toLocaleDateString('pt-PT')}</span>
                      <strong style={{ color: 'var(--clop-white)' }}>{row.ativo}</strong>
                      <span>{DIRECAO_LABELS[row.direcao]}</span>
                      <span style={{ color: ESTADO_COLORS[row.estado] }}>{ESTADO_LABELS[row.estado]}</span>
                      {row.valor_finaneiro !== null && (
                        <span style={{ color: row.valor_finaneiro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          US$ {money(row.valor_finaneiro)}
                        </span>
                      )}
                      <span style={{ color: row.seguiu_plano ? 'var(--success)' : 'var(--danger)' }}>{row.seguiu_plano ? 'Seguiu o plano' : 'Não seguiu o plano'}</span>
                      {row.mindset && <span>{MINDSET_LABELS[row.mindset as Mindset] ?? row.mindset}</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--clop-white)' }}>{row.observacoes}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
