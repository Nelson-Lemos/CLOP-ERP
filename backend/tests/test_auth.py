from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.audit import AuditLog
from app.models.user import User, UserRole, UserStatus

client = TestClient(app)


def _create_user(db, *, email: str, estado: str = UserStatus.ACTIVE, role: str = UserRole.EMPLOYEE) -> User:
    user = User(
        nome_completo="Teste Utilizador",
        email=email,
        password_hash=hash_password("TestePass123!"),
        role=role,
        estado=estado,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _delete_user(db, user_id: int) -> None:
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()
    db.commit()


def test_login_success() -> None:
    db = SessionLocal()
    user = _create_user(db, email="login_ok@teste.clop")
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "login_ok@teste.clop", "password": "TestePass123!"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["email"] == "login_ok@teste.clop"
        assert body["user"]["role"] == UserRole.EMPLOYEE
    finally:
        _delete_user(db, user.id)
        db.close()


def test_login_invalid_credentials() -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "nao_existe@teste.clop", "password": "errada"},
    )
    assert response.status_code == 401


def test_login_inactive_user_fails() -> None:
    db = SessionLocal()
    user = _create_user(db, email="inativo@teste.clop", estado=UserStatus.INACTIVE)
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "inativo@teste.clop", "password": "TestePass123!"},
        )
        assert response.status_code == 401
    finally:
        _delete_user(db, user.id)
        db.close()


def test_login_suspended_user_fails() -> None:
    db = SessionLocal()
    user = _create_user(db, email="suspenso@teste.clop", estado=UserStatus.SUSPENDED)
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "suspenso@teste.clop", "password": "TestePass123!"},
        )
        assert response.status_code == 401
    finally:
        _delete_user(db, user.id)
        db.close()


def test_me_requires_token() -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token() -> None:
    db = SessionLocal()
    user = _create_user(db, email="me@teste.clop")
    try:
        login = client.post(
            "/api/auth/login",
            json={"email": "me@teste.clop", "password": "TestePass123!"},
        )
        token = login.json()["access_token"]
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == "me@teste.clop"
    finally:
        _delete_user(db, user.id)
        db.close()


def test_me_rejects_access_token_from_logged_out_scenario() -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer token_invalido"})
    assert response.status_code == 401


def test_refresh_token_cycle() -> None:
    db = SessionLocal()
    user = _create_user(db, email="refresh@teste.clop")
    try:
        login = client.post(
            "/api/auth/login",
            json={"email": "refresh@teste.clop", "password": "TestePass123!"},
        )
        refresh_token = login.json()["refresh_token"]

        refreshed = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refreshed.status_code == 200
        body = refreshed.json()
        assert body["access_token"]
        assert body["refresh_token"]
    finally:
        _delete_user(db, user.id)
        db.close()


def test_refresh_rejects_access_token_as_refresh() -> None:
    db = SessionLocal()
    user = _create_user(db, email="refresh_bad@teste.clop")
    try:
        login = client.post(
            "/api/auth/login",
            json={"email": "refresh_bad@teste.clop", "password": "TestePass123!"},
        )
        access_token = login.json()["access_token"]
        response = client.post("/api/auth/refresh", json={"refresh_token": access_token})
        assert response.status_code == 401
    finally:
        _delete_user(db, user.id)
        db.close()
