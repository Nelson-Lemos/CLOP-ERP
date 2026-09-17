from app.core.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from tests.conftest import auth, client, create_department, create_user, delete_department, delete_user, login


def test_disabled_user_cannot_login() -> None:
    db = SessionLocal()
    emp = create_user(db, email="bloq@teste.clop", estado=UserStatus.INACTIVE)
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "bloq@teste.clop", "password": "TestePass123!"},
        )
        assert response.status_code == 401
    finally:
        delete_user(db, emp.id)
        db.close()


def test_invalid_token_denied() -> None:
    response = client.get("/api/users", headers=auth("token.errado.aqui"))
    assert response.status_code == 401


def test_functionary_cannot_access_admin_users_endpoint() -> None:
    db = SessionLocal()
    emp = create_user(db, email="semadmin@teste.clop")
    token = login("semadmin@teste.clop")
    try:
        response = client.post(
            "/api/users",
            json={"nome_completo": "Hacker", "email": "hacker@teste.clop", "password": "Password123!"},
            headers=auth(token),
        )
        assert response.status_code == 403
    finally:
        delete_user(db, emp.id)
        db.close()


def test_manager_cannot_change_status_of_other_department() -> None:
    db = SessionLocal()
    dept = create_department(db, nome="TESTE Permissões")
    try:
        mgr = create_user(db, email="mgr_perm@teste.clop", role=UserRole.MANAGER, departamento_id=dept.id)
        outsider = create_user(db, email="fora_perm@teste.clop", departamento_id=None)
        token = login("mgr_perm@teste.clop")
        response = client.patch(
            f"/api/users/{outsider.id}/status",
            json={"estado": UserStatus.INACTIVE},
            headers=auth(token),
        )
        assert response.status_code == 403
    finally:
        delete_user(db, outsider.id)
        delete_user(db, mgr.id)
        delete_department(db, dept.id)
        db.close()


def test_ceo_full_access() -> None:
    db = SessionLocal()
    try:
        response = client.get("/api/users", headers=auth(login("ceo_teste@teste.clop")))
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        db.close()