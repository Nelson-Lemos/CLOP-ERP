from datetime import datetime, timedelta

from app.core.database import SessionLocal
from tests.conftest import client, create_department, create_user, login


def _setup_ceo_and_dept(tag: str = "prod"):
    db = SessionLocal()
    dept = create_department(db, nome=f"TESTE_{tag}")
    emp = create_user(db, role="EMPLOYEE", departamento_id=dept.id, email=f"{tag}_emp@teste.clop")
    dept_id, emp_id = dept.id, emp.id
    db.close()
    return dept_id, emp_id


def test_admin_dashboard_global():
    ceo_token = login("ceo_teste@teste.clop")
    r = client.get("/api/dashboard/admin", headers={"Authorization": f"Bearer {ceo_token}"})
    assert r.status_code == 200
    body = r.json()
    assert "total_employees" in body
    assert "total_departments" in body
    assert "tasks_today" in body
    assert "employees" in body


def test_manager_department_dashboard_scoped():
    dept_id, emp_id = _setup_ceo_and_dept("mgr")
    db = SessionLocal()
    manager = create_user(db, role="MANAGER", departamento_id=dept_id, email="mgr_mgr@teste.clop")
    db.close()
    token = login("mgr_mgr@teste.clop")
    r = client.get("/api/dashboard/department", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["department_id"] == dept_id


def test_employee_cannot_see_department_dashboard():
    dept_id, emp_id = _setup_ceo_and_dept("seev")
    token = login("seev_emp@teste.clop")
    r = client.get("/api/dashboard/department", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    r2 = client.get("/api/dashboard/admin", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 403


def test_employee_dashboard_own():
    dept_id, emp_id = _setup_ceo_and_dept("own")
    token = login("own_emp@teste.clop")
    r = client.get("/api/dashboard/employee", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert "today" in r.json()


def test_employee_cannot_see_other_productivity():
    dept_id, emp_id = _setup_ceo_and_dept("oprod")
    db = SessionLocal()
    other = create_user(db, role="EMPLOYEE", departamento_id=dept_id, email="oprod_other@teste.clop")
    other_id = other.id
    db.close()
    token = login("oprod_emp@teste.clop")
    r = client.get(f"/api/productivity/employees/{other_id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_company_productivity_ceo_only():
    ceo_token = login("ceo_teste@teste.clop")
    r = client.get("/api/productivity/company", headers={"Authorization": f"Bearer {ceo_token}"})
    assert r.status_code == 200
    assert "company" in r.json()
    assert "departments" in r.json()


def test_reports_pdf_generation():
    ceo_token = login("ceo_teste@teste.clop")
    r = client.get("/api/reports/company/pdf", headers={"Authorization": f"Bearer {ceo_token}"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")


def test_employee_report_only_own():
    dept_id, emp_id = _setup_ceo_and_dept("report")
    db = SessionLocal()
    other = create_user(db, role="EMPLOYEE", departamento_id=dept_id, email="report_other@teste.clop")
    other_id = other.id
    db.close()
    token = login("report_emp@teste.clop")
    own = client.get(f"/api/reports/employee/{emp_id}", headers={"Authorization": f"Bearer {token}"})
    assert own.status_code == 200
    forbidden = client.get(f"/api/reports/employee/{other_id}", headers={"Authorization": f"Bearer {token}"})
    assert forbidden.status_code == 403


def test_notifications_flow():
    ceo_token = login("ceo_teste@teste.clop")
    db = SessionLocal()
    dept = create_department(db, nome="TESTE_Notif")
    emp = create_user(db, role="EMPLOYEE", departamento_id=dept.id, email="notif_emp@teste.clop")
    emp_id, dept_id = emp.id, dept.id
    db.close()
    r = client.post(
        "/api/tasks",
        headers={"Authorization": f"Bearer {ceo_token}"},
        json={
            "titulo": "Tarefa para notificação",
            "descricao": "teste",
            "tipo": "NORMAL",
            "prioridade": "HIGH",
            "assigned_to": emp_id,
            "department_id": dept_id,
            "start_date": (datetime.now() - timedelta(days=1)).isoformat(),
            "deadline": (datetime.now() + timedelta(days=2)).isoformat(),
        },
    )
    assert r.status_code == 201, r.text
    emp_token = login("notif_emp@teste.clop")
    notif = client.get("/api/notifications", headers={"Authorization": f"Bearer {emp_token}"})
    assert notif.status_code == 200
    items = notif.json()
    assert len(items) >= 1
    first_id = items[0]["id"]
    assert items[0]["is_read"] is False
    unread = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {emp_token}"})
    assert unread.json()["unread"] >= 1
    read = client.patch(f"/api/notifications/{first_id}/read", headers={"Authorization": f"Bearer {emp_token}"})
    assert read.status_code == 200


def test_audit_logs_ceo_only():
    ceo_token = login("ceo_teste@teste.clop")
    r = client.get("/api/audit/logs", headers={"Authorization": f"Bearer {ceo_token}"})
    assert r.status_code == 200
    assert "items" in r.json()
    db = SessionLocal()
    create_user(db, role="EMPLOYEE", email="audit_emp@teste.clop")
    db.close()
    token = login("audit_emp@teste.clop")
    r2 = client.get("/api/audit/logs", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 403



