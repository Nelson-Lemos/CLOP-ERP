from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TradeDirectionLiteral = Literal["COMPRA", "VENDA"]
TradeStatusLiteral = Literal["PENDENTE", "EM_ANDAMENTO", "GANHOU", "PERDEU"]
MacroDirectionLiteral = Literal["ALTA", "BAIXA"]
MacroBiasLiteral = Literal["A_FAVOR", "CONTRA"]
PriceRegionLiteral = Literal["CARA", "BARATA"]
EvidenceTipoLiteral = Literal["ENTRADA", "GESTAO", "FECHO"]
RevisaoEstadoLiteral = Literal["NAO_REVISADA", "APROVADA", "INCONSISTENTE", "CORRECAO_PEDIDA"]
RevisaoAcaoLiteral = Literal["APROVADA", "REPROVADA", "CORRECAO_PEDIDA", "RESPOSTA_OPERADOR"]

MINDSET_OPTIONS = (
    "CALMO",
    "CONFIANTE",
    "ANSIOSO",
    "COM_MEDO",
    "GANANCIOSO",
    "FRUSTRADO",
    "EUFORICO",
    "CANSADO",
    "OUTRO",
)


class ChecklistSave(BaseModel):
    s01_sono: bool = False
    s01_fisico: bool = False
    s01_emocional: bool = False
    s01_plano: bool = False
    s01_gestao_risco: bool = False
    s02_pre_trading: bool = False
    s02_atividade: str | None = Field(default=None, max_length=1000)
    s03_noticias: bool = False
    s03_360: bool = False
    s03_ativos: str | None = Field(default=None, max_length=500)
    s05_planilha: bool = False
    s05_gerenciamento: bool = False
    s05_seguimento: bool = False
    s05_nota: int | None = Field(default=None, ge=1, le=5)
    s05_aprendizado: str | None = Field(default=None, max_length=2000)


class ChecklistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operator_id: int
    operator_nome: str | None = None
    data_pregao: date
    s01_sono: bool
    s01_fisico: bool
    s01_emocional: bool
    s01_plano: bool
    s01_gestao_risco: bool
    s02_pre_trading: bool
    s02_atividade: str | None = None
    s03_noticias: bool
    s03_360: bool
    s03_ativos: str | None = None
    s05_planilha: bool
    s05_gerenciamento: bool
    s05_seguimento: bool
    s05_nota: int | None = None
    s05_aprendizado: str | None = None
    precheck_concluido: bool
    fechado: bool
    fechado_em: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ChecklistStatusOut(BaseModel):
    data_pregao: date
    existe: bool
    precheck_concluido: bool
    fechado: bool


class MethodPayload(BaseModel):
    passo1_captura_liquidez: bool = False
    macro_direcao: MacroDirectionLiteral | None = None
    macro_vies: MacroBiasLiteral | None = None
    mediana_corretivo: bool = False
    mediana_regiao: PriceRegionLiteral | None = None
    mediana_captura_asia: bool = False
    micro_capturou_liquidez: bool = False
    micro_reagiu_poi: bool = False
    micro_ineficiencia: bool = False
    micro_quebrou_estrutura: bool = False
    proj_fibonacci: bool = False
    proj_ote: bool = False
    proj_order_blocks: bool = False
    proj_fvg: bool = False
    entrada_aguardou_interna: bool = False
    entrada_captura_interna: bool = False
    entrada_reagiu_ob: bool = False
    entrada_executada: bool = False
    ger_stop_110: bool = False
    alvo_fib_extensao: bool = False
    alvo_liquidez_externa: bool = False
    alvo_pdl_pdh: bool = False
    alvo_asia: bool = False
    alvo_ponto_parada: bool = False
    observacoes: str | None = Field(default=None, max_length=2000)


class MethodOut(MethodPayload):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int


class TradeCreate(BaseModel):
    data_operacao: date
    ativo: str = Field(min_length=1, max_length=30)
    direcao: TradeDirectionLiteral
    estado: TradeStatusLiteral = "PENDENTE"
    preco_entrada: float | None = Field(default=None, gt=0)
    preco_stop: float | None = Field(default=None, gt=0)
    preco_alvo: float | None = Field(default=None, gt=0)
    preco_saida: float | None = Field(default=None, gt=0)
    hora_entrada: datetime | None = None
    hora_saida: datetime | None = None
    tamanho_lote: float | None = Field(default=None, gt=0)
    valor_finaneiro: float | None = None
    risco_retorno: float | None = Field(default=None, ge=0)
    seguiu_plano: bool = True
    mindset: str | None = Field(default=None, max_length=30)
    observacoes: str | None = Field(default=None, max_length=4000)
    method: MethodPayload | None = None


class TradeUpdate(BaseModel):
    data_operacao: date | None = None
    ativo: str | None = Field(default=None, min_length=1, max_length=30)
    direcao: TradeDirectionLiteral | None = None
    estado: TradeStatusLiteral | None = None
    preco_entrada: float | None = Field(default=None, gt=0)
    preco_stop: float | None = Field(default=None, gt=0)
    preco_alvo: float | None = Field(default=None, gt=0)
    preco_saida: float | None = Field(default=None, gt=0)
    hora_entrada: datetime | None = None
    hora_saida: datetime | None = None
    tamanho_lote: float | None = Field(default=None, gt=0)
    valor_finaneiro: float | None = None
    risco_retorno: float | None = Field(default=None, ge=0)
    seguiu_plano: bool | None = None
    mindset: str | None = Field(default=None, max_length=30)
    observacoes: str | None = Field(default=None, max_length=4000)
    method: MethodPayload | None = None


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    user_id: int
    uploader_nome: str | None = None
    tipo: str
    filename: str
    content_type: str | None = None
    size: int
    sha256: str
    alerta_hash_duplicado: bool
    alerta_upload_tardio: bool
    uploaded_at: datetime
    url: str | None = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_id: int
    user_id: int
    user_nome: str | None = None
    action: str
    comentario: str | None = None
    created_at: datetime


class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operator_id: int
    operator_nome: str | None = None
    data_operacao: date
    ativo: str
    direcao: str
    estado: str
    preco_entrada: float | None = None
    preco_stop: float | None = None
    preco_alvo: float | None = None
    preco_saida: float | None = None
    hora_entrada: datetime | None = None
    hora_saida: datetime | None = None
    tamanho_lote: float | None = None
    valor_finaneiro: float | None = None
    risco_retorno: float | None = None
    seguiu_plano: bool
    mindset: str | None = None
    observacoes: str | None = None
    revisao_estado: str
    revisao_por: int | None = None
    revisao_por_nome: str | None = None
    revisao_em: datetime | None = None
    revisao_comentario: str | None = None
    divergencia_plano: bool
    tem_evidencia_entrada: bool = False
    tem_evidencia_fecho: bool = False
    created_by: int
    created_at: datetime
    updated_at: datetime
    method: MethodOut | None = None
    evidencias: list[EvidenceOut] = []
    revisoes: list[ReviewOut] = []


class ReviewDecisionInput(BaseModel):
    decision: Literal["APROVADA", "INCONSISTENTE", "CORRECAO_PEDIDA"]
    comentario: str = Field(min_length=3, max_length=2000)
    divergencia_plano: bool | None = None

    @model_validator(mode="after")
    def _coerente(self) -> "ReviewDecisionInput":
        self.comentario = self.comentario.strip()
        return self


class ReviewResponseInput(BaseModel):
    comentario: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def _coerente(self) -> "ReviewResponseInput":
        self.comentario = self.comentario.strip()
        return self


class ReviewQueueOut(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[TradeOut]


class AccountSave(BaseModel):
    data_abertura: date
    saldo_inicial: float = Field(ge=0)


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operator_id: int
    operator_nome: str | None = None
    data_abertura: date
    saldo_inicial: float
    created_at: datetime
    updated_at: datetime


class MonthUpdate(BaseModel):
    depositos: float = Field(default=0, ge=0)
    saques: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)


class MonthOut(BaseModel):
    ano: int
    mes: int
    gain: float = 0
    loss: float = 0
    depositos: float = 0
    saques: float = 0
    bonus: float = 0
    saldo_inicial: float = 0
    resultado: float = 0
    saldo_final: float = 0
    ganhou: int = 0
    perdeu: int = 0
    taxa_acerto: float = 0


class EvolutionOut(BaseModel):
    operator_id: int
    operator_nome: str | None = None
    ano: int
    meses: list[MonthOut]
    total: MonthOut
