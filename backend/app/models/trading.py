from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TradeDirection:
    COMPRA = "COMPRA"
    VENDA = "VENDA"

    @classmethod
    def all(cls) -> tuple[str, ...]:
        return (cls.COMPRA, cls.VENDA)


class TradeStatus:
    PENDENTE = "PENDENTE"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    GANHOU = "GANHOU"
    PERDEU = "PERDEU"

    @classmethod
    def all(cls) -> tuple[str, ...]:
        return (cls.PENDENTE, cls.EM_ANDAMENTO, cls.GANHOU, cls.PERDEU)

    @classmethod
    def closed(cls) -> tuple[str, ...]:
        return (cls.GANHOU, cls.PERDEU)


class MacroDirection:
    ALTA = "ALTA"
    BAIXA = "BAIXA"


class MacroBias:
    A_FAVOR = "A_FAVOR"
    CONTRA = "CONTRA"


class PriceRegion:
    CARA = "CARA"
    BARATA = "BARATA"


class TradeEvidenceType:
    ENTRADA = "ENTRADA"
    GESTAO = "GESTAO"
    FECHO = "FECHO"

    @classmethod
    def all(cls) -> tuple[str, ...]:
        return (cls.ENTRADA, cls.GESTAO, cls.FECHO)


class TradeReviewStatus:
    NAO_REVISADA = "NAO_REVISADA"
    APROVADA = "APROVADA"
    INCONSISTENTE = "INCONSISTENTE"
    CORRECAO_PEDIDA = "CORRECAO_PEDIDA"

    @classmethod
    def all(cls) -> tuple[str, ...]:
        return (cls.NAO_REVISADA, cls.APROVADA, cls.INCONSISTENTE, cls.CORRECAO_PEDIDA)


class TradeReviewAction:
    APROVADA = "APROVADA"
    REPROVADA = "REPROVADA"
    CORRECAO_PEDIDA = "CORRECAO_PEDIDA"
    RESPOSTA_OPERADOR = "RESPOSTA_OPERADOR"

    @classmethod
    def all(cls) -> tuple[str, ...]:
        return (cls.APROVADA, cls.REPROVADA, cls.CORRECAO_PEDIDA, cls.RESPOSTA_OPERADOR)


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    data_abertura: Mapped[date] = mapped_column(Date, nullable=False)
    saldo_inicial: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    operator = relationship("User")


class TradingMonth(Base):
    __tablename__ = "trading_months"
    __table_args__ = (UniqueConstraint("operator_id", "ano", "mes", name="uq_trading_months_operator_ano_mes"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    depositos: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    saques: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    bonus: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    operator = relationship("User")


class TradingChecklist(Base):
    __tablename__ = "trading_checklists"
    __table_args__ = (UniqueConstraint("operator_id", "data_pregao", name="uq_trading_checklists_operator_data"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    data_pregao: Mapped[date] = mapped_column(Date, index=True, nullable=False)

    s01_sono: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s01_fisico: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s01_emocional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s01_plano: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s01_gestao_risco: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    s02_pre_trading: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s02_atividade: Mapped[str | None] = mapped_column(Text)

    s03_noticias: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s03_360: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s03_ativos: Mapped[str | None] = mapped_column(Text)

    s05_planilha: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s05_gerenciamento: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s05_seguimento: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    s05_nota: Mapped[int | None] = mapped_column(Integer)
    s05_aprendizado: Mapped[str | None] = mapped_column(Text)

    precheck_concluido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fechado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fechado_em: Mapped[datetime | None] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    operator = relationship("User")


class TradingTrade(Base):
    __tablename__ = "trading_trades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    data_operacao: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    ativo: Mapped[str] = mapped_column(String(30), nullable=False)
    direcao: Mapped[str] = mapped_column(String(10), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default=TradeStatus.PENDENTE, index=True, nullable=False)
    preco_entrada: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    preco_stop: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    preco_alvo: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    preco_saida: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    hora_entrada: Mapped[datetime | None] = mapped_column(DateTime)
    hora_saida: Mapped[datetime | None] = mapped_column(DateTime)
    tamanho_lote: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    valor_finaneiro: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    risco_retorno: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    seguiu_plano: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mindset: Mapped[str | None] = mapped_column(String(30))
    observacoes: Mapped[str | None] = mapped_column(Text)
    revisao_estado: Mapped[str] = mapped_column(String(20), default=TradeReviewStatus.NAO_REVISADA, index=True, nullable=False)
    revisao_por: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    revisao_em: Mapped[datetime | None] = mapped_column(DateTime)
    revisao_comentario: Mapped[str | None] = mapped_column(Text)
    divergencia_plano: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    operator = relationship("User", foreign_keys=[operator_id])
    creator = relationship("User", foreign_keys=[created_by])
    revisor = relationship("User", foreign_keys=[revisao_por])
    method = relationship("TradingMethod", back_populates="trade", uselist=False, cascade="all, delete-orphan")
    evidencias = relationship("TradingEvidence", back_populates="trade", cascade="all, delete-orphan")
    revisoes = relationship("TradingReview", back_populates="trade", cascade="all, delete-orphan")


class TradingMethod(Base):
    __tablename__ = "trading_methods"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trading_trades.id"), unique=True, index=True)

    passo1_captura_liquidez: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    macro_direcao: Mapped[str | None] = mapped_column(String(10))
    macro_vies: Mapped[str | None] = mapped_column(String(20))
    mediana_corretivo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mediana_regiao: Mapped[str | None] = mapped_column(String(10))
    mediana_captura_asia: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    micro_capturou_liquidez: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    micro_reagiu_poi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    micro_ineficiencia: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    micro_quebrou_estrutura: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proj_fibonacci: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proj_ote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proj_order_blocks: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proj_fvg: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entrada_aguardou_interna: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entrada_captura_interna: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entrada_reagiu_ob: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entrada_executada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ger_stop_110: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alvo_fib_extensao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alvo_liquidez_externa: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alvo_pdl_pdh: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alvo_asia: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alvo_ponto_parada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    trade = relationship("TradingTrade", back_populates="method")


class TradingEvidence(Base):
    __tablename__ = "trading_evidences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trading_trades.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    alerta_hash_duplicado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alerta_upload_tardio: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trade = relationship("TradingTrade", back_populates="evidencias")
    user = relationship("User")


class TradingReview(Base):
    __tablename__ = "trading_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trading_trades.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    comentario: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trade = relationship("TradingTrade", back_populates="revisoes")
    user = relationship("User")
