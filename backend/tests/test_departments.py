from app.core.database import SessionLocal
from app.models.department import Department
from app.models.user import User, UserRole
from tests.conftest import auth, client, create_department, create_user, delete_department, delete_user, login


def _user_by_email(email: str) -> User | None:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()


def test_employee_cannot_list_departments() -> None:
    db = SessionLocal()
    emp = create_user(db, email="emp_dept@teste.clop")
    token = login("emp_dept@teste.clop")
    try:
        response = client.get("/api/departments", headers=auth(token))
        assert response.status_code == 403
    finally:
        delete_user(db, emp.id)
        db.close()


def test_ceo_creates_department() -> None:
    db = SessionLocal()
    try:
        response = client.post(
            "/api/departments",
            json={"nome": "TESTE Legal", "descricao": "Assuntos legais"},
            headers=auth(login("ceo_teste@teste.clop")),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["nome"] == "TESTE Legal"
        assert body["employee_count"] == 0
        dept = db.query(Department).filter(Department.id == body["id"]).first()
        delete_department(db, dept.id)
    finally:
        db.close()


def test_manager_assigns_as_head_and_sees_only_own() -> None:
    db = SessionLocal()
    dept_a = create_department(db, nome="TESTE TI")
    dept_b = create_department(db, nome="TESTE Contabilidade")
    try:
        manager = _user_by_email("manager_teste@teste.clop")
        if not manager:
            manager = create_user(db, email="manager_teste@teste.clop", role=UserRole.MANAGER, departamento_id=dept_a.id)
        else:
            manager.role = UserRole.MANAGER
            manager.departamento_id = dept_a.id
            db.commit()
            db.refresh(manager)

        emp1 = create_user(db, email="m1@teste.clop", departamento_id=dept_a.id)
        emp2 = create_user(db, email="m2@teste.clop", departamento_id=dept_b.id)

        token = login("manager_teste@teste.clop")
        response = client.get("/api/users", headers=auth(token))
        assert response.status_code == 200
        ids = [u["id"] for u in response.json()]
        assert manager.id in ids
        assert emp1.id in ids
        assert emp2.id not in ids

        dept_list = client.get("/api/departments", headers=auth(token))
        assert dept_list.status_code == 200
        assert len(dept_list.json()) == 1
        assert dept_list.json()[0]["id"] == dept_a.id

        other = client.get(f"/api/departments/{dept_b.id}", headers=auth(token))
        assert other.status_code == 403

        employees = client.get(f"/api/departments/{dept_a.id}/employees", headers=auth(token))
        assert employees.status_code == 200
        emp_ids = [e["id"] for e in employees.json()]
        assert emp1.id in emp_ids
    finally:
        delete_user(db, manager.id)
        delete_user(db, emp2.id)
        delete_user(db, emp1.id)
        delete_department(db, dept_b.id)
        delete_department(db, dept_a.id)
        db.close()


def test_ceo_views_all() -> None:
    db = SessionLocal()
    dept = create_department(db, nome="TESTE Auditoria")
    try:
        response = client.get("/api/departments", headers=auth(login("ceo_teste@teste.clop")))
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 1
    finally:
        delete_department(db, dept.id)
        db.close()