"""Bootstrap da base de dados: migrações Alembic e seed inicial.

Garante que qualquer ambiente (local, Render, novo) tem o esquema atualizado e
os utilizadores base, sem depender de comandos de deploy externos.
As operações são idempotentes e nunca impedem o arranque da aplicação.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.departments import DEPARTMENTS
from app.core.security import hash_password
from app.models.department import Department, DepartmentStatus
from app.models.user import User, UserRole, UserStatus

BACKEND_ROOT = Path(__file__).resolve().parents[2]
logger = logging.getLogger("clop")


def _ensure_departments(db: Session) -> None:
    for nome, descricao in DEPARTMENTS:
        exists = db.query(Department).filter(Department.nome == nome).first()
        if not exists:
            db.add(Department(nome=nome, descricao=descricao, estado=DepartmentStatus.ACTIVE))
            logger.info("Departamento criado: %s", nome)


def _ensure_user(
    db: Session,
    *,
    email: str,
    password: str,
    nome_completo: str,
    cargo: str,
    role: str,
    label: str,
) -> None:
    normalized = email.lower().strip()
    if not normalized or not password:
        logger.warning("%s ignorado: email ou password não definidos no ambiente", label)
        return

    user = db.query(User).filter(User.email == normalized).first()
    if user is not None:
        logger.info("%s já existe: %s", label, normalized)
        return

    db.add(
        User(
            nome_completo=nome_completo,
            email=normalized,
            password_hash=hash_password(password),
            password_changed_at=datetime.now(timezone.utc).replace(tzinfo=None),
            cargo=cargo,
            role=role,
            estado=UserStatus.ACTIVE,
            foto=settings.DEFAULT_AVATAR,
        )
    )
    logger.info("%s criado: %s", label, normalized)


def seed_database(db: Session) -> None:
    _ensure_departments(db)
    _ensure_user(
        db,
        email=settings.SEED_ADMIN_EMAIL,
        password=settings.SEED_ADMIN_PASSWORD,
        nome_completo="CEO Admin",
        cargo="CEO",
        role=UserRole.CEO,
        label="CEO Admin",
    )
    _ensure_user(
        db,
        email=settings.SEED_PCA_EMAIL,
        password=settings.SEED_PCA_PASSWORD,
        nome_completo=settings.SEED_PCA_NAME,
        cargo="Presidente do Conselho de Administração",
        role=UserRole.PCA,
        label="PCA",
    )
    db.commit()


def apply_migrations() -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(config, "head")


def run_startup_bootstrap() -> None:
    if not settings.BOOTSTRAP_ON_STARTUP:
        logger.info("Bootstrap no arranque desativado (BOOTSTRAP_ON_STARTUP=false)")
        return

    try:
        apply_migrations()
        logger.info("Migrações Alembic aplicadas")
    except Exception:
        logger.exception("Falha ao aplicar migrações no arranque")

    db = SessionLocal()
    try:
        seed_database(db)
    except Exception:
        db.rollback()
        logger.exception("Falha no seed inicial")
    finally:
        db.close()
