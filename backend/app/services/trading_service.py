import hashlib
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import extract
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.notification import NotificationType
from app.models.trading import (
    TradeEvidenceType,
    TradeReviewAction,
    TradeReviewStatus,
    TradeStatus,
    TradingAccount,
    TradingChecklist,
    TradingEvidence,
    TradingMethod,
    TradingMonth,
    TradingReview,
    TradingTrade,
)
from app.models.user import User, UserRole
from app.schemas.trading import MINDSET_OPTIONS, ChecklistSave, MethodPayload
from app.services.notification_service import send_notification

ZERO = Decimal("0.00")

EVIDENCE_DIR = Path(settings.UPLOAD_DIR) / "evidences"

EVIDENCE_URL_TEMPLATE = "/api/trading/evidences/{id}/file"

ALLOWED_EVIDENCE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")

WEEKDAYS_PT = ("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")

MONTHS_PT = (
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)


def money(value: float | Decimal | None) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def month_label(ano: int, mes: int) -> str:
    return f"{MONTHS_PT[mes - 1]}/{ano}"


def can_view_all(actor: User) -> bool:
    return UserRole.is_admin(actor.role) or actor.role in (UserRole.MANAGER, UserRole.TRADING_LEADER)


def can_review_trades(actor: User) -> bool:
    return UserRole.is_admin(actor.role) or actor.role in (UserRole.MANAGER, UserRole.TRADING_LEADER)


def leader_ids(db: Session) -> list[int]:
    rows = (
        db.query(User.id)
        .filter(
            User.estado == "ACTIVE",
            User.role.in_([UserRole.CEO, UserRole.PCA, UserRole.MANAGER, UserRole.TRADING_LEADER]),
        )
        .all()
    )
    return [row.id for row in rows]


def notify_leaders(db: Session, *, title: str, message: str, notification_type: str) -> None:
    for user_id in leader_ids(db):
        send_notification(db, user_id=user_id, title=title, message=message, type=notification_type)


def resolve_operator_id(actor: User, operator_id: int | None) -> int:
    if operator_id is None or operator_id == actor.id:
        return actor.id
    if not can_view_all(actor):
        raise PermissionError("Sem permissão para ver registos de outro operador")
    return operator_id


def compute_precheck(checklist: TradingChecklist) -> bool:
    return all([
        checklist.s01_sono,
        checklist.s01_fisico,
        checklist.s01_emocional,
        checklist.s01_plano,
        checklist.s01_gestao_risco,
        checklist.s02_pre_trading,
        checklist.s03_noticias,
        checklist.s03_360,
    ])


def get_account(db: Session, *, operator_id: int) -> TradingAccount | None:
    return db.query(TradingAccount).filter(TradingAccount.operator_id == operator_id).first()


def save_account(db: Session, *, operator_id: int, data_abertura: date, saldo_inicial: float) -> TradingAccount:
    account = get_account(db, operator_id=operator_id)
    if account is None:
        account = TradingAccount(operator_id=operator_id, data_abertura=data_abertura, saldo_inicial=money(saldo_inicial))
        db.add(account)
    else:
        account.data_abertura = data_abertura
        account.saldo_inicial = money(saldo_inicial)
    db.commit()
    db.refresh(account)
    return account


def get_checklist(db: Session, *, operator_id: int, data_pregao: date) -> TradingChecklist | None:
    return (
        db.query(TradingChecklist)
        .filter(TradingChecklist.operator_id == operator_id, TradingChecklist.data_pregao == data_pregao)
        .first()
    )


def list_checklists(db: Session, *, operator_id: int, data_inicio: date | None = None, data_fim: date | None = None) -> list[TradingChecklist]:
    query = db.query(TradingChecklist).filter(TradingChecklist.operator_id == operator_id)
    if data_inicio:
        query = query.filter(TradingChecklist.data_pregao >= data_inicio)
    if data_fim:
        query = query.filter(TradingChecklist.data_pregao <= data_fim)
    return query.order_by(TradingChecklist.data_pregao.desc()).all()


def month_checklists(db: Session, *, operator_id: int, ano: int, mes: int) -> list[TradingChecklist]:
    return (
        db.query(TradingChecklist)
        .filter(
            TradingChecklist.operator_id == operator_id,
            extract("year", TradingChecklist.data_pregao) == ano,
            extract("month", TradingChecklist.data_pregao) == mes,
        )
        .all()
    )


def save_checklist(db: Session, *, operator_id: int, data_pregao: date, payload: ChecklistSave, allow_closed: bool = False) -> TradingChecklist:
    checklist = get_checklist(db, operator_id=operator_id, data_pregao=data_pregao)
    if checklist is not None and checklist.fechado and not allow_closed:
        raise ValueError("O dia já foi fechado; o checklist é somente leitura")
    if checklist is None:
        checklist = TradingChecklist(operator_id=operator_id, data_pregao=data_pregao)
        db.add(checklist)
    for field, value in payload.model_dump().items():
        setattr(checklist, field, value)
    checklist.precheck_concluido = compute_precheck(checklist)
    db.commit()
    db.refresh(checklist)
    return checklist


def close_checklist(db: Session, *, operator_id: int, data_pregao: date) -> TradingChecklist:
    checklist = get_checklist(db, operator_id=operator_id, data_pregao=data_pregao)
    if checklist is None:
        raise ValueError("Checklist do dia ainda não foi iniciado")
    if not checklist.precheck_concluido:
        raise ValueError("Conclua as secções 01 a 03 antes de fechar o dia")
    checklist.fechado = True
    checklist.fechado_em = datetime.now()
    db.commit()
    db.refresh(checklist)
    return checklist


def reopen_checklist(db: Session, *, operator_id: int, data_pregao: date) -> TradingChecklist:
    checklist = get_checklist(db, operator_id=operator_id, data_pregao=data_pregao)
    if checklist is None:
        raise ValueError("Checklist do dia não encontrado")
    checklist.fechado = False
    checklist.fechado_em = None
    db.commit()
    db.refresh(checklist)
    return checklist


def require_precheck(db: Session, *, operator_id: int, data_pregao: date) -> None:
    checklist = get_checklist(db, operator_id=operator_id, data_pregao=data_pregao)
    if checklist is None or not checklist.precheck_concluido:
        raise ValueError("Preencha primeiro as secções 01 a 03 do Checklist Operacional deste dia")


def validate_mindset(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    normalized = value.strip().upper()
    if normalized not in MINDSET_OPTIONS:
        raise ValueError("Estado emocional inválido")
    return normalized


def validate_trade_value(estado: str, valor: float | Decimal | None) -> Decimal | None:
    closed = estado in ("GANHOU", "PERDEU")
    if not closed:
        if valor not in (None, 0, 0.0):
            raise ValueError("Operações pendentes ou em andamento não devem ter valor financeiro")
        return None
    if valor is None:
        raise ValueError("Informe o valor financeiro da operação fechada")
    value = money(valor)
    if estado == "GANHOU" and value <= ZERO:
        raise ValueError("Operações ganhas devem ter valor positivo")
    if estado == "PERDEU" and value >= ZERO:
        raise ValueError("Operações perdidas devem ter valor negativo")
    return value


def _price(value: float | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def validate_prices(direcao: str, entrada: Decimal | None, stop: Decimal | None, alvo: Decimal | None) -> None:
    for label, value in (("entrada", entrada), ("stop", stop), ("alvo", alvo)):
        if value is not None and value <= ZERO:
            raise ValueError(f"O preço de {label} deve ser positivo")
    if entrada is None:
        return
    if stop is None and alvo is None:
        return
    if stop is None or alvo is None:
        raise ValueError("Informe o stop e o alvo em conjunto com o preço de entrada")
    if stop == entrada:
        raise ValueError("O stop não pode ser igual ao preço de entrada")
    if alvo == entrada:
        raise ValueError("O alvo não pode ser igual ao preço de entrada")
    if direcao == "COMPRA":
        if stop >= entrada:
            raise ValueError("Numa COMPRA o stop deve ficar abaixo do preço de entrada")
        if alvo <= entrada:
            raise ValueError("Numa COMPRA o alvo deve ficar acima do preço de entrada")
    else:
        if stop <= entrada:
            raise ValueError("Numa VENDA o stop deve ficar acima do preço de entrada")
        if alvo >= entrada:
            raise ValueError("Numa VENDA o alvo deve ficar abaixo do preço de entrada")


def compute_risco_retorno(entrada: Decimal | None, stop: Decimal | None, alvo: Decimal | None) -> Decimal | None:
    if entrada is None or stop is None or alvo is None:
        return None
    risco = abs(entrada - stop)
    if risco == ZERO:
        return None
    retorno = abs(alvo - entrada)
    return (retorno / risco).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def has_evidence(trade: TradingTrade, tipo: str) -> bool:
    return any(e.tipo == tipo for e in trade.evidencias)


def validate_estado_evidence(estado: str, trade: TradingTrade, *, preco_saida: Decimal | None = None) -> None:
    if estado == TradeStatus.EM_ANDAMENTO:
        if settings.TRADING_REQUIRE_EVIDENCE and not has_evidence(trade, TradeEvidenceType.ENTRADA):
            raise ValueError("Sem captura de entrada a operação não pode passar para Em andamento")
    if estado in TradeStatus.closed():
        if settings.TRADING_REQUIRE_EVIDENCE:
            if not has_evidence(trade, TradeEvidenceType.ENTRADA):
                raise ValueError("Sem captura de entrada a operação não pode ser fechada")
            if not has_evidence(trade, TradeEvidenceType.FECHO):
                raise ValueError("Sem captura de fecho a operação não pode passar para Ganhou/Perdeu")
        if settings.TRADING_REQUIRE_PRECO_SAIDA and preco_saida is None:
            raise ValueError("Informe o preço de saída para fechar a operação")


def apply_method(method: TradingMethod, payload: MethodPayload) -> None:
    for field, value in payload.model_dump().items():
        setattr(method, field, value)


def create_trade(
    db: Session,
    *,
    actor: User,
    operator_id: int,
    data_operacao: date,
    ativo: str,
    direcao: str,
    estado: str,
    preco_entrada: float | None,
    preco_stop: float | None,
    preco_alvo: float | None,
    preco_saida: float | None,
    hora_entrada: datetime | None,
    hora_saida: datetime | None,
    tamanho_lote: float | None,
    valor_finaneiro: float | None,
    risco_retorno: float | None,
    seguiu_plano: bool,
    mindset: str | None,
    observacoes: str | None,
    method: MethodPayload | None,
) -> TradingTrade:
    require_precheck(db, operator_id=operator_id, data_pregao=data_operacao)
    entrada, stop, alvo, saida = _price(preco_entrada), _price(preco_stop), _price(preco_alvo), _price(preco_saida)
    validate_prices(direcao, entrada, stop, alvo)
    if settings.TRADING_REQUIRE_PRECOS and (entrada is None or stop is None or alvo is None):
        raise ValueError("Informe o preço de entrada, o stop e o alvo da operação")
    if settings.TRADING_REQUIRE_PRECO_SAIDA and estado in TradeStatus.closed() and saida is None:
        raise ValueError("Informe o preço de saída para fechar a operação")
    trade = TradingTrade(
        operator_id=operator_id,
        data_operacao=data_operacao,
        ativo=ativo.strip().upper(),
        direcao=direcao,
        estado=estado,
        preco_entrada=entrada,
        preco_stop=stop,
        preco_alvo=alvo,
        preco_saida=saida,
        hora_entrada=hora_entrada,
        hora_saida=hora_saida,
        tamanho_lote=_price(tamanho_lote),
        valor_finaneiro=validate_trade_value(estado, valor_finaneiro),
        risco_retorno=compute_risco_retorno(entrada, stop, alvo)
        or (Decimal(str(risco_retorno)).quantize(Decimal("0.01")) if risco_retorno is not None else None),
        seguiu_plano=seguiu_plano,
        mindset=validate_mindset(mindset),
        observacoes=observacoes.strip() if observacoes else None,
        created_by=actor.id,
    )
    trade.method = TradingMethod()
    if method is not None:
        apply_method(trade.method, method)
    db.add(trade)
    db.flush()
    validate_estado_evidence(estado, trade, preco_saida=saida)
    db.commit()
    db.refresh(trade)
    return trade


PRICE_FIELDS = ("preco_entrada", "preco_stop", "preco_alvo", "preco_saida")


def update_trade(
    db: Session,
    *,
    trade: TradingTrade,
    data_operacao: date | None,
    ativo: str | None,
    direcao: str | None,
    estado: str | None,
    preco_entrada: float | None,
    preco_stop: float | None,
    preco_alvo: float | None,
    preco_saida: float | None,
    hora_entrada: datetime | None,
    hora_saida: datetime | None,
    tamanho_lote: float | None,
    valor_finaneiro: float | None,
    risco_retorno: float | None,
    seguiu_plano: bool | None,
    mindset: str | None,
    observacoes: str | None,
    method: MethodPayload | None,
) -> TradingTrade:
    new_estado = estado or trade.estado
    new_data = data_operacao or trade.data_operacao
    new_direcao = direcao or trade.direcao
    if new_data != trade.data_operacao or estado is not None:
        require_precheck(db, operator_id=trade.operator_id, data_pregao=new_data)
    entrada = _price(preco_entrada) if preco_entrada is not None else trade.preco_entrada
    stop = _price(preco_stop) if preco_stop is not None else trade.preco_stop
    alvo = _price(preco_alvo) if preco_alvo is not None else trade.preco_alvo
    saida = _price(preco_saida) if preco_saida is not None else trade.preco_saida
    validate_prices(new_direcao, entrada, stop, alvo)
    if new_estado in TradeStatus.closed() and settings.TRADING_REQUIRE_PRECOS and (
        entrada is None or stop is None or alvo is None
    ):
        raise ValueError("Informe o preço de entrada, o stop e o alvo da operação")
    if data_operacao is not None:
        trade.data_operacao = data_operacao
    if ativo is not None:
        trade.ativo = ativo.strip().upper()
    if direcao is not None:
        trade.direcao = direcao
    if preco_entrada is not None:
        trade.preco_entrada = entrada
    if preco_stop is not None:
        trade.preco_stop = stop
    if preco_alvo is not None:
        trade.preco_alvo = alvo
    if preco_saida is not None:
        trade.preco_saida = saida
    if hora_entrada is not None:
        trade.hora_entrada = hora_entrada
    if hora_saida is not None:
        trade.hora_saida = hora_saida
    if tamanho_lote is not None:
        trade.tamanho_lote = _price(tamanho_lote)
    if estado is not None:
        trade.estado = estado
    if estado is not None or valor_finaneiro is not None:
        if new_estado in ("PENDENTE", "EM_ANDAMENTO"):
            trade.valor_finaneiro = validate_trade_value(new_estado, valor_finaneiro)
        elif valor_finaneiro is not None:
            trade.valor_finaneiro = validate_trade_value(new_estado, valor_finaneiro)
        elif trade.valor_finaneiro is not None:
            old_value = float(trade.valor_finaneiro)
            if (new_estado == "GANHOU" and old_value < 0) or (new_estado == "PERDEU" and old_value > 0):
                old_value = -old_value
            trade.valor_finaneiro = validate_trade_value(new_estado, old_value)
    auto_rr = compute_risco_retorno(entrada, stop, alvo)
    if auto_rr is not None:
        trade.risco_retorno = auto_rr
    elif risco_retorno is not None:
        trade.risco_retorno = Decimal(str(risco_retorno)).quantize(Decimal("0.01"))
    if seguiu_plano is not None:
        trade.seguiu_plano = seguiu_plano
    if mindset is not None:
        trade.mindset = validate_mindset(mindset)
    if observacoes is not None:
        trade.observacoes = observacoes.strip() or None
    if method is not None:
        if trade.method is None:
            trade.method = TradingMethod()
        apply_method(trade.method, method)
    db.flush()
    validate_estado_evidence(new_estado, trade, preco_saida=saida)
    touched = (
        estado is not None
        or valor_finaneiro is not None
        or preco_saida is not None
        or preco_entrada is not None
        or preco_stop is not None
        or preco_alvo is not None
    )
    if touched and trade.revisao_estado != TradeReviewStatus.NAO_REVISADA:
        reset_review(trade)
    db.commit()
    db.refresh(trade)
    return trade


def reset_review(trade: TradingTrade) -> None:
    trade.revisao_estado = TradeReviewStatus.NAO_REVISADA
    trade.revisao_por = None
    trade.revisao_em = None
    trade.revisao_comentario = None
    trade.divergencia_plano = False


def delete_trade(db: Session, *, trade: TradingTrade) -> None:
    for evidence in list(trade.evidencias):
        _remove_evidence_file(evidence)
    if trade.method is not None:
        db.delete(trade.method)
    db.delete(trade)
    db.commit()


def _remove_evidence_file(evidence: TradingEvidence) -> None:
    try:
        path = Path(evidence.file_path)
        if path.exists():
            path.unlink()
    except OSError:
        pass


def add_evidence(
    db: Session,
    *,
    trade: TradingTrade,
    user: User,
    tipo: str,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> TradingEvidence:
    digest = hashlib.sha256(content).hexdigest()
    duplicado = (
        db.query(TradingEvidence)
        .filter(TradingEvidence.sha256 == digest, TradingEvidence.trade_id != trade.id)
        .first()
        is not None
    )
    tardio = (date.today() - trade.data_operacao).days > settings.TRADE_EVIDENCE_LATE_DAYS
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(ch for ch in filename if ch.isalnum() or ch in (" ", ".", "-", "_")).strip() or "evidencia"
    path = EVIDENCE_DIR / f"trade_{trade.id}_{uuid.uuid4().hex[:10]}_{safe_name}"
    path.write_bytes(content)
    evidence = TradingEvidence(
        trade_id=trade.id,
        user_id=user.id,
        tipo=tipo,
        filename=filename,
        file_path=str(path),
        content_type=content_type,
        size=len(content),
        sha256=digest,
        alerta_hash_duplicado=duplicado,
        alerta_upload_tardio=tardio,
    )
    db.add(evidence)
    if trade.revisao_estado != TradeReviewStatus.NAO_REVISADA:
        reset_review(trade)
    operator_name = trade.operator.nome_completo if trade.operator else f"Operador #{trade.operator_id}"
    if duplicado:
        notify_leaders(
            db,
            title="Evidência com hash reutilizado",
            message=f"{user.nome_completo} enviou uma evidência com o mesmo ficheiro (hash) numa operação diferente ({trade.ativo} de {trade.data_operacao.isoformat()}).",
            notification_type=NotificationType.TRADE_EVIDENCE_ALERT,
        )
    if tardio:
        notify_leaders(
            db,
            title="Evidência enviada fora de tempo",
            message=f"{user.nome_completo} enviou uma evidência de {operator_name} com data/hora muito posterior à data da operação ({trade.data_operacao.isoformat()}).",
            notification_type=NotificationType.TRADE_EVIDENCE_ALERT,
        )
    db.commit()
    db.refresh(evidence)
    return evidence


def review_trade(
    db: Session,
    *,
    trade: TradingTrade,
    reviewer: User,
    decision: str,
    comentario: str,
    divergencia_plano: bool | None,
) -> TradingTrade:
    if trade.estado not in TradeStatus.closed():
        raise ValueError("Apenas operações fechadas podem ser revistas")
    if decision == "APROVADA":
        trade.revisao_estado = TradeReviewStatus.APROVADA
    elif decision == "INCONSISTENTE":
        trade.revisao_estado = TradeReviewStatus.INCONSISTENTE
    else:
        trade.revisao_estado = TradeReviewStatus.CORRECAO_PEDIDA
    trade.revisao_por = reviewer.id
    trade.revisao_em = datetime.now()
    trade.revisao_comentario = comentario
    if divergencia_plano is not None:
        trade.divergencia_plano = divergencia_plano
    action = {
        "APROVADA": TradeReviewAction.APROVADA,
        "INCONSISTENTE": TradeReviewAction.REPROVADA,
        "CORRECAO_PEDIDA": TradeReviewAction.CORRECAO_PEDIDA,
    }[decision]
    db.add(TradingReview(trade_id=trade.id, user_id=reviewer.id, action=action, comentario=comentario))
    labels = {
        "APROVADA": ("Operação aprovada", "aprovada"),
        "INCONSISTENTE": ("Operação marcada com inconsistência", "marcada como inconsistente"),
        "CORRECAO_PEDIDA": ("Correcção pedida na operação", "aguarda a sua correcção"),
    }
    title, verb = labels[decision]
    send_notification(
        db,
        user_id=trade.operator_id,
        title=title,
        message=f"{reviewer.nome_completo} {verb} a operação {trade.ativo} de {trade.data_operacao.isoformat()}: {comentario}",
        type=NotificationType.TRADE_REVIEW,
    )
    db.commit()
    db.refresh(trade)
    return trade


def respond_review(
    db: Session,
    *,
    trade: TradingTrade,
    operator: User,
    comentario: str,
) -> TradingTrade:
    if trade.revisao_estado == TradeReviewStatus.NAO_REVISADA:
        raise ValueError("Esta operação não está a aguardar resposta do operador")
    db.add(
        TradingReview(
            trade_id=trade.id,
            user_id=operator.id,
            action=TradeReviewAction.RESPOSTA_OPERADOR,
            comentario=comentario,
        )
    )
    reviewer_id = trade.revisao_por
    reset_review(trade)
    if reviewer_id is not None:
        send_notification(
            db,
            user_id=reviewer_id,
            title="Operador respondeu à revisão",
            message=f"{operator.nome_completo} respondeu à revisão da operação {trade.ativo} de {trade.data_operacao.isoformat()}: {comentario}",
            type=NotificationType.TRADE_REVIEW,
        )
    db.commit()
    db.refresh(trade)
    return trade


def review_queue(
    db: Session,
    *,
    operator_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    ativo: str | None = None,
    revisao_estado: str | None = None,
    resultado: str | None = None,
    seguiu_plano: bool | None = None,
    divergencia: bool | None = None,
    sem_evidencia: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    query = db.query(TradingTrade).filter(TradingTrade.estado.in_(TradeStatus.closed()))
    if operator_id is not None:
        query = query.filter(TradingTrade.operator_id == operator_id)
    if data_inicio:
        query = query.filter(TradingTrade.data_operacao >= data_inicio)
    if data_fim:
        query = query.filter(TradingTrade.data_operacao <= data_fim)
    if ativo:
        query = query.filter(TradingTrade.ativo == ativo.strip().upper())
    if revisao_estado:
        if revisao_estado not in TradeReviewStatus.all():
            raise ValueError("Estado de revisão inválido")
        query = query.filter(TradingTrade.revisao_estado == revisao_estado)
    if resultado in TradeStatus.closed():
        query = query.filter(TradingTrade.estado == resultado)
    if seguiu_plano is not None:
        query = query.filter(TradingTrade.seguiu_plano == seguiu_plano)
    if divergencia is not None:
        query = query.filter(TradingTrade.divergencia_plano == divergencia)
    if sem_evidencia is True:
        query = query.filter(~TradingTrade.evidencias.any())
    elif sem_evidencia is False:
        query = query.filter(TradingTrade.evidencias.any())
    total = query.count()
    query = (
        query.options(selectinload(TradingTrade.evidencias), selectinload(TradingTrade.revisoes))
        .order_by(TradingTrade.data_operacao.desc(), TradingTrade.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return {"total": total, "limit": limit, "offset": offset, "items": query.all()}


def evidence_url(evidence: TradingEvidence) -> str:
    return EVIDENCE_URL_TEMPLATE.format(id=evidence.id)


def _trades_by_month(db: Session, *, operator_id: int) -> dict[tuple[int, int], list[TradingTrade]]:
    trades = (
        db.query(TradingTrade)
        .filter(TradingTrade.operator_id == operator_id)
        .options(selectinload(TradingTrade.evidencias), selectinload(TradingTrade.revisoes))
        .order_by(TradingTrade.data_operacao.asc())
        .all()
    )
    grouped: dict[tuple[int, int], list[TradingTrade]] = {}
    for trade in trades:
        grouped.setdefault((trade.data_operacao.year, trade.data_operacao.month), []).append(trade)
    return grouped


def _month_movements(db: Session, *, operator_id: int) -> dict[tuple[int, int], TradingMonth]:
    rows = db.query(TradingMonth).filter(TradingMonth.operator_id == operator_id).all()
    return {(row.ano, row.mes): row for row in rows}


def compute_month_summary(*, trades: list[TradingTrade], movement: TradingMonth | None, saldo_inicial: Decimal) -> dict:
    depositos = money(movement.depositos) if movement else ZERO
    saques = money(movement.saques) if movement else ZERO
    bonus = money(movement.bonus) if movement else ZERO
    resultado = ZERO
    ganhou = perdeu = 0
    gain = loss = ZERO
    for trade in trades:
        if trade.estado == "GANHOU":
            ganhou += 1
        elif trade.estado == "PERDEU":
            perdeu += 1
        if trade.valor_finaneiro is not None and trade.estado in ("GANHOU", "PERDEU"):
            resultado += money(trade.valor_finaneiro)
            if trade.estado == "GANHOU":
                gain += money(trade.valor_finaneiro)
            else:
                loss += money(trade.valor_finaneiro)
    saldo_final = saldo_inicial + depositos + bonus - saques + resultado
    fechadas = ganhou + perdeu
    taxa = round(ganhou / fechadas * 100, 1) if fechadas else 0.0
    return {
        "gain": float(gain),
        "loss": float(loss),
        "depositos": float(depositos),
        "saques": float(saques),
        "bonus": float(bonus),
        "saldo_inicial": float(saldo_inicial),
        "resultado": float(resultado),
        "saldo_final": float(saldo_final),
        "ganhou": ganhou,
        "perdeu": perdeu,
        "taxa_acerto": taxa,
        "_saldo_final": saldo_final,
    }


def _first_month_key(db: Session, *, operator_id: int) -> tuple[int, int]:
    account = get_account(db, operator_id=operator_id)
    if account is not None:
        return (account.data_abertura.year, account.data_abertura.month)
    today = date.today()
    return (today.year, today.month)


def _saldo_chain(db: Session, *, operator_id: int, ate: tuple[int, int]) -> dict[tuple[int, int], Decimal]:
    account = get_account(db, operator_id=operator_id)
    grouped = _trades_by_month(db, operator_id=operator_id)
    movements = _month_movements(db, operator_id=operator_id)
    chain: dict[tuple[int, int], Decimal] = {}
    saldo = money(account.saldo_inicial) if account else ZERO
    year, month = _first_month_key(db, operator_id=operator_id)
    while (year, month) <= ate:
        summary = compute_month_summary(
            trades=grouped.get((year, month), []),
            movement=movements.get((year, month)),
            saldo_inicial=saldo,
        )
        saldo = summary["_saldo_final"]
        chain[(year, month)] = saldo
        month += 1
        if month > 12:
            month = 1
            year += 1
    return chain


def _saldo_inicial_for(db: Session, *, operator_id: int, ano: int, mes: int, chain: dict[tuple[int, int], Decimal]) -> Decimal:
    if (ano, mes) == _first_month_key(db, operator_id=operator_id):
        account = get_account(db, operator_id=operator_id)
        return money(account.saldo_inicial) if account else ZERO
    previous = (ano, mes - 1) if mes > 1 else (ano - 1, 12)
    return chain.get(previous, ZERO)


def month_summary_for(db: Session, *, operator_id: int, ano: int, mes: int) -> dict:
    grouped = _trades_by_month(db, operator_id=operator_id)
    movements = _month_movements(db, operator_id=operator_id)
    chain = _saldo_chain(db, operator_id=operator_id, ate=(ano, mes))
    summary = compute_month_summary(
        trades=grouped.get((ano, mes), []),
        movement=movements.get((ano, mes)),
        saldo_inicial=_saldo_inicial_for(db, operator_id=operator_id, ano=ano, mes=mes, chain=chain),
    )
    summary.pop("_saldo_final", None)
    return summary | {"ano": ano, "mes": mes}


def list_month_summaries(db: Session, *, operator_id: int, ano: int, operator_nome: str | None = None) -> dict:
    grouped = _trades_by_month(db, operator_id=operator_id)
    movements = _month_movements(db, operator_id=operator_id)
    chain = _saldo_chain(db, operator_id=operator_id, ate=(ano, 12))
    account = get_account(db, operator_id=operator_id)

    meses: list[dict] = []
    total_depositos = total_saques = total_bonus = total_resultado = 0.0
    total_gain = total_loss = 0.0
    total_ganhou = total_perdeu = 0
    saldo_final_total = ZERO
    saldo_inicial_total = _saldo_inicial_for(db, operator_id=operator_id, ano=ano, mes=1, chain=chain)
    for mes in range(1, 13):
        summary = compute_month_summary(
            trades=grouped.get((ano, mes), []),
            movement=movements.get((ano, mes)),
            saldo_inicial=_saldo_inicial_for(db, operator_id=operator_id, ano=ano, mes=mes, chain=chain),
        )
        saldo_final_total = summary["_saldo_final"]
        total_depositos += summary["depositos"]
        total_saques += summary["saques"]
        total_bonus += summary["bonus"]
        total_resultado += summary["resultado"]
        total_gain += summary["gain"]
        total_loss += summary["loss"]
        total_ganhou += summary["ganhou"]
        total_perdeu += summary["perdeu"]
        meses.append({k: v for k, v in summary.items() if not k.startswith("_")} | {"ano": ano, "mes": mes})
    fechadas = total_ganhou + total_perdeu
    total = {
        "ano": ano,
        "mes": 0,
        "gain": round(total_gain, 2),
        "loss": round(total_loss, 2),
        "depositos": round(total_depositos, 2),
        "saques": round(total_saques, 2),
        "bonus": round(total_bonus, 2),
        "saldo_inicial": float(saldo_inicial_total),
        "resultado": round(total_resultado, 2),
        "saldo_final": float(saldo_final_total),
        "ganhou": total_ganhou,
        "perdeu": total_perdeu,
        "taxa_acerto": round(total_ganhou / fechadas * 100, 1) if fechadas else 0.0,
    }
    return {
        "operator_id": operator_id,
        "operator_nome": operator_nome,
        "ano": ano,
        "meses": meses,
        "total": total,
    }


def save_month_movements(db: Session, *, operator_id: int, ano: int, mes: int, depositos: float, saques: float, bonus: float) -> TradingMonth:
    if not 1 <= mes <= 12:
        raise ValueError("Mês inválido")
    row = (
        db.query(TradingMonth)
        .filter(TradingMonth.operator_id == operator_id, TradingMonth.ano == ano, TradingMonth.mes == mes)
        .first()
    )
    if row is None:
        row = TradingMonth(operator_id=operator_id, ano=ano, mes=mes)
        db.add(row)
    row.depositos = money(depositos)
    row.saques = money(saques)
    row.bonus = money(bonus)
    db.commit()
    db.refresh(row)
    return row


def monthly_report(
    db: Session,
    *,
    operator_id: int,
    operator_nome: str,
    ano: int,
    mes: int,
    apenas_validadas: bool = False,
    include_urls: bool = False,
    include_files: bool = False,
) -> dict:
    grouped = _trades_by_month(db, operator_id=operator_id)
    trades = grouped.get((ano, mes), [])
    closed = [t for t in trades if t.estado in ("GANHOU", "PERDEU")]
    won = [t for t in closed if t.estado == "GANHOU"]
    lost = [t for t in closed if t.estado == "PERDEU"]
    pending = [t for t in trades if t.estado == "PENDENTE"]
    running = [t for t in trades if t.estado == "EM_ANDAMENTO"]

    stats_closed = closed
    if apenas_validadas:
        stats_closed = [t for t in closed if t.revisao_estado == TradeReviewStatus.APROVADA]
    stats_won = [t for t in stats_closed if t.estado == "GANHOU"]

    resultado = sum((money(t.valor_finaneiro) for t in stats_closed), ZERO)
    taxa = round(len(stats_won) / len(stats_closed) * 100, 1) if stats_closed else 0.0
    rr_values = [float(t.risco_retorno) for t in stats_closed if t.risco_retorno is not None]
    rr_medio = round(sum(rr_values) / len(rr_values), 2) if rr_values else 0.0
    summary = month_summary_for(db, operator_id=operator_id, ano=ano, mes=mes)

    plan = {
        "seguhou_total": len([t for t in stats_closed if t.seguiu_plano]),
        "seguhou_resultado": float(sum((money(t.valor_finaneiro) for t in stats_closed if t.seguiu_plano), ZERO)),
        "nao_seguhou_total": len([t for t in stats_closed if not t.seguiu_plano]),
        "nao_seguhou_resultado": float(sum((money(t.valor_finaneiro) for t in stats_closed if not t.seguiu_plano), ZERO)),
    }
    plan["taxa_seguimento"] = round(plan["seguhou_total"] / len(stats_closed) * 100, 1) if stats_closed else 0.0

    mindset_map: dict[str, dict] = {}
    for trade in stats_closed:
        key = trade.mindset or "NÃO DEFINIDO"
        entry = mindset_map.setdefault(key, {"chave": key, "total": 0, "ganhou": 0, "perdeu": 0, "resultado": 0.0})
        entry["total"] += 1
        entry["resultado"] = float(money(entry["resultado"]) + money(trade.valor_finaneiro))
        if trade.estado == "GANHOU":
            entry["ganhou"] += 1
        else:
            entry["perdeu"] += 1
    for entry in mindset_map.values():
        entry["resultado"] = round(entry["resultado"], 2)
    mindset_rows = sorted(mindset_map.values(), key=lambda e: e["resultado"])

    def group_by(attr: str) -> list[dict]:
        groups: dict[str, dict] = {}
        for trade in stats_closed:
            key = str(getattr(trade, attr))
            entry = groups.setdefault(key, {"chave": key, "total": 0, "ganhou": 0, "resultado": 0.0})
            entry["total"] += 1
            entry["resultado"] = float(money(entry["resultado"]) + money(trade.valor_finaneiro))
            if trade.estado == "GANHOU":
                entry["ganhou"] += 1
        for entry in groups.values():
            entry["taxa_acerto"] = round(entry["ganhou"] / entry["total"] * 100, 1) if entry["total"] else 0.0
            entry["resultado"] = round(entry["resultado"], 2)
        return sorted(groups.values(), key=lambda e: e["resultado"])

    dias_map: dict[str, dict] = {}
    for trade in trades:
        key = WEEKDAYS_PT[trade.data_operacao.weekday()]
        entry = dias_map.setdefault(key, {"chave": key, "total": 0, "perdeu": 0, "resultado": 0.0})
        entry["total"] += 1
        if trade.estado in ("GANHOU", "PERDEU") and trade in stats_closed:
            entry["resultado"] = float(money(entry["resultado"]) + money(trade.valor_finaneiro))
        if trade.estado == "PERDEU" and trade in stats_closed:
            entry["perdeu"] += 1
    for entry in dias_map.values():
        entry["resultado"] = round(entry["resultado"], 2)
    dias_rows = sorted(dias_map.values(), key=lambda e: WEEKDAYS_PT.index(e["chave"]))

    checklists = month_checklists(db, operator_id=operator_id, ano=ano, mes=mes)
    notas = [c.s05_nota for c in checklists if c.s05_nota is not None]
    nota_media = round(sum(notas) / len(notas), 1) if notas else 0.0
    itens = {
        "sem_bom_sono": len([c for c in checklists if not c.s01_sono]),
        "sem_estado_fisico": len([c for c in checklists if not c.s01_fisico]),
        "sem_estabilidade_emocional": len([c for c in checklists if not c.s01_emocional]),
        "sem_disposicao_plano": len([c for c in checklists if not c.s01_plano]),
        "sem_gestao_risco": len([c for c in checklists if not c.s01_gestao_risco]),
        "sem_pre_trading": len([c for c in checklists if not c.s02_pre_trading]),
        "sem_noticias": len([c for c in checklists if not c.s03_noticias]),
        "sem_360": len([c for c in checklists if not c.s03_360]),
        "sem_planilha": len([c for c in checklists if not c.s05_planilha]),
        "sem_gerenciamento": len([c for c in checklists if not c.s05_gerenciamento]),
        "sem_seguimento_plano": len([c for c in checklists if not c.s05_seguimento]),
    }

    observacoes = [
        {
            "id": t.id,
            "data_operacao": t.data_operacao.isoformat(),
            "ativo": t.ativo,
            "direcao": t.direcao,
            "estado": t.estado,
            "valor_finaneiro": float(money(t.valor_finaneiro)) if t.valor_finaneiro is not None else None,
            "seguiu_plano": t.seguiu_plano,
            "mindset": t.mindset,
            "observacoes": t.observacoes,
        }
        for t in trades
        if t.observacoes
    ]

    total_fechadas = len(closed)
    com_evidencia = len([t for t in closed if t.evidencias])
    aprovadas = len([t for t in closed if t.revisao_estado == TradeReviewStatus.APROVADA])
    inconsistentes = len([t for t in closed if t.revisao_estado == TradeReviewStatus.INCONSISTENTE])
    correcoes_pedidas = len([t for t in closed if t.revisao_estado == TradeReviewStatus.CORRECAO_PEDIDA])
    nao_revisadas = len([t for t in closed if t.revisao_estado == TradeReviewStatus.NAO_REVISADA])
    divergencias = len([t for t in closed if t.divergencia_plano])

    def pct(count: int) -> float:
        return round(count / total_fechadas * 100, 1) if total_fechadas else 0.0

    evidencia = {
        "total_fechadas": total_fechadas,
        "com_evidencia": com_evidencia,
        "sem_evidencia": total_fechadas - com_evidencia,
        "pct_com_evidencia": pct(com_evidencia),
        "aprovadas": aprovadas,
        "pct_aprovadas": pct(aprovadas),
        "inconsistentes": inconsistentes,
        "correcoes_pedidas": correcoes_pedidas,
        "nao_revisadas": nao_revisadas,
        "divergencias_plano": divergencias,
    }

    capturas: list[dict] = []
    if include_urls:
        for trade in closed:
            if trade.estado != "PERDEU" and trade.seguiu_plano:
                continue
            imagens = []
            for e in sorted(trade.evidencias, key=lambda e: e.uploaded_at):
                imagem = {"id": e.id, "tipo": e.tipo, "filename": e.filename, "url": evidence_url(e)}
                if include_files:
                    imagem["file_path"] = e.file_path
                imagens.append(imagem)
            capturas.append(
                {
                    "trade_id": trade.id,
                    "data_operacao": trade.data_operacao.isoformat(),
                    "ativo": trade.ativo,
                    "direcao": trade.direcao,
                    "estado": trade.estado,
                    "seguiu_plano": trade.seguiu_plano,
                    "divergencia_plano": trade.divergencia_plano,
                    "revisao_estado": trade.revisao_estado,
                    "valor_finaneiro": float(money(trade.valor_finaneiro)) if trade.valor_finaneiro is not None else None,
                    "sem_evidencia": not imagens,
                    "imagens": imagens,
                }
            )

    return {
        "operator_id": operator_id,
        "operator_nome": operator_nome,
        "ano": ano,
        "mes": mes,
        "resumo": {
            "total_operacoes": len(trades),
            "ganhou": len(won),
            "perdeu": len(lost),
            "pendente": len(pending),
            "em_andamento": len(running),
            "taxa_acerto": taxa,
            "resultado": float(resultado),
            "saldo_final": summary["saldo_final"],
            "risco_retorno_medio": rr_medio,
        },
        "plano": plan,
        "evidencia": evidencia,
        "capturas": capturas,
        "mindset": mindset_rows,
        "ativos": group_by("ativo"),
        "direcoes": group_by("direcao"),
        "dias_semana": dias_rows,
        "observacoes": observacoes,
        "execucao": {
            "nota_media": nota_media,
            "dias_com_checklist": len(checklists),
            "itens_nao_cumpridos": itens,
        },
    }


def dashboard_summary(db: Session, *, operator_id: int, ano: int, mes: int) -> dict:
    grouped = _trades_by_month(db, operator_id=operator_id)
    trades = grouped.get((ano, mes), [])
    closed = [t for t in trades if t.estado in ("GANHOU", "PERDEU")]
    won = [t for t in closed if t.estado == "GANHOU"]
    checklist = get_checklist(db, operator_id=operator_id, data_pregao=date.today())
    notas = [c.s05_nota for c in month_checklists(db, operator_id=operator_id, ano=ano, mes=mes) if c.s05_nota is not None]
    return {
        "ano": ano,
        "mes": mes,
        "operacoes_mes": len(trades),
        "pendentes": len([t for t in trades if t.estado == "PENDENTE"]),
        "em_andamento": len([t for t in trades if t.estado == "EM_ANDAMENTO"]),
        "taxa_acerto": round(len(won) / len(closed) * 100, 1) if closed else 0.0,
        "resultado": float(sum((money(t.valor_finaneiro) for t in closed), ZERO)),
        "taxa_seguimento": round(len([t for t in closed if t.seguiu_plano]) / len(closed) * 100, 1) if closed else 0.0,
        "nota_media": round(sum(notas) / len(notas), 1) if notas else 0.0,
        "checklist_hoje": {
            "data_pregao": date.today().isoformat(),
            "existe": checklist is not None,
            "precheck_concluido": checklist.precheck_concluido if checklist else False,
            "fechado": checklist.fechado if checklist else False,
        },
    }
