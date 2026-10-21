export type TradeDirection = 'COMPRA' | 'VENDA'
export type TradeEstado = 'PENDENTE' | 'EM_ANDAMENTO' | 'GANHOU' | 'PERDEU'
export type MacroDirection = 'ALTA' | 'BAIXA'
export type MacroBias = 'A_FAVOR' | 'CONTRA'
export type PriceRegion = 'CARA' | 'BARATA'

export type EvidenceTipo = 'ENTRADA' | 'GESTAO' | 'FECHO'
export type RevisaoEstado = 'NAO_REVISADA' | 'APROVADA' | 'INCONSISTENTE' | 'CORRECAO_PEDIDA'
export type RevisaoDecision = 'APROVADA' | 'INCONSISTENTE' | 'CORRECAO_PEDIDA'

export const EVIDENCIA_TIPO_LABELS: Record<EvidenceTipo, string> = {
  ENTRADA: 'Entrada',
  GESTAO: 'Gestão',
  FECHO: 'Fecho',
}

export const REVISAO_ESTADO_LABELS: Record<RevisaoEstado, string> = {
  NAO_REVISADA: 'Não revista',
  APROVADA: 'Aprovada',
  INCONSISTENTE: 'Com inconsistência',
  CORRECAO_PEDIDA: 'Correcção pedida',
}

export const REVISAO_ESTADO_COLORS: Record<RevisaoEstado, string> = {
  NAO_REVISADA: 'var(--clop-gray)',
  APROVADA: 'var(--success)',
  INCONSISTENTE: 'var(--danger)',
  CORRECAO_PEDIDA: 'var(--warning)',
}

export type Mindset =
  | 'CALMO'
  | 'CONFIANTE'
  | 'ANSIOSO'
  | 'COM_MEDO'
  | 'GANANCIOSO'
  | 'FRUSTRADO'
  | 'EUFORICO'
  | 'CANSADO'
  | 'OUTRO'

export const MINDSET_LABELS: Record<Mindset, string> = {
  CALMO: 'Calmo',
  CONFIANTE: 'Confiante',
  ANSIOSO: 'Ansioso',
  COM_MEDO: 'Com medo',
  GANANCIOSO: 'Ganancioso',
  FRUSTRADO: 'Frustrado',
  EUFORICO: 'Eufórico',
  CANSADO: 'Cansado',
  OUTRO: 'Outro',
}

export const ESTADO_LABELS: Record<TradeEstado, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  GANHOU: 'Ganhou',
  PERDEU: 'Perdeu',
}

export const ESTADO_COLORS: Record<TradeEstado, string> = {
  PENDENTE: 'var(--warning)',
  EM_ANDAMENTO: '#4f86f7',
  GANHOU: 'var(--success)',
  PERDEU: 'var(--danger)',
}

export const DIRECAO_LABELS: Record<TradeDirection, string> = {
  COMPRA: 'Compra',
  VENDA: 'Venda',
}

export const MACRO_DIRECAO_LABELS: Record<MacroDirection, string> = { ALTA: 'Alta', BAIXA: 'Baixa' }
export const MACRO_VIES_LABELS: Record<MacroBias, string> = {
  A_FAVOR: 'Operar a favor da macroestrutura',
  CONTRA: 'Operar contra a macro em último caso',
}
export const REGIAO_LABELS: Record<PriceRegion, string> = { CARA: 'Cara', BARATA: 'Barata' }

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export interface Checklist {
  id: number
  operator_id: number
  operator_nome: string | null
  data_pregao: string
  s01_sono: boolean
  s01_fisico: boolean
  s01_emocional: boolean
  s01_plano: boolean
  s01_gestao_risco: boolean
  s02_pre_trading: boolean
  s02_atividade: string | null
  s03_noticias: boolean
  s03_360: boolean
  s03_ativos: string | null
  s05_planilha: boolean
  s05_gerenciamento: boolean
  s05_seguimento: boolean
  s05_nota: number | null
  s05_aprendizado: string | null
  precheck_concluido: boolean
  fechado: boolean
  fechado_em: string | null
  created_at: string
  updated_at: string
}

export type ChecklistPayload = Omit<Checklist, 'id' | 'operator_id' | 'operator_nome' | 'data_pregao' | 'precheck_concluido' | 'fechado' | 'fechado_em' | 'created_at' | 'updated_at'>

export interface ChecklistStatus {
  data_pregao: string
  existe: boolean
  precheck_concluido: boolean
  fechado: boolean
}

export interface MethodPayload {
  passo1_captura_liquidez: boolean
  macro_direcao: MacroDirection | null
  macro_vies: MacroBias | null
  mediana_corretivo: boolean
  mediana_regiao: PriceRegion | null
  mediana_captura_asia: boolean
  micro_capturou_liquidez: boolean
  micro_reagiu_poi: boolean
  micro_ineficiencia: boolean
  micro_quebrou_estrutura: boolean
  proj_fibonacci: boolean
  proj_ote: boolean
  proj_order_blocks: boolean
  proj_fvg: boolean
  entrada_aguardou_interna: boolean
  entrada_captura_interna: boolean
  entrada_reagiu_ob: boolean
  entrada_executada: boolean
  ger_stop_110: boolean
  alvo_fib_extensao: boolean
  alvo_liquidez_externa: boolean
  alvo_pdl_pdh: boolean
  alvo_asia: boolean
  alvo_ponto_parada: boolean
  observacoes: string | null
}

export interface Method extends MethodPayload {
  id: number
  trade_id: number
}

export interface Evidence {
  id: number
  trade_id: number
  user_id: number
  uploader_nome: string | null
  tipo: EvidenceTipo
  filename: string
  content_type: string | null
  size: number
  sha256: string
  alerta_hash_duplicado: boolean
  alerta_upload_tardio: boolean
  uploaded_at: string
  url: string | null
}

export interface Review {
  id: number
  trade_id: number
  user_id: number
  user_nome: string | null
  action: string
  comentario: string | null
  created_at: string
}

export interface Trade {
  id: number
  operator_id: number
  operator_nome: string | null
  data_operacao: string
  ativo: string
  direcao: TradeDirection
  estado: TradeEstado
  preco_entrada: number | null
  preco_stop: number | null
  preco_alvo: number | null
  preco_saida: number | null
  hora_entrada: string | null
  hora_saida: string | null
  tamanho_lote: number | null
  valor_finaneiro: number | null
  risco_retorno: number | null
  seguiu_plano: boolean
  mindset: string | null
  observacoes: string | null
  revisao_estado: RevisaoEstado
  revisao_por: number | null
  revisao_por_nome: string | null
  revisao_em: string | null
  revisao_comentario: string | null
  divergencia_plano: boolean
  tem_evidencia_entrada: boolean
  tem_evidencia_fecho: boolean
  created_by: number
  created_at: string
  updated_at: string
  method: Method | null
  evidencias: Evidence[]
  revisoes: Review[]
}

export interface TradePayload {
  data_operacao: string
  ativo: string
  direcao: TradeDirection
  estado: TradeEstado
  preco_entrada?: number | null
  preco_stop?: number | null
  preco_alvo?: number | null
  preco_saida?: number | null
  hora_entrada?: string | null
  hora_saida?: string | null
  tamanho_lote?: number | null
  valor_finaneiro: number | null
  risco_retorno: number | null
  seguiu_plano: boolean
  mindset: string | null
  observacoes: string | null
  method: MethodPayload | null
}

export interface ReviewQueue {
  total: number
  limit: number
  offset: number
  items: Trade[]
}

export interface ReviewQueueFilters {
  operatorId?: number | null
  dataInicio?: string
  dataFim?: string
  ativo?: string
  revisaoEstado?: RevisaoEstado | ''
  resultado?: TradeEstado | ''
  seguiuPlano?: boolean | null
  divergencia?: boolean | null
  semEvidencia?: boolean | null
  limit?: number
  offset?: number
}

export interface Account {
  id: number
  operator_id: number
  operator_nome: string | null
  data_abertura: string
  saldo_inicial: number
  created_at: string
  updated_at: string
}

export interface MonthSummary {
  ano: number
  mes: number
  gain: number
  loss: number
  depositos: number
  saques: number
  bonus: number
  saldo_inicial: number
  resultado: number
  saldo_final: number
  ganhou: number
  perdeu: number
  taxa_acerto: number
}

export interface Evolution {
  operator_id: number
  operator_nome: string | null
  ano: number
  meses: MonthSummary[]
  total: MonthSummary
}

export interface GroupRow {
  chave: string
  total: number
  resultado: number
  ganhou?: number
  perdeu?: number
  taxa_acerto?: number
}

export interface ObservationRow {
  id: number
  data_operacao: string
  ativo: string
  direcao: TradeDirection
  estado: TradeEstado
  valor_finaneiro: number | null
  seguiu_plano: boolean
  mindset: string | null
  observacoes: string | null
}

export interface CapturaImagem {
  id: number
  tipo: EvidenceTipo
  filename: string
  url: string
}

export interface CapturaItem {
  trade_id: number
  data_operacao: string
  ativo: string
  direcao: TradeDirection
  estado: TradeEstado
  seguiu_plano: boolean
  divergencia_plano: boolean
  revisao_estado: RevisaoEstado
  valor_finaneiro: number | null
  sem_evidencia: boolean
  imagens: CapturaImagem[]
}

export interface EvidenceReport {
  total_fechadas: number
  com_evidencia: number
  sem_evidencia: number
  pct_com_evidencia: number
  aprovadas: number
  pct_aprovadas: number
  inconsistentes: number
  correcoes_pedidas: number
  nao_revisadas: number
  divergencias_plano: number
}

export interface MonthlyReport {
  operator_id: number
  operator_nome: string
  ano: number
  mes: number
  resumo: {
    total_operacoes: number
    ganhou: number
    perdeu: number
    pendente: number
    em_andamento: number
    taxa_acerto: number
    resultado: number
    saldo_final: number
    risco_retorno_medio: number
  }
  plano: {
    seguhou_total: number
    seguhou_resultado: number
    nao_seguhou_total: number
    nao_seguhou_resultado: number
    taxa_seguimento: number
  }
  evidencia: EvidenceReport
  capturas: CapturaItem[]
  mindset: GroupRow[]
  ativos: GroupRow[]
  direcoes: GroupRow[]
  dias_semana: GroupRow[]
  observacoes: ObservationRow[]
  execucao: {
    nota_media: number
    dias_com_checklist: number
    itens_nao_cumpridos: Record<string, number>
  }
}

export interface TradingSummary {
  ano: number
  mes: number
  operacoes_mes: number
  pendentes: number
  em_andamento: number
  taxa_acerto: number
  resultado: number
  taxa_seguimento: number
  nota_media: number
  checklist_hoje: ChecklistStatus
}
