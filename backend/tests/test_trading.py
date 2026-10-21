import hashlib
import os
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.trading import (
    TradingAccount,
    TradingChecklist,
    TradingEvidence,
    TradingMethod,
    TradingMonth,
    TradingReview,
    TradingTrade,
)
from app.models.user import UserRole
from tests.conftest import auth, client, create_user, delete_user, login

PRECHECK_PAYLOAD = {
    "s01_sono": True,
    "s01_fisico": True,
    "s01_emocional": True,
    "s01_plano": True,
    "s01_gestao_risco": True,
    "s02_pre_trading": True,
    "s02_atividade": "Revisão de gráficos e notícias",
    "s03_noticias": True,
    "s03_360": True,
    "s03_ativos": "EURUSD,BTCUSD",
}

PRICES_COMPRA = {"preco_entrada": 1.1, "preco_stop": 1.095, "preco_alvo": 1.11}
PRICES_VENDA = {"preco_entrada": 1.1, "preco_stop": 1.105, "preco_alvo": 1.09}


def png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 6), (198, 40, 40)).save(buffer, format="PNG")
    return buffer.getvalue()


def cleanup_trading(db, operator_ids: list[int]) -> None:
    for oid in operator_ids:
        trades = db.query(TradingTrade).filter(TradingTrade.operator_id == oid).all()
        for trade in trades:
            for evidence in list(trade.evidencias):
                try:
                    path = Path(evidence.file_path)
                    if path.exists():
                        path.unlink()
                except OSError:
                    pass
            db.query(TradingEvidence).filter(TradingEvidence.trade_id == trade.id).delete()
            db.query(TradingReview).filter(TradingReview.trade_id == trade.id).delete()
            db.query(TradingMethod).filter(TradingMethod.trade_id == trade.id).delete()
        db.query(TradingTrade).filter(TradingTrade.operator_id == oid).delete()
        db.query(TradingChecklist).filter(TradingChecklist.operator_id == oid).delete()
        db.query(TradingMonth).filter(TradingMonth.operator_id == oid).delete()
        db.query(TradingAccount).filter(TradingAccount.operator_id == oid).delete()
    db.commit()


def _save_precheck(token: str, day: str) -> None:
    response = client.put(f"/api/trading/checklists/{day}", json=PRECHECK_PAYLOAD, headers=auth(token))
    assert response.status_code == 200, response.text


def _create_trade(token: str, payload: dict):
    return client.post("/api/trading/trades", json=payload, headers=auth(token))


def _put_trade(token: str, trade_id: int, payload: dict):
    return client.put(f"/api/trading/trades/{trade_id}", json=payload, headers=auth(token))


def _open_trade(token: str, base: dict, **extra) -> int:
    response = _create_trade(token, {**base, "estado": "PENDENTE", **extra})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload_evidence(token: str, trade_id: int, tipo: str, content: bytes | None = None, filename: str = "captura.png"):
    return client.post(
        f"/api/trading/trades/{trade_id}/evidences",
        data={"tipo": tipo},
        files={"file": (filename, content if content is not None else png_bytes(), "image/png")},
        headers=auth(token),
    )


def _closed_trade(token: str, base: dict, *, estado: str, valor: float, preco_saida: float, **extra) -> int:
    trade_id = _open_trade(token, base, **extra)
    assert _upload_evidence(token, trade_id, "ENTRADA").status_code == 201
    assert _upload_evidence(token, trade_id, "FECHO").status_code == 201
    response = _put_trade(token, trade_id, {"estado": estado, "valor_finaneiro": valor, "preco_saida": preco_saida})
    assert response.status_code == 200, response.text
    return trade_id


def test_trade_blocked_without_precheck() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_precheck@teste.clop", nome_completo="Oper Precheck")
    try:
        token = login("oper_precheck@teste.clop")
        payload = {
            "data_operacao": "2026-07-10",
            "ativo": "EURUSD",
            "direcao": "COMPRA",
            "estado": "PENDENTE",
            **PRICES_COMPRA,
        }

        response = _create_trade(token, payload)
        assert response.status_code == 400

        partial = {"s01_sono": True, "s01_fisico": True}
        response = client.put("/api/trading/checklists/2026-07-10", json=partial, headers=auth(token))
        assert response.status_code == 200
        assert response.json()["precheck_concluido"] is False
        response = _create_trade(token, payload)
        assert response.status_code == 400

        _save_precheck(token, "2026-07-10")

        response = _create_trade(token, {k: v for k, v in payload.items() if k not in PRICES_COMPRA})
        assert response.status_code == 400
        assert "preço" in response.json()["detail"]

        response = _create_trade(token, payload)
        assert response.status_code == 201, response.text
        assert response.json()["risco_retorno"] == 2.0
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_trade_requires_prices_and_direction_coherence() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_precos@teste.clop", nome_completo="Oper Precos")
    try:
        token = login("oper_precos@teste.clop")
        _save_precheck(token, "2026-07-16")
        base = {"data_operacao": "2026-07-16", "ativo": "EURUSD", "direcao": "COMPRA", "estado": "PENDENTE"}

        response = _create_trade(token, base)
        assert response.status_code == 400
        assert "stop" in response.json()["detail"] and "alvo" in response.json()["detail"]

        response = _create_trade(token, {**base, **PRICES_COMPRA, "preco_stop": 1.12})
        assert response.status_code == 400
        assert "COMPRA" in response.json()["detail"]

        response = _create_trade(token, {**base, **PRICES_COMPRA, "preco_alvo": 1.09})
        assert response.status_code == 400

        response = _create_trade(token, {**base, **PRICES_COMPRA, "preco_stop": 1.1})
        assert response.status_code == 400
        assert "igual" in response.json()["detail"]

        response = _create_trade(token, {**base, "direcao": "VENDA", **PRICES_VENDA, "preco_stop": 1.095})
        assert response.status_code == 400
        assert "VENDA" in response.json()["detail"]

        response = _create_trade(token, {**base, "direcao": "VENDA", **PRICES_VENDA, "preco_alvo": 1.12})
        assert response.status_code == 400

        response = _create_trade(token, {**base, **PRICES_COMPRA, "preco_entrada": 0})
        assert response.status_code == 422

        response = _create_trade(token, {**base, **PRICES_COMPRA})
        assert response.status_code == 201, response.text
        assert response.json()["risco_retorno"] == 2.0
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_trade_value_validation() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_valor@teste.clop", nome_completo="Oper Valor")
    try:
        token = login("oper_valor@teste.clop")
        _save_precheck(token, "2026-07-11")
        base = {"data_operacao": "2026-07-11", "ativo": "BTCUSD", "direcao": "VENDA", **PRICES_VENDA}

        response = _create_trade(token, {**base, "estado": "PENDENTE", "valor_finaneiro": 50})
        assert response.status_code == 400

        response = _create_trade(token, {**base, "estado": "GANHOU", "valor_finaneiro": 100, "preco_saida": 1.09})
        assert response.status_code == 400
        assert "captura" in response.json()["detail"]

        trade_id = _open_trade(token, base)
        assert _upload_evidence(token, trade_id, "ENTRADA").status_code == 201
        assert _upload_evidence(token, trade_id, "FECHO").status_code == 201

        response = _put_trade(token, trade_id, {"estado": "GANHOU", "valor_finaneiro": -100, "preco_saida": 1.09})
        assert response.status_code == 400

        response = _put_trade(token, trade_id, {"estado": "PERDEU", "valor_finaneiro": 100, "preco_saida": 1.09})
        assert response.status_code == 400

        response = _put_trade(
            token, trade_id, {"estado": "PERDEU", "valor_finaneiro": -100, "preco_saida": 1.09, "mindset": "ANSIOSO"}
        )
        assert response.status_code == 200, response.text
        assert response.json()["valor_finaneiro"] == -100.0
        assert response.json()["mindset"] == "ANSIOSO"

        response = _put_trade(token, trade_id, {"mindset": "INVENTADO"})
        assert response.status_code == 400
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_account_balance_inheritance_and_win_rate() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_saldo@teste.clop", nome_completo="Oper Saldo")
    try:
        token = login("oper_saldo@teste.clop")
        response = client.put(
            "/api/trading/account",
            json={"data_abertura": "2026-07-01", "saldo_inicial": 1000},
            headers=auth(token),
        )
        assert response.status_code == 200, response.text

        _save_precheck(token, "2026-07-10")
        base = {"data_operacao": "2026-07-10", "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        _closed_trade(token, base, estado="GANHOU", valor=200, preco_saida=1.11)
        _closed_trade(token, base, estado="PERDEU", valor=-50, preco_saida=1.09)
        assert _open_trade(token, base) is not None

        response = client.put(
            "/api/trading/months/2026/7",
            json={"depositos": 100, "saques": 20, "bonus": 5},
            headers=auth(token),
        )
        assert response.status_code == 200, response.text

        response = client.get("/api/trading/evolution?ano=2026", headers=auth(token))
        assert response.status_code == 200
        data = response.json()
        july = data["meses"][6]
        assert july["saldo_inicial"] == 1000.0
        assert july["resultado"] == 150.0
        assert july["saldo_final"] == 1235.0
        assert july["ganhou"] == 1
        assert july["perdeu"] == 1
        assert july["taxa_acerto"] == 50.0

        august = data["meses"][7]
        assert august["saldo_inicial"] == 1235.0

        assert data["total"]["resultado"] == 150.0
        assert data["total"]["saldo_final"] == 1235.0

        response = client.get("/api/trading/months/2026/8", headers=auth(token))
        assert response.status_code == 200
        assert response.json()["saldo_inicial"] == 1235.0
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_trade_state_transition_recalculates() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_estado@teste.clop", nome_completo="Oper Estado")
    try:
        token = login("oper_estado@teste.clop")
        _save_precheck(token, "2026-07-12")
        base = {"data_operacao": "2026-07-12", "ativo": "XAUUSD", "direcao": "VENDA", **PRICES_VENDA}
        trade_id = _open_trade(token, base)

        response = _put_trade(token, trade_id, {"estado": "EM_ANDAMENTO"})
        assert response.status_code == 400
        assert "captura de entrada" in response.json()["detail"]

        assert _upload_evidence(token, trade_id, "ENTRADA").status_code == 201
        response = _put_trade(token, trade_id, {"estado": "EM_ANDAMENTO"})
        assert response.status_code == 200
        assert response.json()["estado"] == "EM_ANDAMENTO"
        assert response.json()["tem_evidencia_entrada"] is True

        response = _put_trade(token, trade_id, {"estado": "GANHOU", "valor_finaneiro": 80})
        assert response.status_code == 400
        assert "fecho" in response.json()["detail"]

        assert _upload_evidence(token, trade_id, "FECHO").status_code == 201
        response = _put_trade(token, trade_id, {"estado": "GANHOU", "valor_finaneiro": 80})
        assert response.status_code == 400
        assert "saída" in response.json()["detail"]

        response = _put_trade(token, trade_id, {"estado": "GANHOU", "valor_finaneiro": 80, "preco_saida": 1.095})
        assert response.status_code == 200, response.text
        assert response.json()["valor_finaneiro"] == 80.0

        response = client.get("/api/trading/months/2026/7", headers=auth(token))
        assert response.json()["resultado"] == 80.0
        assert response.json()["taxa_acerto"] == 100.0

        response = _put_trade(token, trade_id, {"estado": "PERDEU"})
        assert response.status_code == 200
        assert response.json()["valor_finaneiro"] == -80.0

        response = client.get("/api/trading/months/2026/7", headers=auth(token))
        assert response.json()["resultado"] == -80.0
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_closed_day_is_readonly_and_admin_can_reopen() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_fecho@teste.clop", nome_completo="Oper Fecho")
    ceo_token = login("ceo_teste@teste.clop")
    try:
        token = login("oper_fecho@teste.clop")
        _save_precheck(token, "2026-07-13")
        response = client.post("/api/trading/checklists/2026-07-13/close", headers=auth(token))
        assert response.status_code == 200
        assert response.json()["fechado"] is True

        payload = dict(PRECHECK_PAYLOAD, s05_planilha=True)
        response = client.put("/api/trading/checklists/2026-07-13", json=payload, headers=auth(token))
        assert response.status_code == 403

        response = client.post("/api/trading/checklists/2026-07-13/reopen", headers=auth(token))
        assert response.status_code == 403

        response = client.post(f"/api/trading/checklists/2026-07-13/reopen?operator_id={operator.id}", headers=auth(ceo_token))
        assert response.status_code == 200

        response = client.put("/api/trading/checklists/2026-07-13", json=payload, headers=auth(token))
        assert response.status_code == 200
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_trading_permissions() -> None:
    db = SessionLocal()
    operator_a = create_user(db, email="oper_a@teste.clop", nome_completo="Oper A")
    operator_b = create_user(db, email="oper_b@teste.clop", nome_completo="Oper B")
    manager = create_user(db, email="gestor_trading@teste.clop", nome_completo="Gestor Trading", role=UserRole.MANAGER)
    leader = create_user(db, email="lider_trading@teste.clop", nome_completo="Lider Trading", role=UserRole.TRADING_LEADER)
    try:
        token_a = login("oper_a@teste.clop")
        token_b = login("oper_b@teste.clop")
        token_manager = login("gestor_trading@teste.clop")
        token_leader = login("lider_trading@teste.clop")
        ceo_token = login("ceo_teste@teste.clop")
        _save_precheck(token_a, "2026-07-14")
        base = {"data_operacao": "2026-07-14", "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        trade_id = _closed_trade(token_a, base, estado="GANHOU", valor=10, preco_saida=1.11)

        response = client.get(f"/api/trading/trades?operator_id={operator_a.id}", headers=auth(token_b))
        assert response.status_code == 403

        response = client.get(f"/api/trading/trades/{trade_id}/evidences", headers=auth(token_b))
        assert response.status_code == 403

        response = _upload_evidence(token_b, trade_id, "ENTRADA")
        assert response.status_code == 403

        response = _put_trade(token_b, trade_id, {"estado": "PERDEU", "valor_finaneiro": -10})
        assert response.status_code == 403

        response = client.put(
            f"/api/trading/checklists/2026-07-14?operator_id={operator_a.id}",
            json=PRECHECK_PAYLOAD,
            headers=auth(token_b),
        )
        assert response.status_code == 403

        response = client.put(
            f"/api/trading/account?operator_id={operator_a.id}",
            json={"data_abertura": "2026-07-01", "saldo_inicial": 500},
            headers=auth(token_b),
        )
        assert response.status_code == 403

        for token in (token_manager, token_leader, ceo_token):
            response = client.get(f"/api/trading/trades?operator_id={operator_a.id}", headers=auth(token))
            assert response.status_code == 200
            assert len(response.json()) == 1

            response = client.get(f"/api/trading/trades/{trade_id}/evidences", headers=auth(token))
            assert response.status_code == 200
            assert len(response.json()) == 2
            assert response.json()[0]["uploader_nome"] == "Oper A"
            assert response.json()[0]["url"].startswith("/api/trading/evidences/")

        response = client.get("/api/trading/trades", headers=auth(token_b))
        assert response.status_code == 200
        assert response.json() == []

        response = client.get("/api/trading/review-queue", headers=auth(token_b))
        assert response.status_code == 403

        for token in (token_manager, token_leader, ceo_token):
            response = client.get(f"/api/trading/review-queue?operator_id={operator_a.id}", headers=auth(token))
            assert response.status_code == 200

        response = client.get("/api/trading/evolution?ano=2026", headers=auth(ceo_token))
        assert response.status_code == 200
    finally:
        cleanup_trading(db, [operator_a.id, operator_b.id, manager.id, leader.id])
        delete_user(db, operator_a.id)
        delete_user(db, operator_b.id)
        delete_user(db, manager.id)
        delete_user(db, leader.id)
        db.close()


def test_evidence_upload_validation() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_evidencias@teste.clop", nome_completo="Oper Evidencias")
    try:
        token = login("oper_evidencias@teste.clop")
        today = date.today().isoformat()
        _save_precheck(token, today)
        trade_id = _open_trade(token, {"data_operacao": today, "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA})

        response = _upload_evidence(token, trade_id, "SAIDA")
        assert response.status_code == 400
        assert "Tipo" in response.json()["detail"]

        response = _upload_evidence(token, trade_id, "ENTRADA", filename="captura.gif")
        assert response.status_code == 400
        assert "Formato" in response.json()["detail"]

        response = client.post(
            f"/api/trading/trades/{trade_id}/evidences",
            data={"tipo": "ENTRADA"},
            files={"file": ("notas.txt", b"apenas texto", "text/plain")},
            headers=auth(token),
        )
        assert response.status_code == 400

        response = client.post(
            f"/api/trading/trades/{trade_id}/evidences",
            data={"tipo": "ENTRADA"},
            files={"file": ("vazio.png", b"", "image/png")},
            headers=auth(token),
        )
        assert response.status_code == 400

        oversized = b"\x89PNG\r\n\x1a\n" + b"x" * (settings.TRADE_EVIDENCE_MAX_MB * 1024 * 1024 + 1)
        response = client.post(
            f"/api/trading/trades/{trade_id}/evidences",
            data={"tipo": "ENTRADA"},
            files={"file": ("grande.png", oversized, "image/png")},
            headers=auth(token),
        )
        assert response.status_code == 413
        assert str(settings.TRADE_EVIDENCE_MAX_MB) in response.json()["detail"]

        content = png_bytes()
        response = _upload_evidence(token, trade_id, "ENTRADA", content=content)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["sha256"] == hashlib.sha256(content).hexdigest()
        assert body["size"] == len(content)
        assert body["tipo"] == "ENTRADA"
        assert body["alerta_hash_duplicado"] is False
        assert body["alerta_upload_tardio"] is False

        file_response = client.get(f"/api/trading/evidences/{body['id']}/file", headers=auth(token))
        assert file_response.status_code == 200
        assert file_response.headers["content-type"] == "image/png"
        assert file_response.content == content
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_evidence_cannot_be_deleted_or_replaced() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_antifraude@teste.clop", nome_completo="Oper Antifraude")
    try:
        token = login("oper_antifraude@teste.clop")
        today = date.today().isoformat()
        _save_precheck(token, today)
        trade_id = _open_trade(token, {"data_operacao": today, "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA})

        original = b"primeira captura unica " + os.urandom(32)
        first = _upload_evidence(token, trade_id, "ENTRADA", content=original, filename="entrada.png")
        assert first.status_code == 201
        evidence_id = first.json()["id"]

        response = client.delete(f"/api/trading/trades/{trade_id}/evidences", headers=auth(token))
        assert response.status_code in (404, 405)

        response = client.delete(f"/api/trading/trades/{trade_id}/evidences/{evidence_id}", headers=auth(token))
        assert response.status_code in (404, 405)

        response = client.delete(f"/api/trading/evidences/{evidence_id}/file", headers=auth(token))
        assert response.status_code in (404, 405)

        response = client.get(f"/api/trading/trades/{trade_id}/evidences", headers=auth(token))
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["sha256"] == hashlib.sha256(original).hexdigest()

        replacement = b"segunda captura diferente " + os.urandom(32)
        second = _upload_evidence(token, trade_id, "ENTRADA", content=replacement, filename="entrada.png")
        assert second.status_code == 201

        response = client.get(f"/api/trading/trades/{trade_id}/evidences", headers=auth(token))
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 2
        assert {item["sha256"] for item in items} == {
            hashlib.sha256(original).hexdigest(),
            hashlib.sha256(replacement).hexdigest(),
        }

        file_response = client.get(f"/api/trading/evidences/{evidence_id}/file", headers=auth(token))
        assert file_response.status_code == 200
        assert file_response.content == original
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_evidence_duplicate_hash_alert() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_hash@teste.clop", nome_completo="Oper Hash")
    try:
        token = login("oper_hash@teste.clop")
        today = date.today().isoformat()
        _save_precheck(token, today)
        base = {"data_operacao": today, "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        trade_one = _open_trade(token, base)
        trade_two = _open_trade(token, base)

        shared = os.urandom(64)
        first = _upload_evidence(token, trade_one, "ENTRADA", content=shared)
        assert first.status_code == 201
        assert first.json()["alerta_hash_duplicado"] is False

        repeated = _upload_evidence(token, trade_two, "ENTRADA", content=shared)
        assert repeated.status_code == 201
        assert repeated.json()["alerta_hash_duplicado"] is True
        assert repeated.json()["sha256"] == first.json()["sha256"]

        unique = os.urandom(64)
        fresh = _upload_evidence(token, trade_two, "FECHO", content=unique)
        assert fresh.status_code == 201
        assert fresh.json()["alerta_hash_duplicado"] is False
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_evidence_late_upload_alert() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_tardio@teste.clop", nome_completo="Oper Tardio")
    try:
        token = login("oper_tardio@teste.clop")
        old_day = (date.today() - timedelta(days=10)).isoformat()
        today = date.today().isoformat()
        _save_precheck(token, old_day)
        _save_precheck(token, today)

        late_trade = _open_trade(token, {"data_operacao": old_day, "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA})
        response = _upload_evidence(token, late_trade, "ENTRADA")
        assert response.status_code == 201
        assert response.json()["alerta_upload_tardio"] is True

        on_time_trade = _open_trade(token, {"data_operacao": today, "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA})
        response = _upload_evidence(token, on_time_trade, "ENTRADA")
        assert response.status_code == 201
        assert response.json()["alerta_upload_tardio"] is False
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_leader_review_workflow() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_revisao@teste.clop", nome_completo="Oper Revisao")
    leader = create_user(db, email="lider_producao@teste.clop", nome_completo="Lider Producao", role=UserRole.TRADING_LEADER)
    employee = create_user(db, email="colaborador_revisao@teste.clop", nome_completo="Colaborador Revisao")
    try:
        token = login("oper_revisao@teste.clop")
        leader_token = login("lider_producao@teste.clop")
        employee_token = login("colaborador_revisao@teste.clop")

        _save_precheck(token, "2026-07-17")
        base = {"data_operacao": "2026-07-17", "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        trade_id = _closed_trade(token, base, estado="GANHOU", valor=120, preco_saida=1.11)
        open_trade_id = _open_trade(token, base)

        response = client.get("/api/trading/review-queue", headers=auth(employee_token))
        assert response.status_code == 403
        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "APROVADA", "comentario": "Aprovado por mim"},
            headers=auth(employee_token),
        )
        assert response.status_code == 403
        response = client.get("/api/trading/review-queue", headers=auth(token))
        assert response.status_code == 403

        response = client.get(
            f"/api/trading/review-queue?operator_id={operator.id}&revisao_estado=NAO_REVISADA", headers=auth(leader_token)
        )
        assert response.status_code == 200
        queue = response.json()
        assert queue["total"] == 1
        item = queue["items"][0]
        assert item["id"] == trade_id
        assert item["tem_evidencia_entrada"] is True
        assert item["tem_evidencia_fecho"] is True
        assert len(item["evidencias"]) == 2

        response = client.get(
            f"/api/trading/review-queue?operator_id={operator.id}&sem_evidencia=true", headers=auth(leader_token)
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "APROVADA", "comentario": "ok"},
            headers=auth(leader_token),
        )
        assert response.status_code == 422

        response = client.post(
            f"/api/trading/trades/{open_trade_id}/review",
            json={"decision": "APROVADA", "comentario": "A operação ainda não fechou"},
            headers=auth(leader_token),
        )
        assert response.status_code == 400

        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "CORRECAO_PEDIDA", "comentario": "Falta justificar a entrada", "divergencia_plano": True},
            headers=auth(leader_token),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["revisao_estado"] == "CORRECAO_PEDIDA"
        assert body["divergencia_plano"] is True
        assert body["revisao_por_nome"] == "Lider Producao"
        assert len(body["revisoes"]) == 1
        assert body["revisoes"][0]["action"] == "CORRECAO_PEDIDA"

        response = client.get("/api/notifications", headers=auth(token))
        assert response.status_code == 200
        assert any(n["type"] == "TRADE_REVIEW" and "Correcção" in n["title"] for n in response.json())

        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "APROVADA", "comentario": "Resposta enviada"},
            headers=auth(employee_token),
        )
        assert response.status_code == 403

        response = client.post(
            f"/api/trading/trades/{trade_id}/review/respond",
            json={"comentario": "Entrada documentada na captura anexada"},
            headers=auth(token),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["revisao_estado"] == "NAO_REVISADA"
        assert body["revisao_comentario"] is None
        assert len(body["revisoes"]) == 2
        assert body["revisoes"][1]["action"] == "RESPOSTA_OPERADOR"

        response = client.get("/api/notifications", headers=auth(leader_token))
        assert response.status_code == 200
        assert any(n["type"] == "TRADE_REVIEW" and "respondeu" in n["title"] for n in response.json())

        response = client.post(
            f"/api/trading/trades/{trade_id}/review/respond",
            json={"comentario": "Sem revisão pendente agora"},
            headers=auth(token),
        )
        assert response.status_code == 400

        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "INCONSISTENTE", "comentario": "Valor não confere com a captura", "divergencia_plano": True},
            headers=auth(leader_token),
        )
        assert response.status_code == 200
        assert response.json()["revisao_estado"] == "INCONSISTENTE"

        response = client.post(
            f"/api/trading/trades/{trade_id}/review",
            json={"decision": "APROVADA", "comentario": "Tudo conforme o método"},
            headers=auth(leader_token),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["revisao_estado"] == "APROVADA"
        assert body["revisoes"][-1]["user_nome"] == "Lider Producao"

        response = _put_trade(token, trade_id, {"preco_saida": 1.115})
        assert response.status_code == 200
        assert response.json()["revisao_estado"] == "NAO_REVISADA"
        assert response.json()["divergencia_plano"] is False
    finally:
        cleanup_trading(db, [operator.id, leader.id, employee.id])
        delete_user(db, operator.id)
        delete_user(db, leader.id)
        delete_user(db, employee.id)
        db.close()


def test_monthly_report_and_exports() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_relatorio@teste.clop", nome_completo="Oper Relatorio")
    try:
        token = login("oper_relatorio@teste.clop")
        _save_precheck(token, "2026-07-15")
        base = {"data_operacao": "2026-07-15", "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        _closed_trade(
            token, base, estado="GANHOU", valor=100, preco_saida=1.11,
            seguiu_plano=True, mindset="CALMO", observacoes="Boa entrada no OB",
        )
        _closed_trade(
            token, base, estado="PERDEU", valor=-60, preco_saida=1.09,
            seguiu_plano=False, mindset="ANSIOSO", observacoes="Entrei antes da captura",
        )
        client.put("/api/trading/checklists/2026-07-15", json=dict(PRECHECK_PAYLOAD, s05_nota=4), headers=auth(token))

        response = client.get("/api/trading/monthly-report?ano=2026&mes=7", headers=auth(token))
        assert response.status_code == 200
        report = response.json()
        assert report["resumo"]["total_operacoes"] == 2
        assert report["resumo"]["taxa_acerto"] == 50.0
        assert report["resumo"]["resultado"] == 40.0
        assert report["plano"]["seguhou_resultado"] == 100.0
        assert report["plano"]["nao_seguhou_resultado"] == -60.0
        assert report["execucao"]["nota_media"] == 4.0
        assert len(report["observacoes"]) == 2

        evidencia = report["evidencia"]
        assert evidencia["total_fechadas"] == 2
        assert evidencia["com_evidencia"] == 2
        assert evidencia["sem_evidencia"] == 0
        assert evidencia["pct_com_evidencia"] == 100.0
        assert evidencia["aprovadas"] == 0
        assert evidencia["nao_revisadas"] == 2
        assert evidencia["divergencias_plano"] == 0
        assert report["capturas"] == []

        response = client.get("/api/trading/monthly-report?ano=2026&mes=7&incluir_evidencias=true", headers=auth(token))
        assert response.status_code == 200
        capturas = response.json()["capturas"]
        assert len(capturas) == 1
        assert capturas[0]["estado"] == "PERDEU"
        assert capturas[0]["sem_evidencia"] is False
        assert len(capturas[0]["imagens"]) == 2
        assert capturas[0]["imagens"][0]["url"].startswith("/api/trading/evidences/")
        assert "file_path" not in capturas[0]["imagens"][0]

        response = client.get("/api/trading/monthly-report/csv?ano=2026&mes=7", headers=auth(token))
        assert response.status_code == 200
        assert "EURUSD" in response.text

        response = client.get("/api/trading/monthly-report/pdf?ano=2026&mes=7", headers=auth(token))
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

        response = client.get("/api/trading/evolution/csv?ano=2026", headers=auth(token))
        assert response.status_code == 200
        assert "TOTAL" in response.text

        response = client.get("/api/trading/summary?ano=2026&mes=7", headers=auth(token))
        assert response.status_code == 200
        assert response.json()["operacoes_mes"] == 2
    finally:
        cleanup_trading(db, [operator.id])
        delete_user(db, operator.id)
        db.close()


def test_report_apenas_validadas() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_validadas@teste.clop", nome_completo="Oper Validadas")
    leader = create_user(db, email="lider_validadas@teste.clop", nome_completo="Lider Validadas", role=UserRole.TRADING_LEADER)
    try:
        token = login("oper_validadas@teste.clop")
        leader_token = login("lider_validadas@teste.clop")
        _save_precheck(token, "2026-07-18")
        base = {"data_operacao": "2026-07-18", "ativo": "EURUSD", "direcao": "COMPRA", **PRICES_COMPRA}
        win_id = _closed_trade(token, base, estado="GANHOU", valor=100, preco_saida=1.11)
        _closed_trade(token, base, estado="PERDEU", valor=-60, preco_saida=1.09)

        response = client.get("/api/trading/monthly-report?ano=2026&mes=7&apenas_validadas=true", headers=auth(token))
        assert response.status_code == 200
        report = response.json()
        assert report["resumo"]["resultado"] == 0.0
        assert report["resumo"]["taxa_acerto"] == 0.0
        assert report["evidencia"]["aprovadas"] == 0
        assert report["evidencia"]["total_fechadas"] == 2

        response = client.post(
            f"/api/trading/trades/{win_id}/review",
            json={"decision": "APROVADA", "comentario": "Conforme o método"},
            headers=auth(leader_token),
        )
        assert response.status_code == 200

        response = client.get("/api/trading/monthly-report?ano=2026&mes=7&apenas_validadas=true", headers=auth(token))
        assert response.status_code == 200
        report = response.json()
        assert report["resumo"]["resultado"] == 100.0
        assert report["resumo"]["taxa_acerto"] == 100.0
        assert report["evidencia"]["aprovadas"] == 1
        assert report["evidencia"]["pct_aprovadas"] == 50.0

        response = client.get("/api/trading/monthly-report?ano=2026&mes=7", headers=auth(token))
        assert response.status_code == 200
        assert response.json()["resumo"]["resultado"] == 40.0
        assert response.json()["resumo"]["taxa_acerto"] == 50.0

        response = client.get("/api/trading/monthly-report/csv?ano=2026&mes=7&apenas_validadas=true", headers=auth(token))
        assert response.status_code == 200
        assert response.text.count("EURUSD") == 1

        response = client.get("/api/trading/monthly-report/pdf?ano=2026&mes=7&apenas_validadas=true", headers=auth(token))
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
    finally:
        cleanup_trading(db, [operator.id, leader.id])
        delete_user(db, operator.id)
        delete_user(db, leader.id)
        db.close()
