from app.core.database import SessionLocal
from tests.conftest import delete_department, delete_user
from app.models.department import Department
from app.models.user import User

db = SessionLocal()
try:
    users = db.query(User).filter(User.email.like("%@teste.clop")).all()
    for u in users:
        print("remover utilizador:", u.email)
        delete_user(db, u.id)
    depts = db.query(Department).filter(Department.nome.like("TESTE%")).all()
    for d in depts:
        print("remover departamento:", d.nome)
        delete_department(db, d.id)
    print("restantes @teste.clop:", db.query(User).filter(User.email.like("%@teste.clop")).count())
    print("restantes TESTE%:", db.query(Department).filter(Department.nome.like("TESTE%")).count())
finally:
    db.close()
