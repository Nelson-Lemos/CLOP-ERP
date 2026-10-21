from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Form, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.audit import AuditAction
from app.models.trading import TradeEvidenceType, TradeReviewStatus, TradingEvidence, TradingTrade
from app.models.user import User, UserRole
from app.schemas.trading import (
    AccountOut,
    AccountSave,
    ChecklistOut,
    ChecklistSave,
    ChecklistStatusOut,
    EvidenceOut,
    EvolutionOut,
    MethodOut,
    MonthOut,
    MonthUpdate,
    ReviewDecisionInput,
    ReviewOut,
    ReviewQueueOut,
    ReviewResponseInput,
    TradeCreate,
    TradeOut,
    TradeUpdate,
)
from app.services import trading_report_service as trs
from app.services import trading_service as ts
from app.services.audit_service import record_audit

router = APIRouter(prefix="/trading", tags=["trading"])


def _operator_or_404(db: Session, operator_id: int) -> User:
    operator = db.get(User, operator_id)
    if operator is None or operator.estado != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operador não encontrado")
    return operator


def _resolve(db: Session, actor: User, operator_id: int | None) -> User:
    try:
        target_id = ts.resolve_operator_id(actor, operator_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return _operator_or_404(db, target_id)


def _assert_can_write(actor: User, operator_id: int) -> None:
    if actor.id != operator_id and not UserRole.is_admin(actor.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para alterar registos de outro operador")


def _trade_or_404(db: Session, trade_id: int) -> TradingTrade:
    trade = db.get(TradingTrade, trade_id)
    if trade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operação não encontrada")
    return trade


def _assert_can_view_trade(actor: User, trade: TradingTrade) -> None:
    if actor.id != trade.operator_id and not ts.can_view_all(actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para ver registos de outro operador")


def _assert_can_review(actor: User) -> None:
    if not ts.can_review_trades(actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para rever operações")


def _evidence_dict(evidence: TradingEvidence) -> dict:
    data = EvidenceOut.model_validate(evidence).model_dump()
    data["uploader_nome"] = evidence.user.nome_completo if evidence.user else None
    data["url"] = ts.evidence_url(evidence)
    return data


def _evidence_out(evidence: TradingEvidence) -> EvidenceOut:
    return EvidenceOut(**_evidence_dict(evidence))


def _evidence_file_or_404(evidence: TradingEvidence):
    path = Path(evidence.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ficheiro da evidência não encontrado")
    return FileResponse(
        path,
        media_type=evidence.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{evidence.filename}"'},
    )


def _checklist_out(checklist) -> ChecklistOut:
    data = ChecklistOut.model_validate(checklist).model_dump()
    data["operator_nome"] = checklist.operator.nome_completo if checklist.operator else None
    return ChecklistOut(**data)


def _trade_out(trade: TradingTrade) -> TradeOut:
    data = TradeOut.model_validate(trade).model_dump()
    data["operator_nome"] = trade.operator.nome_completo if trade.operator else None
    if trade.method is not None:
        data["method"] = MethodOut.model_validate(trade.method).model_dump()
    data["revisao_por_nome"] = trade.revisor.nome_completo if trade.revisor else None
    data["evidencias"] = [_evidence_dict(e) for e in sorted(trade.evidencias, key=lambda e: e.uploaded_at)]
    revisoes = []
    for review in sorted(trade.revisoes, key=lambda r: r.created_at):
        item = ReviewOut.model_validate(review).model_dump()
        item["user_nome"] = review.user.nome_completo if review.user else None
        revisoes.append(item)
    data["revisoes"] = revisoes
    tipos = {e.tipo for e in trade.evidencias}
    data["tem_evidencia_entrada"] = TradeEvidenceType.ENTRADA in tipos
    data["tem_evidencia_fecho"] = TradeEvidenceType.FECHO in tipos
    return TradeOut(**data)


def _account_out(account) -> AccountOut:
    data = AccountOut.model_validate(account).model_dump()
    data["operator_nome"] = account.operator.nome_completo if account.operator else None
    return AccountOut(**data)


def _handle_errors(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _parse_date(value: str, detail: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


@router.get("/checklists/status", response_model=ChecklistStatusOut)
def checklist_status(
    data_pregao: str | None = None,
    operator_id: int | None = None,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    operator = _resolve(db, current_user, operator_id)
    target = _parse_date(data_pregao, "Data inválida (use AAAA-MM-DD)") if data_pregao else date.today()
    checklist = ts.get_checklist(db, operator_id=operator.id, data_pregao=target)
    return ChecklistStatusOut(
        data_pregao=target,
        existe=checklist is not None,
        precheck_concluido=checklist.precheck_concluido if checklist else False,
        fechado=checklist.fechado if checklist else False,
    )


@router.get("/checklists", response_model=list[ChecklistOut])
def list_checklists(
    operator_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    operator = _resolve(db, current_user, operator_id)
    items = ts.list_checklists(db, operator_id=operator.id, data_inicio=data_inicio, data_fim=data_fim)
    return [_checklist_out(item) for item in items]


@router.get("/checklists/{data_pregao}", response_model=ChecklistOut)
def get_checklist(
    data_pregao: str,
    operator_id: int | None = None,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    operator = _resolve(db, current_user, operator_id)
    target = _parse_date(data_pregao, "Data inválida (use AAAA-MM-DD)")
    checklist = ts.get_checklist(db, operator_id=operator.id, data_pregao=target)
    if checklist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist do dia ainda não foi iniciado")
    return _checklist_out(checklist)


@router.put("/checklists/{data_pregao}", response_model=ChecklistOut)
def save_checklist(
    data_pregao: str,
    payload: ChecklistSave,
    request: Request,
    operator_id: int | None = None,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    operator = _resolve(db, current_user, operator_id)
    target = _parse_date(data_pregao, "Data inválida (use AAAA-MM-DD)")
    _assert_can_write(current_user, operator.id)
    checklist = ts.get_checklist(db, operator_id=operator.id, data_pregao=target)
    closed = checklist.fechado if checklist else False
    if closed and not UserRole.is_admin(current_user.role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="O dia já foi fechado; somente leitura")
    checklist = _handle_errors(
        ts.save_checklist, db, operator_id=operator.id, data_pregao=target, payload=payload, allow_closed=True
    )
    record_audit(db, user_id=current_user.id, action="SAVE_CHECKLIST", entity="trading_checklist", entity_id=checklist.id, request=request)
    db.commit()
    return _checklist_out(checklist)


@router.post("/checklists/{data_pregao}/close", response_model=ChecklistOut)
def close_checklist(data_pregao: str, request: Request, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    target = _parse_date(data_pregao, "Data inválida (use AAAA-MM-DD)")
    _assert_can_write(current_user, operator.id)
    checklist = _handle_errors(ts.close_checklist, db, operator_id=operator.id, data_pregao=target)
    record_audit(db, user_id=current_user.id, action="CLOSE_CHECKLIST", entity="trading_checklist", entity_id=checklist.id, request=request)
    db.commit()
    return _checklist_out(checklist)


@router.post("/checklists/{data_pregao}/reopen", response_model=ChecklistOut)
def reopen_checklist(data_pregao: str, request: Request, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    if not ts.can_view_all(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    operator = _resolve(db, current_user, operator_id)
    target = _parse_date(data_pregao, "Data inválida (use AAAA-MM-DD)")
    checklist = _handle_errors(ts.reopen_checklist, db, operator_id=operator.id, data_pregao=target)
    record_audit(db, user_id=current_user.id, action="REOPEN_CHECKLIST", entity="trading_checklist", entity_id=checklist.id, request=request)
    db.commit()
    return _checklist_out(checklist)


@router.get("/trades", response_model=list[TradeOut])
def list_trades(
    operator_id: int | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    operator = _resolve(db, current_user, operator_id)
    query = db.query(TradingTrade).filter(TradingTrade.operator_id == operator.id)
    if data_inicio:
        query = query.filter(TradingTrade.data_operacao >= data_inicio)
    if data_fim:
        query = query.filter(TradingTrade.data_operacao <= data_fim)
    trades = query.order_by(TradingTrade.data_operacao.desc(), TradingTrade.id.desc()).all()
    return [_trade_out(trade) for trade in trades]


@router.post("/trades", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
def create_trade(payload: TradeCreate, request: Request, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    _assert_can_write(current_user, operator.id)
    trade = _handle_errors(
        ts.create_trade,
        db,
        actor=current_user,
        operator_id=operator.id,
        data_operacao=payload.data_operacao,
        ativo=payload.ativo,
        direcao=payload.direcao,
        estado=payload.estado,
        preco_entrada=payload.preco_entrada,
        preco_stop=payload.preco_stop,
        preco_alvo=payload.preco_alvo,
        preco_saida=payload.preco_saida,
        hora_entrada=payload.hora_entrada,
        hora_saida=payload.hora_saida,
        tamanho_lote=payload.tamanho_lote,
        valor_finaneiro=payload.valor_finaneiro,
        risco_retorno=payload.risco_retorno,
        seguiu_plano=payload.seguiu_plano,
        mindset=payload.mindset,
        observacoes=payload.observacoes,
        method=payload.method,
    )
    record_audit(db, user_id=current_user.id, action="CREATE_TRADE", entity="trading_trade", entity_id=trade.id, request=request)
    db.commit()
    return _trade_out(trade)


@router.put("/trades/{trade_id}", response_model=TradeOut)
def update_trade(trade_id: int, payload: TradeUpdate, request: Request, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    trade = _trade_or_404(db, trade_id)
    _assert_can_write(current_user, trade.operator_id)
    trade = _handle_errors(
        ts.update_trade,
        db,
        trade=trade,
        data_operacao=payload.data_operacao,
        ativo=payload.ativo,
        direcao=payload.direcao,
        estado=payload.estado,
        preco_entrada=payload.preco_entrada,
        preco_stop=payload.preco_stop,
        preco_alvo=payload.preco_alvo,
        preco_saida=payload.preco_saida,
        hora_entrada=payload.hora_entrada,
        hora_saida=payload.hora_saida,
        tamanho_lote=payload.tamanho_lote,
        valor_finaneiro=payload.valor_finaneiro,
        risco_retorno=payload.risco_retorno,
        seguiu_plano=payload.seguiu_plano,
        mindset=payload.mindset,
        observacoes=payload.observacoes,
        method=payload.method,
    )
    record_audit(db, user_id=current_user.id, action="UPDATE_TRADE", entity="trading_trade", entity_id=trade.id, request=request)
    db.commit()
    return _trade_out(trade)


@router.delete("/trades/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: int, request: Request, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    trade = _trade_or_404(db, trade_id)
    _assert_can_write(current_user, trade.operator_id)
    record_audit(db, user_id=current_user.id, action="DELETE_TRADE", entity="trading_trade", entity_id=trade.id, request=request)
    ts.delete_trade(db, trade=trade)
    return None


@router.post("/trades/{trade_id}/evidences", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    trade_id: int,
    request: Request,
    tipo: str = Form(...),
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    trade = _trade_or_404(db, trade_id)
    _assert_can_write(current_user, trade.operator_id)

    normalized_tipo = (tipo or "").strip().upper()
    if normalized_tipo not in TradeEvidenceType.all():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de evidência inválido (use ENTRADA, GESTAO ou FECHO)",
        )

    filename = file.filename or "evidencia"
    suffix = Path(filename).suffix.lower()
    if suffix not in ts.ALLOWED_EVIDENCE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Formato não permitido (use PNG, JPG ou WEBP)")

    content_type = file.content_type or ""
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O ficheiro deve ser uma imagem")

    content = await file.read()
    max_bytes = settings.TRADE_EVIDENCE_MAX_MB * 1024 * 1024
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ficheiro vazio")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Imagem demasiado grande (máximo {settings.TRADE_EVIDENCE_MAX_MB} MB)",
        )

    evidence = ts.add_evidence(
        db,
        trade=trade,
        user=current_user,
        tipo=normalized_tipo,
        filename=filename,
        content_type=content_type or "application/octet-stream",
        content=content,
    )
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.UPLOAD_TRADE_EVIDENCE,
        entity="trading_evidence",
        entity_id=evidence.id,
        request=request,
    )
    db.commit()
    return _evidence_out(evidence)


@router.get("/trades/{trade_id}/evidences", response_model=list[EvidenceOut])
def list_evidences(trade_id: int, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    trade = _trade_or_404(db, trade_id)
    _assert_can_view_trade(current_user, trade)
    return [_evidence_out(e) for e in sorted(trade.evidencias, key=lambda e: e.uploaded_at)]


@router.get("/evidences/{evidence_id}/file")
def evidence_file(evidence_id: int, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    evidence = db.get(TradingEvidence, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidência não encontrada")
    trade = _trade_or_404(db, evidence.trade_id)
    _assert_can_view_trade(current_user, trade)
    return _evidence_file_or_404(evidence)


@router.get("/review-queue", response_model=ReviewQueueOut)
def review_queue(
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
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    _assert_can_review(current_user)
    limit = max(1, min(limit, 200))
    offset = max(offset, 0)
    data = _handle_errors(
        ts.review_queue,
        db,
        operator_id=operator_id,
        data_inicio=data_inicio,
        data_fim=data_fim,
        ativo=ativo,
        revisao_estado=revisao_estado,
        resultado=resultado,
        seguiu_plano=seguiu_plano,
        divergencia=divergencia,
        sem_evidencia=sem_evidencia,
        limit=limit,
        offset=offset,
    )
    return ReviewQueueOut(
        total=data["total"],
        limit=limit,
        offset=offset,
        items=[_trade_out(trade) for trade in data["items"]],
    )


@router.post("/trades/{trade_id}/review", response_model=TradeOut)
def review_trade(
    trade_id: int,
    payload: ReviewDecisionInput,
    request: Request,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    _assert_can_review(current_user)
    trade = _trade_or_404(db, trade_id)
    trade = _handle_errors(
        ts.review_trade,
        db,
        trade=trade,
        reviewer=current_user,
        decision=payload.decision,
        comentario=payload.comentario,
        divergencia_plano=payload.divergencia_plano,
    )
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.REVIEW_TRADE,
        entity="trading_trade",
        entity_id=trade.id,
        request=request,
    )
    db.commit()
    return _trade_out(trade)


@router.post("/trades/{trade_id}/review/respond", response_model=TradeOut)
def respond_review(
    trade_id: int,
    payload: ReviewResponseInput,
    request: Request,
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    trade = _trade_or_404(db, trade_id)
    _assert_can_write(current_user, trade.operator_id)
    trade = _handle_errors(
        ts.respond_review, db, trade=trade, operator=current_user, comentario=payload.comentario
    )
    record_audit(
        db,
        user_id=current_user.id,
        action=AuditAction.TRADE_REVIEW_RESPONSE,
        entity="trading_trade",
        entity_id=trade.id,
        request=request,
    )
    db.commit()
    return _trade_out(trade)


@router.get("/account", response_model=AccountOut | None)
def get_account(operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    account = ts.get_account(db, operator_id=operator.id)
    return _account_out(account) if account else None


@router.put("/account", response_model=AccountOut)
def save_account(payload: AccountSave, request: Request, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    _assert_can_write(current_user, operator.id)
    account = ts.save_account(db, operator_id=operator.id, data_abertura=payload.data_abertura, saldo_inicial=payload.saldo_inicial)
    record_audit(db, user_id=current_user.id, action="UPDATE_TRADING_ACCOUNT", entity="trading_account", entity_id=account.id, request=request)
    db.commit()
    return _account_out(account)


@router.get("/evolution", response_model=EvolutionOut)
def evolution(operator_id: int | None = None, ano: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    year = ano or date.today().year
    data = _handle_errors(ts.list_month_summaries, db, operator_id=operator.id, ano=year, operator_nome=operator.nome_completo)
    data["operator_id"] = operator.id
    return EvolutionOut(**data)


@router.get("/evolution/csv")
def evolution_csv(operator_id: int | None = None, ano: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    year = ano or date.today().year
    data = _handle_errors(ts.list_month_summaries, db, operator_id=operator.id, ano=year, operator_nome=operator.nome_completo)
    content = trs.evolution_csv(ano=year, meses=[MonthOut(**m) for m in data["meses"]], total=MonthOut(**data["total"]))
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="evolucao_conta_{year}_{operator.id}.csv"'},
    )


@router.get("/months/{ano}/{mes}", response_model=MonthOut)
def get_month(mes: int, ano: int, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    if not 1 <= mes <= 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mês inválido")
    return _handle_errors(ts.month_summary_for, db, operator_id=operator.id, ano=ano, mes=mes)


@router.put("/months/{ano}/{mes}", response_model=MonthOut)
def save_month(mes: int, ano: int, payload: MonthUpdate, request: Request, operator_id: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    _assert_can_write(current_user, operator.id)
    row = _handle_errors(
        ts.save_month_movements, db, operator_id=operator.id, ano=ano, mes=mes,
        depositos=payload.depositos, saques=payload.saques, bonus=payload.bonus,
    )
    record_audit(db, user_id=current_user.id, action="UPDATE_TRADING_MONTH", entity="trading_month", entity_id=row.id, request=request)
    db.commit()
    return _handle_errors(ts.month_summary_for, db, operator_id=operator.id, ano=ano, mes=mes)


@router.get("/monthly-report")
def monthly_report(operator_id: int | None = None, ano: int | None = None, mes: int | None = None, apenas_validadas: bool = False, incluir_evidencias: bool = False, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    today = date.today()
    year = ano or today.year
    month = mes or today.month
    if not 1 <= month <= 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mês inválido")
    return ts.monthly_report(
        db,
        operator_id=operator.id,
        operator_nome=operator.nome_completo,
        ano=year,
        mes=month,
        apenas_validadas=apenas_validadas,
        include_urls=incluir_evidencias,
    )


@router.get("/monthly-report/csv")
def monthly_report_csv(operator_id: int | None = None, ano: int | None = None, mes: int | None = None, apenas_validadas: bool = False, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    today = date.today()
    year = ano or today.year
    month = mes or today.month
    trades = (
        db.query(TradingTrade)
        .filter(
            TradingTrade.operator_id == operator.id,
            TradingTrade.data_operacao >= date(year, month, 1),
            TradingTrade.data_operacao <= date(year, month, 28),
        )
        .order_by(TradingTrade.data_operacao.asc())
        .all()
    )
    trades = [t for t in trades if t.data_operacao.month == month]
    if apenas_validadas:
        trades = [t for t in trades if t.revisao_estado == TradeReviewStatus.APROVADA]
    content = trs.trades_csv(trades, operator_nome=operator.nome_completo)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="operacoes_{year}_{month:02d}_{operator.id}.csv"'},
    )


@router.get("/monthly-report/pdf")
def monthly_report_pdf(operator_id: int | None = None, ano: int | None = None, mes: int | None = None, apenas_validadas: bool = False, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    today = date.today()
    year = ano or today.year
    month = mes or today.month
    report = ts.monthly_report(
        db,
        operator_id=operator.id,
        operator_nome=operator.nome_completo,
        ano=year,
        mes=month,
        apenas_validadas=apenas_validadas,
        include_urls=True,
        include_files=True,
    )
    pdf = trs.render_monthly_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="relatorio_trading_{year}_{month:02d}_{operator.id}.pdf"'},
    )


@router.get("/summary")
def summary(operator_id: int | None = None, ano: int | None = None, mes: int | None = None, current_user: CurrentUser = None, db: Session = Depends(get_db)):
    operator = _resolve(db, current_user, operator_id)
    today = date.today()
    return ts.dashboard_summary(db, operator_id=operator.id, ano=ano or today.year, mes=mes or today.month)
