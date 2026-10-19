import { useCallback, useEffect, useState } from 'react'
import {
  downloadEvolutionCsv,
  getAccount,
  getEvolution,
  saveAccount,
  saveMonth,
} from '../services/trading'
import { isAdminRole } from '../types/user'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/ui/Modal'
import OperatorPicker from '../components/ui/OperatorPicker'
import {
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../components/ui/common'
import { MONTHS_PT, type Account, type Evolution, type MonthSummary } from '../types/trading'

function currentYear(): number {
  return new Date().getFullYear()
}

function money(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MonthModal({
  open,
  ano,
  mes,
  summary,
  operatorId,
  onClose,
  onSaved,
}: {
  open: boolean
  ano: number
  mes: number
  summary: MonthSummary | null
  operatorId: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [depositos, setDepositos] = useState(() => String(summary?.depositos ?? 0))
  const [saques, setSaques] = useState(() => String(summary?.saques ?? 0))
  const [bonus, setBonus] = useState(() => String(summary?.bonus ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await saveMonth(ano, mes, {
        depositos: Number(depositos) || 0,
        saques: Number(saques) || 0,
        bonus: Number(bonus) || 0,
      }, operatorId)
      onSaved()
      onClose()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Erro ao guardar o mês.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={`${MONTHS_PT[mes - 1]}/${ano} · Movimentos`} onClose={onClose} width={480}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <FormField label="Depósitos (US$)">
          <input type="number" step="0.01" min="0" style={inputStyle} value={depositos} onChange={(e) => setDepositos(e.target.value)} />
        </FormField>
        <FormField label="Saques (US$)">
          <input type="number" step="0.01" min="0" style={inputStyle} value={saques} onChange={(e) => setSaques(e.target.value)} />
        </FormField>
        <FormField label="Bónus (US$)">
          <input type="number" step="0.01" min="0" style={inputStyle} value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </FormField>
      </div>
      <p style={{ color: 'var(--clop-gray)', fontSize: '0.78rem', marginTop: '0.7rem' }}>
        Resultado e saldo final são calculados automaticamente a partir das operações fechadas.
      </p>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
        <GhostButton onClick={onClose} disabled={saving}>
          Cancelar
        </GhostButton>
        <PrimaryButton onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'A guardar…' : 'Guardar'}
        </PrimaryButton>
      </div>
    </Modal>
  )
}

export default function TradingAccount() {
  const { user } = useAuth()
  const canManage = !!user && (isAdminRole(user.role) || user.role === 'MANAGER')

  const [operatorId, setOperatorId] = useState<number | null>(null)
  const [ano, setAno] = useState(currentYear())
  const [account, setAccount] = useState<Account | null>(null)
  const [evolution, setEvolution] = useState<Evolution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [accountModal, setAccountModal] = useState(false)
  const [accountForm, setAccountForm] = useState({ data_abertura: '', saldo_inicial: '' })
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountError, setAccountError] = useState('')

  const [monthModal, setMonthModal] = useState<{ ano: number; mes: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [acc, evo] = await Promise.all([getAccount(operatorId), getEvolution(ano, operatorId)])
      setAccount(acc)
      setEvolution(evo)
      if (acc) {
        setAccountForm({ data_abertura: acc.data_abertura, saldo_inicial: String(acc.saldo_inicial) })
      }
    } catch {
      setError('Não foi possível carregar a evolução da conta.')
    } finally {
      setLoading(false)
    }
  }, [ano, operatorId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const openAccountModal = () => {
    setAccountError('')
    if (!account) {
      const hoje = new Date()
      setAccountForm({
        data_abertura: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`,
        saldo_inicial: '',
      })
    }
    setAccountModal(true)
  }

  const handleSaveAccount = async () => {
    if (!accountForm.data_abertura || !accountForm.saldo_inicial.trim() || Number.isNaN(Number(accountForm.saldo_inicial))) {
      setAccountError('Preencha a data de abertura e o saldo inicial.')
      return
    }
    setSavingAccount(true)
    setAccountError('')
    try {
      await saveAccount({ data_abertura: accountForm.data_abertura, saldo_inicial: Number(accountForm.saldo_inicial) }, operatorId)
      setAccountModal(false)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAccountError(typeof detail === 'string' ? detail : 'Erro ao guardar a conta.')
    } finally {
      setSavingAccount(false)
    }
  }

  const months = evolution?.meses ?? []
  const total = evolution?.total
  const maxSaldo = Math.max(1, ...months.map((m) => Math.abs(m.saldo_final)))
  const monthSummary = monthModal ? months.find((m) => m.ano === monthModal.ano && m.mes === monthModal.mes) ?? null : null

  return (
    <div>
      <PageHeader
        title="Evolução da Conta"
        subtitle="Saldo inicial, depósitos, bónus, saques e resultado das operações por mês."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={inputStyle} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => currentYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {canManage && <OperatorPicker value={operatorId} onChange={setOperatorId} />}
            <GhostButton onClick={() => void downloadEvolutionCsv(ano, operatorId)}>Exportar CSV</GhostButton>
            <PrimaryButton onClick={openAccountModal}>{account ? 'Editar conta' : 'Declarar conta'}</PrimaryButton>
          </div>
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '0.8rem 0.9rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0 }}>Conta aberta em</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--clop-white)', margin: '0.25rem 0 0' }}>
                {account ? new Date(`${account.data_abertura}T00:00:00`).toLocaleDateString('pt-PT') : '—'}
              </p>
            </div>
            <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '0.8rem 0.9rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0 }}>Saldo inicial</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--clop-gold-light)', margin: '0.25rem 0 0' }}>US$ {money(account?.saldo_inicial ?? 0)}</p>
            </div>
            <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '0.8rem 0.9rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0 }}>Resultado do ano</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: (total?.resultado ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)', margin: '0.25rem 0 0' }}>
                US$ {money(total?.resultado ?? 0)}
              </p>
            </div>
            <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '0.8rem 0.9rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0 }}>Saldo actual</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--clop-white)', margin: '0.25rem 0 0' }}>US$ {money(total?.saldo_final ?? 0)}</p>
            </div>
          </div>

          <section
            style={{
              background: 'var(--clop-card-bg)',
              border: '1px solid var(--clop-card-border)',
              borderRadius: 'var(--clop-card-radius)',
              padding: '1.25rem',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '0.95rem', color: 'var(--clop-gold-light)', margin: '0 0 0.75rem' }}>Saldo acumulado (US$)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 170, padding: '0.5rem' }}>
              {months.map((m) => (
                <div key={`${m.ano}-${m.mes}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--clop-gray)', whiteSpace: 'nowrap' }}>{money(m.saldo_final)}</span>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(4, (Math.abs(m.saldo_final) / maxSaldo) * 110)}px`,
                      background: m.saldo_final >= 0 ? 'var(--clop-gold)' : 'var(--danger)',
                      borderRadius: '4px 4px 0 0',
                      opacity: m.saldo_final === 0 ? 0.25 : 1,
                    }}
                  />
                  <span style={{ fontSize: '0.62rem', color: 'var(--clop-gray)' }}>{MONTHS_PT[m.mes - 1].slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </section>

          <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Mês</th>
                  <th style={thStyle}>Gain (US$)</th>
                  <th style={thStyle}>Loss (US$)</th>
                  <th style={thStyle}>Resultado (US$)</th>
                  <th style={thStyle}>Saldo inicial</th>
                  <th style={thStyle}>Depósitos</th>
                  <th style={thStyle}>Bónus</th>
                  <th style={thStyle}>Saques</th>
                  <th style={thStyle}>Saldo final</th>
                  <th style={thStyle}>% acerto</th>
                  <th style={thStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  return (
                    <tr key={`${m.ano}-${m.mes}`}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{MONTHS_PT[m.mes - 1].slice(0, 3)}/{m.ano}</td>
                      <td style={{ ...tdStyle, color: 'var(--success)' }}>{money(m.gain)}</td>
                      <td style={{ ...tdStyle, color: 'var(--danger)' }}>{money(m.loss)}</td>
                      <td style={{ ...tdStyle, color: m.resultado >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{money(m.resultado)}</td>
                      <td style={tdStyle}>{money(m.saldo_inicial)}</td>
                      <td style={tdStyle}>{money(m.depositos)}</td>
                      <td style={tdStyle}>{money(m.bonus)}</td>
                      <td style={tdStyle}>{money(m.saques)}</td>
                      <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{money(m.saldo_final)}</td>
                      <td style={tdStyle}>{m.taxa_acerto}%</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setMonthModal({ ano: m.ano, mes: m.mes })}
                          style={{ background: 'transparent', border: '1px solid var(--clop-card-border)', borderRadius: 6, color: 'var(--clop-gold-light)', padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Movimentos
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {total && (
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--clop-gold-light)' }}>TOTAL {ano}</td>
                    <td style={{ ...tdStyle, color: 'var(--success)' }}>{money(total.gain)}</td>
                    <td style={{ ...tdStyle, color: 'var(--danger)' }}>{money(total.loss)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: total.resultado >= 0 ? 'var(--success)' : 'var(--danger)' }}>{money(total.resultado)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{money(total.saldo_inicial)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{money(total.depositos)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{money(total.bonus)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{money(total.saques)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--clop-gold-light)' }}>{money(total.saldo_final)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{total.taxa_acerto}%</td>
                    <td style={tdStyle} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ color: 'var(--clop-gray)', fontSize: '0.75rem', marginTop: '0.6rem' }}>
            O saldo de cada mês herda automaticamente o saldo final do mês anterior. Gain/Loss detalhados estão no Relatório Mensal e no CSV.
          </p>
        </>
      )}

      <Modal open={accountModal} title={account ? 'Editar conta do operador' : 'Declarar conta do operador'} onClose={() => setAccountModal(false)} width={480}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <FormField label="Data de abertura">
            <input type="date" style={inputStyle} value={accountForm.data_abertura} onChange={(e) => setAccountForm({ ...accountForm, data_abertura: e.target.value })} />
          </FormField>
          <FormField label="Saldo inicial (US$)">
            <input type="number" step="0.01" min="0" style={inputStyle} value={accountForm.saldo_inicial} onChange={(e) => setAccountForm({ ...accountForm, saldo_inicial: e.target.value })} />
          </FormField>
        </div>
        <p style={{ color: 'var(--clop-gray)', fontSize: '0.78rem', marginTop: '0.7rem' }}>
          Preenche-se uma vez. Os meses seguintes herdam automaticamente o saldo final do mês anterior.
        </p>
        {accountError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{accountError}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
          <GhostButton onClick={() => setAccountModal(false)} disabled={savingAccount}>
            Cancelar
          </GhostButton>
          <PrimaryButton onClick={() => void handleSaveAccount()} disabled={savingAccount}>
            {savingAccount ? 'A guardar…' : 'Guardar'}
          </PrimaryButton>
        </div>
      </Modal>

      {monthModal && (
        <MonthModal
          key={`${monthModal.ano}-${monthModal.mes}`}
          open
          ano={monthModal.ano}
          mes={monthModal.mes}
          summary={monthSummary}
          operatorId={operatorId}
          onClose={() => setMonthModal(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
