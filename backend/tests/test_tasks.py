from app.core.database import SessionLocal
from app.models.department import Department
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from tests.conftest import auth, client, create_department, create_user, delete_department, delete_user, login


def _dept(db, nome="TESTE Tasks"):
    return create_department(db, nome=nome)


def _task(db, *, titulo="Tarefa Teste", assigned_to, creator_id, cn, manager_id=None, descricao="Desc"):
    from app.models.task import Task

    task = Task(
        titulo=titulo,
        descricao=descricao,
        tipo="NORMAL",
        prioridade="MEDIUM",
        status=TaskStatus.PENDING,
        progress=0,
        created_by=creator_id,
        assigned_to=assigned_to,
        department_id=cn,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _cleanup(*ids):
    db = SessionLocal()
    try:
        from app.models.attachment import Attachment
        from app.models.task import Task, TaskHistory, TaskReview, TaskUpdate

        ids_list = list(ids)
        for tbl in (TaskReview, TaskUpdate, TaskHistory):
            db.query(tbl).filter(tbl.task_id.in_(ids_list)).delete()
        db.query(Attachment).filter(Attachment.task_id.in_(ids_list)).delete()
        db.query(Task).filter(Task.id.in_(ids_list)).delete()
        db.commit()
    finally:
        db.close()


def _delete_users(*users):
    db = SessionLocal()
    try:
        for u in users:
            if u:
                delete_user(db, u.id)
    finally:
        db.close()


def test_full_flow_create_start_submit_approve() -> None:
    db = SessionLocal()
    dept = _dept(db)
    ceo = create_user(db, email="ceo_flow@teste.clop", role=UserRole.CEO)
    emp = create_user(db, email="emp_flow@teste.clop", departamento_id=dept.id)
    ceo_token = login("ceo_flow@teste.clop")
    emp_token = login("emp_flow@teste.clop")
    task_id = None
    try:
        created = client.post(
            "/api/tasks",
            json={
                "titulo": "Desenvolver módulo de autenticação",
                "descricao": "Implementar login, logout e JWT",
                "tipo": "NORMAL",
                "prioridade": "HIGH",
                "assigned_to": emp.id,
                "department_id": dept.id,
            },
            headers=auth(ceo_token),
        )
        assert created.status_code == 201, created.text
        task_id = created.json()["id"]
        assert created.json()["status"] == TaskStatus.PENDING

        started = client.patch(
            f"/api/tasks/{task_id}/status",
            json={"status": TaskStatus.IN_PROGRESS},
            headers=auth(emp_token),
        )
        assert started.status_code == 200, started.text

        progress = client.patch(
            f"/api/tasks/{task_id}/progress",
            json={"progress": 70, "descricao": "Login concluído"},
            headers=auth(emp_token),
        )
        assert progress.status_code == 200
        assert progress.json()["progress"] == 70

        submitted = client.post(
            f"/api/tasks/{task_id}/submit",
            json={"progress": 100, "descricao": "Tudo implementado"},
            headers=auth(emp_token),
        )
        assert submitted.status_code == 200
        assert submitted.json()["status"] == TaskStatus.SUBMITTED

        approved = client.post(
            f"/api/tasks/{task_id}/approve",
            headers=auth(ceo_token),
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == TaskStatus.COMPLETED
        assert approved.json()["completed_at"] is not None

        history = client.get(f"/api/tasks/{task_id}/history", headers=auth(ceo_token))
        assert history.status_code == 200
        actions = [h["action"] for h in history.json()]
        assert "CREATE_TASK" in actions
        assert "SUBMIT_TASK" in actions
        assert "APPROVE_TASK" in actions

        detail = client.get(f"/api/tasks/{task_id}", headers=auth(emp_token))
        assert detail.status_code == 200
        assert detail.json()["assigned_to_nome"] == emp.nome_completo
    finally:
        _cleanup(task_id)
        _delete_users(emp, ceo)
        delete_department(db, dept.id)
        db.close()


def test_reject_flow_then_restart() -> None:
    db = SessionLocal()
    dept = _dept(db)
    ceo = create_user(db, email="ceo_rej@teste.clop", role=UserRole.CEO)
    emp = create_user(db, email="emp_rej@teste.clop", departamento_id=dept.id)
    ceo_token = login("ceo_rej@teste.clop")
    emp_token = login("emp_rej@teste.clop")
    task_id = None
    try:
        created = client.post(
            "/api/tasks",
            json={"titulo": "Corrigir bug", "assigned_to": emp.id, "department_id": dept.id},
            headers=auth(ceo_token),
        )
        task_id = created.json()["id"]

        client.patch(f"/api/tasks/{task_id}/status", json={"status": TaskStatus.IN_PROGRESS}, headers=auth(emp_token))
        client.post(f"/api/tasks/{task_id}/submit", json={"progress": 100}, headers=auth(emp_token))

        rejected = client.post(
            f"/api/tasks/{task_id}/reject",
            json={"motivo": "Falta documentação da API"},
            headers=auth(ceo_token),
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == TaskStatus.REJECTED

        restart = client.patch(
            f"/api/tasks/{task_id}/status",
            json={"status": TaskStatus.IN_PROGRESS},
            headers=auth(emp_token),
        )
        assert restart.status_code == 200, restart.text

        re_doc = client.patch(
            f"/api/tasks/{task_id}/progress",
            json={"progress": 100, "descricao": "Documentação adicionada"},
            headers=auth(emp_token),
        )
        assert re_doc.json()["status"] == TaskStatus.SUBMITTED

        approved = client.post(f"/api/tasks/{task_id}/approve", headers=auth(ceo_token))
        assert approved.json()["status"] == TaskStatus.COMPLETED
    finally:
        _cleanup(task_id)
        _delete_users(emp, ceo)
        delete_department(db, dept.id)
        db.close()


def test_manager_cannot_delegate_outside_department() -> None:
    db = SessionLocal()
    dept_a = create_department(db, nome="TESTE Tasks A")
    dept_b = create_department(db, nome="TESTE Tasks B")
    mng = create_user(db, email="mng_t@teste.clop", role=UserRole.MANAGER, departamento_id=dept_a.id)
    outsider = create_user(db, email="out_t@teste.clop", departamento_id=dept_b.id)
    mng_token = login("mng_t@teste.clop")
    try:
        response = client.post(
            "/api/tasks",
            json={"titulo": "Vazar", "assigned_to": outsider.id},
            headers=auth(mng_token),
        )
        assert response.status_code == 403
    finally:
        _delete_users(mng, outsider)
        delete_department(db, dept_b.id)
        delete_department(db, dept_a.id)
        db.close()


def test_employee_cannot_create_task() -> None:
    db = SessionLocal()
    emp = create_user(db, email="emp_criar_t@teste.clop")
    token = login("emp_criar_t@teste.clop")
    try:
        response = client.post("/api/tasks", json={"titulo": "Criar tarefa ilegal"}, headers=auth(token))
        assert response.status_code == 403
    finally:
        delete_user(db, emp.id)
        db.close()


def test_employee_cannot_approve_own_task() -> None:
    db = SessionLocal()
    dept = _dept(db, "TESTE Tasks C")
    ceo = create_user(db, email="ceo_own@teste.clop", role=UserRole.CEO)
    emp = create_user(db, email="emp_own@teste.clop", departamento_id=dept.id)
    ceo_token = login("ceo_own@teste.clop")
    emp_token = login("emp_own@teste.clop")
    task_id = None
    try:
        created = client.post(
            "/api/tasks",
            json={"titulo": "Autoaprovar", "assigned_to": emp.id, "department_id": dept.id},
            headers=auth(ceo_token),
        )
        task_id = created.json()["id"]
        client.patch(f"/api/tasks/{task_id}/status", json={"status": TaskStatus.IN_PROGRESS}, headers=auth(emp_token))
        client.post(f"/api/tasks/{task_id}/submit", json={"progress": 100}, headers=auth(emp_token))

        approve = client.post(f"/api/tasks/{task_id}/approve", headers=auth(emp_token))
        assert approve.status_code == 403
    finally:
        _cleanup(task_id)
        _delete_users(emp, ceo)
        delete_department(db, dept.id)
        db.close()


def test_employee_sees_only_assigned_tasks() -> None:
    db = SessionLocal()
    dept = _dept(db, "TESTE Tasks D")
    ceo = create_user(db, email="ceo_seen@teste.clop", role=UserRole.CEO)
    emp_a = create_user(db, email="a_seen@teste.clop", departamento_id=dept.id)
    emp_b = create_user(db, email="b_seen@teste.clop", departamento_id=dept.id)
    ceo_token = login("ceo_seen@teste.clop")
    token_a = login("a_seen@teste.clop")
    t1 = t2 = None
    try:
        r1 = client.post("/api/tasks", json={"titulo": "Minha", "assigned_to": emp_a.id, "department_id": dept.id}, headers=auth(ceo_token))
        r2 = client.post("/api/tasks", json={"titulo": "Do outro", "assigned_to": emp_b.id, "department_id": dept.id}, headers=auth(ceo_token))
        t1, t2 = r1.json()["id"], r2.json()["id"]

        listing = client.get("/api/tasks", headers=auth(token_a))
        assert listing.status_code == 200
        ids = [t["id"] for t in listing.json()]
        assert t1 in ids
        assert t2 not in ids

        other = client.get(f"/api/tasks/{t2}", headers=auth(token_a))
        assert other.status_code == 403
    finally:
        _cleanup(t1, t2)
        _delete_users(emp_a, emp_b, ceo)
        delete_department(db, dept.id)
        db.close()


def test_overdue_marked_automatically() -> None:
    from datetime import datetime, timedelta

    from app.services.task_service import mark_overdue_tasks

    db = SessionLocal()
    dept = _dept(db, "TESTE Tasks E")
    ceo = create_user(db, email="ceo_over@teste.clop", role=UserRole.CEO)
    emp = create_user(db, email="emp_over@teste.clop", departamento_id=dept.id)
    ceo_token = login("ceo_over@teste.clop")
    task_id = None
    try:
        past = (datetime.now() - timedelta(days=1)).isoformat()
        created = client.post(
            "/api/tasks",
            json={
                "titulo": "Atrasada",
                "assigned_to": emp.id,
                "department_id": dept.id,
                "deadline": past,
            },
            headers=auth(ceo_token),
        )
        task_id = created.json()["id"]
        assert created.json()["status"] == TaskStatus.PENDING

        updated = mark_overdue_tasks(db)
        assert updated >= 1

        detail = client.get(f"/api/tasks/{task_id}", headers=auth(ceo_token))
        assert detail.json()["status"] == TaskStatus.OVERDUE
    finally:
        _cleanup(task_id)
        _delete_users(emp, ceo)
        delete_department(db, dept.id)
        db.close()