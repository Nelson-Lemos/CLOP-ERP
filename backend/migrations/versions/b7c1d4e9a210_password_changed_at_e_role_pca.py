"""password_changed_at e role PCA

Revision ID: b7c1d4e9a210
Revises: 55d505098f1f
Create Date: 2026-09-28 10:12:44.913077

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c1d4e9a210'
down_revision: Union[str, Sequence[str], None] = '55d505098f1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_changed_at')
