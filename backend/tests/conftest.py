import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.audit import AuditLog
from app.models.department import Department, DepartmentStatus
from app.models.user import User, UserRole, UserStatus

client = TestClient(app)


def db_session():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()


def create_user(
    db,
    *,
    nome_completo: str = "Teste Utilizador",
    email: str,
    password: str = "TestePass123!",
    estado: str = UserStatus.ACTIVE,
    role: str = UserRole.EMPLOYEE,
    departamento_id: int | None = None,
) -> User:
    user = User(
        nome_completo=nome_completo,
        email=email,
        password_hash=hash_password(password),
        role=role,
        estado=estado,
        departamento_id=departamento_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db, user_id: int) -> None:
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    from app.models.attachment import Attachment
    from app.models.notification import Notification
    from app.models.task import Task, TaskHistory, TaskReview, TaskUpdate

    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.query(TaskHistory).filter(TaskHistory.user_id == user_id).update({"user_id": None})
    db.query(TaskUpdate).filter(TaskUpdate.user_id == user_id).delete()
    db.query(TaskReview).filter(TaskReview.reviewed_by == user_id).delete()
    db.query(Attachment).filter(Attachment.user_id == user_id).delete()
    db.query(Task).filter(Task.assigned_to == user_id).update({"assigned_to": None})
    for t in db.query(Task).filter(Task.created_by == user_id).all():
        db.delete(t)
    user = db.query(User).filter(User.id == user_id).first()
    if user is not None:
        db.delete(user)
    db.commit()


def create_department(db, *, nome: str, manager_id: int | None = None) -> Department:
    dept = Department(
        nome=nome,
        descricao=f"Departamento {nome}",
        manager_id=manager_id,
        estado=DepartmentStatus.ACTIVE,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db, dept_id: int) -> None:
    db.query(Department).filter(Department.id == dept_id).delete()
    db.commit()


def login(email: str, password: str = "TestePass123!") -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def ceo():
    db = SessionLocal()
    leftover_users = db.query(User).filter(User.email.like("%@teste.clop")).all()
    for u in leftover_users:
        delete_user(db, u.id)
    from app.models.department import Department

    for d in db.query(Department).filter(Department.nome.like("TESTE%")).all():
        db.delete(d)
    db.commit()
    user = create_user(db, email="ceo_teste@teste.clop", role=UserRole.CEO)
    yield {"user": user, "token": login("ceo_teste@teste.clop")}
    delete_user(db, user.id)
    db.close()