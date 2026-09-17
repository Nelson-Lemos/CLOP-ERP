from app.core.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from tests.conftest import auth, client, create_department, create_user, delete_department, delete_user, login

PASSWORD = "TestePass123!"


def _cleanup():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email.like("%@teste.clop")).all()
        for u in users:
            if u.email not in ("ceo_teste@teste.clop",):
                delete_user(db, u.id)
        depts = db.query(User).with_entities(User.departamento_id).all()
    finally:
        db.close()


def test_employee_cannot_create_user() -> None:
    db = SessionLocal()
    emp = create_user(db, email="emp_criar@teste.clop")
    token = login("emp_criar@teste.clop")
    try:
        response = client.post(
            "/api/users",
            json={
                "nome_completo": "Novo",
                "email": "novo@teste.clop",
                "password": "Password123!",
            },
            headers=auth(token),
        )
        assert response.status_code == 403
    finally:
        delete_user(db, emp.id)
        db.close()


def test_ceo_creates_user() -> None:
    db = SessionLocal()
    dept = create_department(db, nome="TESTE Criar")
    try:
        new_email = "criado@teste.clop"
        response = client.post(
            "/api/users",
            json={
                "nome_completo": "Colaborador Novo",
                "email": new_email,
                "password": "Password123!",
                "departamento_id": dept.id,
                "role": "EMPLOYEE",
                "cargo": "Analista",
            },
            headers=auth(login("ceo_teste@teste.clop")),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["email"] == new_email
        assert body["estado"] == UserStatus.ACTIVE
        assert body["departamento_id"] == dept.id
        created = db.query(User).filter(User.id == body["id"]).first()
        delete_user(db, created.id)
    finally:
        delete_department(db, dept.id)
        db.close()


def test_ceo_cannot_create_duplicate_email() -> None:
    db = SessionLocal()
    emp = create_user(db, email="dup@teste.clop")
    try:
        response = client.post(
            "/api/users",
            json={
                "nome_completo": "Outro",
                "email": "dup@teste.clop",
                "password": "Password123!",
            },
            headers=auth(login("ceo_teste@teste.clop")),
        )
        assert response.status_code == 409
    finally:
        delete_user(db, emp.id)
        db.close()


def test_unauthenticated_gets_401() -> None:
    response = client.get("/api/users")
    assert response.status_code == 401


def test_employee_sees_only_self() -> None:
    db = SessionLocal()
    emp = create_user(db, email="soeu@teste.clop")
    other = create_user(db, email="outro@teste.clop")
    token = login("soeu@teste.clop")
    try:
        response = client.get("/api/users", headers=auth(token))
        assert response.status_code == 200
        assert response.json()[0]["id"] == emp.id
        assert len(response.json()) == 1
        single = client.get(f"/api/users/{other.id}", headers=auth(token))
        assert single.status_code == 403
    finally:
        delete_user(db, other.id)
        delete_user(db, emp.id)
        db.close()


def test_ceo_updates_employee() -> None:
    db = SessionLocal()
    emp = create_user(db, email="atualizar@teste.clop", nome_completo="Nome Antigo")
    try:
        response = client.put(
            f"/api/users/{emp.id}",
            json={"nome_completo": "Nome Novo", "telefone": "999111222"},
            headers=auth(login("ceo_teste@teste.clop")),
        )
        assert response.status_code == 200
        assert response.json()["nome_completo"] == "Nome Novo"
    finally:
        delete_user(db, emp.id)
        db.close()


def test_employee_cannot_change_own_role() -> None:
    db = SessionLocal()
    emp = create_user(db, email="rolefix@teste.clop")
    token = login("rolefix@teste.clop")
    try:
        response = client.put(
            f"/api/users/{emp.id}",
            json={"role": "CEO"},
            headers=auth(token),
        )
        assert response.status_code == 403
    finally:
        delete_user(db, emp.id)
        db.close()


def test_status_change_and_disabled_user_cannot_login() -> None:
    db = SessionLocal()
    emp = create_user(db, email="desativa@teste.clop")
    try:
        response = client.patch(
            f"/api/users/{emp.id}/status",
            json={"estado": UserStatus.INACTIVE},
            headers=auth(login("ceo_teste@teste.clop")),
        )
        assert response.status_code == 200
        assert response.json()["estado"] == UserStatus.INACTIVE

        login_response = client.post(
            "/api/auth/login",
            json={"email": "desativa@teste.clop", "password": PASSWORD},
        )
        assert login_response.status_code == 401
    finally:
        delete_user(db, emp.id)
        db.close()