"""foto do utilizador persistente

Revision ID: b52f7516d6b0
Revises: b7c1d4e9a210
Create Date: 2026-10-11 18:51:22.800571

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b52f7516d6b0'
down_revision: Union[str, Sequence[str], None] = 'b7c1d4e9a210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("foto_mime", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("foto_data", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "foto_data")
    op.drop_column("users", "foto_mime")
