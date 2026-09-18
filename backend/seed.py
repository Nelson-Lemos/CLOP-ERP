from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.department import Department, DepartmentStatus
from app.models.user import User, UserRole, UserStatus

DEPARTMENTS = [
    ("Tecnologia", "Desenvolvimento e infraestrutura tecnológica"),
    ("Trading", "Operações de trading e investimentos"),
    ("Financeiro", "Gestão financeira e contabilidade"),
    ("Marketing", "Comunicação e marketing"),
    ("Recursos Humanos", "Gestão de pessoas"),
    ("Operações", "Operações gerais da empresa"),
]


def seed() -> None:
    db: Session = SessionLocal()
    try:
        for nome, descricao in DEPARTMENTS:
            exists = db.query(Department).filter(Department.nome == nome).first()
            if not exists:
                db.add(Department(nome=nome, descricao=descricao, estado=DepartmentStatus.ACTIVE))
                print(f"Departamento criado: {nome}")

        email = settings.SEED_ADMIN_EMAIL.lower()
        admin = db.query(User).filter(User.email == email).first()
        if not admin:
            admin = User(
                nome_completo="CEO Admin",
                email=email,
                password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
                cargo="CEO",
                role=UserRole.CEO,
                estado=UserStatus.ACTIVE,
                foto=settings.DEFAULT_AVATAR,
            )
            db.add(admin)
            print(f"CEO Admin criado: {email}")
        else:
            print("CEO Admin já existe.")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()