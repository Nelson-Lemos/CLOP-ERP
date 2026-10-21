"""colunas de preco e revisao em trading_trades e tabelas de evidencias/revisoes

Revision ID: f4b2c7d91a36
Revises: c9e2f7a41d05
Create Date: 2026-10-20 15:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b2c7d91a36'
down_revision: Union[str, Sequence[str], None] = 'c9e2f7a41d05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trading_trades', sa.Column('preco_entrada', sa.Numeric(14, 6), nullable=True))
    op.add_column('trading_trades', sa.Column('preco_stop', sa.Numeric(14, 6), nullable=True))
    op.add_column('trading_trades', sa.Column('preco_alvo', sa.Numeric(14, 6), nullable=True))
    op.add_column('trading_trades', sa.Column('preco_saida', sa.Numeric(14, 6), nullable=True))
    op.add_column('trading_trades', sa.Column('hora_entrada', sa.DateTime(), nullable=True))
    op.add_column('trading_trades', sa.Column('hora_saida', sa.DateTime(), nullable=True))
    op.add_column('trading_trades', sa.Column('tamanho_lote', sa.Numeric(12, 4), nullable=True))
    op.add_column(
        'trading_trades',
        sa.Column('revisao_estado', sa.String(20), nullable=False, server_default=sa.text("'NAO_REVISADA'")),
    )
    op.add_column('trading_trades', sa.Column('revisao_por', sa.Integer(), nullable=True))
    op.add_column('trading_trades', sa.Column('revisao_em', sa.DateTime(), nullable=True))
    op.add_column('trading_trades', sa.Column('revisao_comentario', sa.Text(), nullable=True))
    op.add_column(
        'trading_trades',
        sa.Column('divergencia_plano', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f('ix_trading_trades_revisao_estado'), 'trading_trades', ['revisao_estado'], unique=False)
    op.create_foreign_key(
        'fk_trading_trades_revisao_por', 'trading_trades', 'users', ['revisao_por'], ['id']
    )

    op.create_table(
        'trading_evidences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('trade_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(10), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=True),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('alerta_hash_duplicado', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alerta_upload_tardio', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trade_id'], ['trading_trades.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trading_evidences_trade_id'), 'trading_evidences', ['trade_id'], unique=False)
    op.create_index(op.f('ix_trading_evidences_user_id'), 'trading_evidences', ['user_id'], unique=False)
    op.create_index(op.f('ix_trading_evidences_sha256'), 'trading_evidences', ['sha256'], unique=False)

    op.create_table(
        'trading_reviews',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('trade_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('comentario', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trade_id'], ['trading_trades.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trading_reviews_trade_id'), 'trading_reviews', ['trade_id'], unique=False)
    op.create_index(op.f('ix_trading_reviews_user_id'), 'trading_reviews', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_trading_reviews_user_id'), table_name='trading_reviews')
    op.drop_index(op.f('ix_trading_reviews_trade_id'), table_name='trading_reviews')
    op.drop_table('trading_reviews')
    op.drop_index(op.f('ix_trading_evidences_sha256'), table_name='trading_evidences')
    op.drop_index(op.f('ix_trading_evidences_user_id'), table_name='trading_evidences')
    op.drop_index(op.f('ix_trading_evidences_trade_id'), table_name='trading_evidences')
    op.drop_table('trading_evidences')
    op.drop_constraint('fk_trading_trades_revisao_por', 'trading_trades', type_='foreignkey')
    op.drop_index(op.f('ix_trading_trades_revisao_estado'), table_name='trading_trades')
    op.drop_column('trading_trades', 'divergencia_plano')
    op.drop_column('trading_trades', 'revisao_comentario')
    op.drop_column('trading_trades', 'revisao_em')
    op.drop_column('trading_trades', 'revisao_por')
    op.drop_column('trading_trades', 'revisao_estado')
    op.drop_column('trading_trades', 'tamanho_lote')
    op.drop_column('trading_trades', 'hora_saida')
    op.drop_column('trading_trades', 'hora_entrada')
    op.drop_column('trading_trades', 'preco_saida')
    op.drop_column('trading_trades', 'preco_alvo')
    op.drop_column('trading_trades', 'preco_stop')
    op.drop_column('trading_trades', 'preco_entrada')
