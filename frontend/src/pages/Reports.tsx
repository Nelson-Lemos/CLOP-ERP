import { useEffect, useState } from 'react'
import type { Department } from '../types/department'
import type { ReportData } from '../types/report'
import { getCompanyReport, getDepartmentReport, getPeriodReport, reportPdfUrl } from '../services/reports'
import { listDepartments } from '../services/departments'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import {
  ErrorState,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputStyle,
  selectStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../components/ui/common'

export default function Reports() {
  const { user: authUser } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<'company' | 'department' | 'period'>('company')
  const [departmentId, setDepartmentId] = useState('')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  useEffect(() => {
    if (authUser?.role !== 'EMPLOYEE') {
      listDepartments()
        .then(setDepartments)
        .catch(() => undefined)
    }
  }, [authUser])

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const filters = { start: start || undefined, end: end || undefined }
      let data: ReportData
      if (scope === 'period') {
        data = await getPeriodReport(period)
      } else if (scope === 'department' && departmentId) {
        data = await getDepartmentReport(Number(departmentId), filters)
      } else {
        data = await getCompanyReport(filters)
      }
      setReport(data)
    } catch {
      setError('Não foi possível gerar o relatório.')
    } finally {
      setLoading(false)
    }
  }

  const pdfPath = scope === 'department' && departmentId ? `/reports/department/${departmentId}/pdf` : scope === 'company' ? '/reports/company/pdf' : null

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Gerar relatórios e exportar em PDF"
        actions={
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <GhostButton
              onClick={() => {
                if (pdfPath) window.open(reportPdfUrl(pdfPath, { start: start || undefined, end: end || undefined }), '_blank')
              }}
              disabled={!pdfPath || loading}
            >
              Baixar PDF
            </GhostButton>
            <PrimaryButton onClick={() => void run()} disabled={loading}>
              {loading ? 'A gerar…' : 'Gerar relatório'}
            </PrimaryButton>
          </div>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.25rem', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1rem' }}>
        {authUser?.role === 'CEO' && (
          <>
            <select style={selectStyle} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="period">Período</option>
              <option value="company">Empresa</option>
              <option value="department">Departamento</option>
            </select>
            {scope === 'period' && (
              <select style={selectStyle} value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            )}
            {scope === 'department' && (
              <select style={selectStyle} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Selecionar departamento</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        {authUser?.role === 'MANAGER' && (
          <select style={selectStyle} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="department">Departamento</option>
            <option value="period">Período</option>
          </select>
        )}
        {scope === 'period' && (
          <>
            <label style={{ fontSize: '0.78rem', color: 'var(--clop-gray)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Início
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, padding: '0.35rem' }} />
            </label>
            <label style={{ fontSize: '0.78rem', color: 'var(--clop-gray)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Fim
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, padding: '0.35rem' }} />
            </label>
          </>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={run} />
      ) : !report ? (
        <p style={{ color: 'var(--clop-gray)', fontSize: '0.9rem' }}>Selecione os filtros e clique em «Gerar relatório».</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '1rem', marginTop: 0 }}>{report.label}</h3>
            <p style={{ color: 'var(--clop-gray)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
              Período {report.periodo} · gerado a {report.generated_at}
            </p>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Concluídas</th>
                  <th style={thStyle}>Pendentes</th>
                  <th style={thStyle}>Atrasadas</th>
                  <th style={thStyle}>Rejeitadas</th>
                  <th style={thStyle}>Taxa de conclusão</th>
                  <th style={thStyle}>No prazo</th>
                  <th style={thStyle}>Pontuação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>{report.metrics.total_tasks}</td>
                  <td style={{ ...tdStyle, color: 'var(--success)' }}>{report.metrics.completed_tasks}</td>
                  <td style={tdStyle}>{report.metrics.pending_tasks}</td>
                  <td style={{ ...tdStyle, color: 'var(--danger)' }}>{report.metrics.overdue_tasks}</td>
                  <td style={tdStyle}>{report.metrics.rejected_tasks}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{report.metrics.completion_rate}%</td>
                  <td style={tdStyle}>{report.metrics.on_time_rate}%</td>
                  <td style={tdStyle}>{report.metrics.weighted_score}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {report.department_breakdown && (
            <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
              <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Produtividade por departamento</h3>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Departamento</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Concluídas</th>
                    <th style={thStyle}>Atrasadas</th>
                    <th style={thStyle}>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {report.department_breakdown.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{d.nome}</td>
                      <td style={tdStyle}>{d.total_tasks}</td>
                      <td style={tdStyle}>{d.completed_tasks}</td>
                      <td style={tdStyle}>{d.overdue_tasks}</td>
                      <td style={{ ...tdStyle, color: 'var(--clop-gold-light)', fontWeight: 600 }}>{d.completion_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Estado das tarefas</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {Object.entries(report.status_distribution).map(([s, c]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <StatusBadge value={s} />
                  <span style={{ color: 'var(--clop-gray)', fontSize: '0.85rem' }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}