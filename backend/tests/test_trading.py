from app.core.database import SessionLocal
from app.models.trading import (
    TradingAccount,
    TradingChecklist,
    TradingMethod,
    TradingMonth,
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


def cleanup_trading(db, operator_ids: list[int]) -> None:
    for oid in operator_ids:
        trades = db.query(TradingTrade).filter(TradingTrade.operator_id == oid).all()
        for trade in trades:
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
        response = _create_trade(token, payload)
        assert response.status_code == 201, response.text
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
        base = {"data_operacao": "2026-07-11", "ativo": "BTCUSD", "direcao": "VENDA"}

        response = _create_trade(token, {**base, "estado": "PENDENTE", "valor_finaneiro": 50})
        assert response.status_code == 400

        response = _create_trade(token, {**base, "estado": "GANHOU"})
        assert response.status_code == 400

        response = _create_trade(token, {**base, "estado": "GANHOU", "valor_finaneiro": -100})
        assert response.status_code == 400

        response = _create_trade(token, {**base, "estado": "PERDEU", "valor_finaneiro": 100})
        assert response.status_code == 400

        response = _create_trade(token, {**base, "estado": "PERDEU", "valor_finaneiro": -100, "risco_retorno": 3, "mindset": "ANSIOSO"})
        assert response.status_code == 201, response.json()
        assert response.json()["valor_finaneiro"] == -100.0
        assert response.json()["mindset"] == "ANSIOSO"

        response = _create_trade(token, {**base, "estado": "PERDEU", "valor_finaneiro": -100, "mindset": "INVENTADO"})
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
        base = {"data_operacao": "2026-07-10", "ativo": "EURUSD", "direcao": "COMPRA"}
        assert _create_trade(token, {**base, "estado": "GANHOU", "valor_finaneiro": 200, "risco_retorno": 3}).status_code == 201
        assert _create_trade(token, {**base, "estado": "PERDEU", "valor_finaneiro": -50}).status_code == 201
        assert _create_trade(token, {**base, "estado": "PENDENTE"}).status_code == 201

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
        response = _create_trade(token, {"data_operacao": "2026-07-12", "ativo": "XAUUSD", "direcao": "VENDA", "estado": "PENDENTE"})
        assert response.status_code == 201
        trade_id = response.json()["id"]

        response = client.put(
            f"/api/trading/trades/{trade_id}",
            json={"estado": "EM_ANDAMENTO"},
            headers=auth(token),
        )
        assert response.status_code == 200
        assert response.json()["estado"] == "EM_ANDAMENTO"

        response = client.put(
            f"/api/trading/trades/{trade_id}",
            json={"estado": "GANHOU", "valor_finaneiro": 80},
            headers=auth(token),
        )
        assert response.status_code == 200
        assert response.json()["valor_finaneiro"] == 80.0

        response = client.get("/api/trading/months/2026/7", headers=auth(token))
        assert response.json()["resultado"] == 80.0
        assert response.json()["taxa_acerto"] == 100.0

        response = client.put(
            f"/api/trading/trades/{trade_id}",
            json={"estado": "PERDEU"},
            headers=auth(token),
        )
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
    try:
        token_a = login("oper_a@teste.clop")
        token_b = login("oper_b@teste.clop")
        token_manager = login("gestor_trading@teste.clop")
        ceo_token = login("ceo_teste@teste.clop")
        _save_precheck(token_a, "2026-07-14")
        assert _create_trade(token_a, {
            "data_operacao": "2026-07-14", "ativo": "EURUSD", "direcao": "COMPRA",
            "estado": "GANHOU", "valor_finaneiro": 10,
        }).status_code == 201

        response = client.get(f"/api/trading/trades?operator_id={operator_a.id}", headers=auth(token_b))
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

        for token in (token_manager, ceo_token):
            response = client.get(f"/api/trading/trades?operator_id={operator_a.id}", headers=auth(token))
            assert response.status_code == 200
            assert len(response.json()) == 1

        response = client.get("/api/trading/trades", headers=auth(token_b))
        assert response.status_code == 200
        assert response.json() == []

        response = client.get("/api/trading/evolution?ano=2026", headers=auth(ceo_token))
        assert response.status_code == 200
    finally:
        cleanup_trading(db, [operator_a.id, operator_b.id, manager.id])
        delete_user(db, operator_a.id)
        delete_user(db, operator_b.id)
        delete_user(db, manager.id)
        db.close()


def test_monthly_report_and_exports() -> None:
    db = SessionLocal()
    operator = create_user(db, email="oper_relatorio@teste.clop", nome_completo="Oper Relatorio")
    try:
        token = login("oper_relatorio@teste.clop")
        _save_precheck(token, "2026-07-15")
        base = {"data_operacao": "2026-07-15", "ativo": "EURUSD", "direcao": "COMPRA"}
        assert _create_trade(token, {**base, "estado": "GANHOU", "valor_finaneiro": 100, "seguiu_plano": True, "mindset": "CALMO", "observacoes": "Boa entrada no OB"}).status_code == 201
        assert _create_trade(token, {**base, "estado": "PERDEU", "valor_finaneiro": -60, "seguiu_plano": False, "mindset": "ANSIOSO", "observacoes": "Entrei antes da captura"}).status_code == 201
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
