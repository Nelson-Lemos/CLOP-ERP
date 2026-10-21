import api from './api'
import type {
  Account,
  Checklist,
  ChecklistPayload,
  ChecklistStatus,
  Evolution,
  Evidence,
  MethodPayload,
  MonthlyReport,
  MonthSummary,
  ReviewQueue,
  ReviewQueueFilters,
  Trade,
  TradePayload,
  TradingSummary,
} from '../types/trading'

export interface ChecklistFilters {
  operatorId?: number | null
}

function operatorParams(operatorId?: number | null): Record<string, number> {
  return operatorId ? { operator_id: operatorId } : {}
}

export async function checklistStatus(day: string, operatorId?: number | null): Promise<ChecklistStatus> {
  const { data } = await api.get<ChecklistStatus>('/trading/checklists/status', {
    params: { data_pregao: day, ...operatorParams(operatorId) },
  })
  return data
}

export async function getChecklist(day: string, operatorId?: number | null): Promise<Checklist | null> {
  try {
    const { data } = await api.get<Checklist>(`/trading/checklists/${day}`, { params: operatorParams(operatorId) })
    return data
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw e
  }
}

export async function saveChecklist(day: string, payload: ChecklistPayload, operatorId?: number | null): Promise<Checklist> {
  const { data } = await api.put<Checklist>(`/trading/checklists/${day}`, payload, { params: operatorParams(operatorId) })
  return data
}

export async function closeChecklist(day: string, operatorId?: number | null): Promise<Checklist> {
  const { data } = await api.post<Checklist>(`/trading/checklists/${day}/close`, null, { params: operatorParams(operatorId) })
  return data
}

export async function reopenChecklist(day: string, operatorId?: number | null): Promise<Checklist> {
  const { data } = await api.post<Checklist>(`/trading/checklists/${day}/reopen`, null, { params: operatorParams(operatorId) })
  return data
}

export interface TradeFilters {
  operatorId?: number | null
  dataInicio?: string
  dataFim?: string
}

export async function listTrades(filters: TradeFilters = {}): Promise<Trade[]> {
  const params: Record<string, string | number> = {}
  const operator = operatorParams(filters.operatorId)
  Object.assign(params, operator)
  if (filters.dataInicio) params.data_inicio = filters.dataInicio
  if (filters.dataFim) params.data_fim = filters.dataFim
  const { data } = await api.get<Trade[]>('/trading/trades', { params })
  return data
}

export async function createTrade(payload: TradePayload, operatorId?: number | null): Promise<Trade> {
  const { data } = await api.post<Trade>('/trading/trades', payload, { params: operatorParams(operatorId) })
  return data
}

export async function updateTrade(id: number, payload: Partial<TradePayload>): Promise<Trade> {
  const { data } = await api.put<Trade>(`/trading/trades/${id}`, payload)
  return data
}

export async function deleteTrade(id: number): Promise<void> {
  await api.delete(`/trading/trades/${id}`)
}

export async function uploadEvidence(tradeId: number, tipo: string, file: Blob, filename: string): Promise<Evidence> {
  const form = new FormData()
  form.append('tipo', tipo)
  form.append('file', file, filename)
  const { data } = await api.post<Evidence>(`/trading/trades/${tradeId}/evidences`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listEvidences(tradeId: number): Promise<Evidence[]> {
  const { data } = await api.get<Evidence[]>(`/trading/trades/${tradeId}/evidences`)
  return data
}

const evidenceBlobCache = new Map<number, string>()

export async function evidenceImageUrl(evidenceId: number): Promise<string> {
  const cached = evidenceBlobCache.get(evidenceId)
  if (cached) return cached
  const { data } = await api.get<Blob>(`/trading/evidences/${evidenceId}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  evidenceBlobCache.set(evidenceId, url)
  return url
}

export function preloadEvidenceImages(evidenceIds: number[]): void {
  evidenceIds
    .filter((id) => !evidenceBlobCache.has(id))
    .forEach((id) => {
      void evidenceImageUrl(id).catch(() => undefined)
    })
}

export interface ReviewDecisionPayload {
  decision: 'APROVADA' | 'INCONSISTENTE' | 'CORRECAO_PEDIDA'
  comentario: string
  divergencia_plano?: boolean | null
}

export async function getReviewQueue(filters: ReviewQueueFilters = {}): Promise<ReviewQueue> {
  const params: Record<string, string | number | boolean> = {}
  if (filters.operatorId) params.operator_id = filters.operatorId
  if (filters.dataInicio) params.data_inicio = filters.dataInicio
  if (filters.dataFim) params.data_fim = filters.dataFim
  if (filters.ativo) params.ativo = filters.ativo
  if (filters.revisaoEstado) params.revisao_estado = filters.revisaoEstado
  if (filters.resultado) params.resultado = filters.resultado
  if (filters.seguiuPlano !== null && filters.seguiuPlano !== undefined) params.seguiu_plano = filters.seguiuPlano
  if (filters.divergencia !== null && filters.divergencia !== undefined) params.divergencia = filters.divergencia
  if (filters.semEvidencia !== null && filters.semEvidencia !== undefined) params.sem_evidencia = filters.semEvidencia
  if (filters.limit) params.limit = filters.limit
  if (filters.offset) params.offset = filters.offset
  const { data } = await api.get<ReviewQueue>('/trading/review-queue', { params })
  return data
}

export async function reviewTrade(tradeId: number, payload: ReviewDecisionPayload): Promise<Trade> {
  const { data } = await api.post<Trade>(`/trading/trades/${tradeId}/review`, payload)
  return data
}

export async function respondReview(tradeId: number, comentario: string): Promise<Trade> {
  const { data } = await api.post<Trade>(`/trading/trades/${tradeId}/review/respond`, { comentario })
  return data
}

export async function getAccount(operatorId?: number | null): Promise<Account | null> {
  const { data } = await api.get<Account | null>('/trading/account', { params: operatorParams(operatorId) })
  return data
}

export async function saveAccount(payload: { data_abertura: string; saldo_inicial: number }, operatorId?: number | null): Promise<Account> {
  const { data } = await api.put<Account>('/trading/account', payload, { params: operatorParams(operatorId) })
  return data
}

export async function getEvolution(ano: number, operatorId?: number | null): Promise<Evolution> {
  const { data } = await api.get<Evolution>('/trading/evolution', { params: { ano, ...operatorParams(operatorId) } })
  return data
}

export async function saveMonth(
  ano: number,
  mes: number,
  payload: { depositos: number; saques: number; bonus: number },
  operatorId?: number | null,
): Promise<MonthSummary> {
  const { data } = await api.put<MonthSummary>(`/trading/months/${ano}/${mes}`, payload, { params: operatorParams(operatorId) })
  return data
}

export async function getMonthlyReport(
  ano: number,
  mes: number,
  operatorId?: number | null,
  options: { apenasValidadas?: boolean; incluirEvidencias?: boolean } = {},
): Promise<MonthlyReport> {
  const params: Record<string, string | number | boolean> = { ano, mes }
  Object.assign(params, operatorParams(operatorId))
  if (options.apenasValidadas) params.apenas_validadas = true
  if (options.incluirEvidencias) params.incluir_evidencias = true
  const { data } = await api.get<MonthlyReport>('/trading/monthly-report', { params })
  return data
}

export async function getTradingSummary(ano: number, mes: number, operatorId?: number | null): Promise<TradingSummary> {
  const { data } = await api.get<TradingSummary>('/trading/summary', { params: { ano, mes, ...operatorParams(operatorId) } })
  return data
}

export async function getMethodTemplate(operatorId?: number | null): Promise<MethodPayload | null> {
  const trades = await listTrades({ operatorId })
  const latest = trades[0]
  if (!latest?.method) return null
  const { id: _id, trade_id: _tradeId, ...method } = latest.method
  return method
}

export function downloadBlob(content: Blob, filename: string): void {
  const url = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadEvolutionCsv(ano: number, operatorId?: number | null): Promise<void> {
  const { data } = await api.get<Blob>('/trading/evolution/csv', {
    params: { ano, ...operatorParams(operatorId) },
    responseType: 'blob',
  })
  downloadBlob(data, `evolucao_conta_${ano}.csv`)
}

export async function downloadReportCsv(
  ano: number,
  mes: number,
  operatorId?: number | null,
  apenasValidadas = false,
): Promise<void> {
  const params: Record<string, string | number | boolean> = { ano, mes }
  Object.assign(params, operatorParams(operatorId))
  if (apenasValidadas) params.apenas_validadas = true
  const { data } = await api.get<Blob>('/trading/monthly-report/csv', {
    params,
    responseType: 'blob',
  })
  downloadBlob(data, `operacoes_${ano}_${String(mes).padStart(2, '0')}.csv`)
}

export async function downloadReportPdf(
  ano: number,
  mes: number,
  operatorId?: number | null,
  apenasValidadas = false,
): Promise<void> {
  const params: Record<string, string | number | boolean> = { ano, mes }
  Object.assign(params, operatorParams(operatorId))
  if (apenasValidadas) params.apenas_validadas = true
  const { data } = await api.get<Blob>('/trading/monthly-report/pdf', {
    params,
    responseType: 'blob',
  })
  downloadBlob(data, `relatorio_trading_${ano}_${String(mes).padStart(2, '0')}.pdf`)
}
