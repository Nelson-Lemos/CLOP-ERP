"""aumenta a capacidade de armazenamento das fotografias

Revision ID: ee7c30a14f92
Revises: b52f7516d6b0
Create Date: 2026-10-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = "ee7c30a14f92"
down_revision: Union[str, Sequence[str], None] = "b52f7516d6b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "mysql":
        op.alter_column(
            "users",
            "foto_data",
            existing_type=mysql.BLOB(),
            type_=mysql.MEDIUMBLOB(),
            existing_nullable=True,
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "mysql":
        op.alter_column(
            "users",
            "foto_data",
            existing_type=mysql.MEDIUMBLOB(),
            type_=mysql.BLOB(),
            existing_nullable=True,
        )
