"""mÃ³dulo operador trading

Revision ID: c9e2f7a41d05
Revises: ee7c30a14f92
Create Date: 2026-10-19 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e2f7a41d05'
down_revision: Union[str, Sequence[str], None] = 'ee7c30a14f92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trading_accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('operator_id', sa.Integer(), nullable=False),
        sa.Column('data_abertura', sa.Date(), nullable=False),
        sa.Column('saldo_inicial', sa.Numeric(14, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trading_accounts_operator_id'), 'trading_accounts', ['operator_id'], unique=True)

    op.create_table(
        'trading_months',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('operator_id', sa.Integer(), nullable=False),
        sa.Column('ano', sa.Integer(), nullable=False),
        sa.Column('mes', sa.Integer(), nullable=False),
        sa.Column('depositos', sa.Numeric(14, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('saques', sa.Numeric(14, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('bonus', sa.Numeric(14, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('operator_id', 'ano', 'mes', name='uq_trading_months_operator_ano_mes'),
    )
    op.create_index(op.f('ix_trading_months_operator_id'), 'trading_months', ['operator_id'], unique=False)

    op.create_table(
        'trading_checklists',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('operator_id', sa.Integer(), nullable=False),
        sa.Column('data_pregao', sa.Date(), nullable=False),
        sa.Column('s01_sono', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s01_fisico', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s01_emocional', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s01_plano', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s01_gestao_risco', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s02_pre_trading', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s02_atividade', sa.Text(), nullable=True),
        sa.Column('s03_noticias', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s03_360', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s03_ativos', sa.Text(), nullable=True),
        sa.Column('s05_planilha', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s05_gerenciamento', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s05_seguimento', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('s05_nota', sa.Integer(), nullable=True),
        sa.Column('s05_aprendizado', sa.Text(), nullable=True),
        sa.Column('precheck_concluido', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('fechado', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('fechado_em', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('operator_id', 'data_pregao', name='uq_trading_checklists_operator_data'),
    )
    op.create_index(op.f('ix_trading_checklists_operator_id'), 'trading_checklists', ['operator_id'], unique=False)
    op.create_index(op.f('ix_trading_checklists_data_pregao'), 'trading_checklists', ['data_pregao'], unique=False)

    op.create_table(
        'trading_trades',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('operator_id', sa.Integer(), nullable=False),
        sa.Column('data_operacao', sa.Date(), nullable=False),
        sa.Column('ativo', sa.String(30), nullable=False),
        sa.Column('direcao', sa.String(10), nullable=False),
        sa.Column('estado', sa.String(20), server_default=sa.text("'PENDENTE'"), nullable=False),
        sa.Column('valor_finaneiro', sa.Numeric(14, 2), nullable=True),
        sa.Column('risco_retorno', sa.Numeric(6, 2), nullable=True),
        sa.Column('seguiu_plano', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('mindset', sa.String(30), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trading_trades_operator_id'), 'trading_trades', ['operator_id'], unique=False)
    op.create_index(op.f('ix_trading_trades_data_operacao'), 'trading_trades', ['data_operacao'], unique=False)
    op.create_index(op.f('ix_trading_trades_estado'), 'trading_trades', ['estado'], unique=False)

    op.create_table(
        'trading_methods',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('trade_id', sa.Integer(), nullable=False),
        sa.Column('passo1_captura_liquidez', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('macro_direcao', sa.String(10), nullable=True),
        sa.Column('macro_vies', sa.String(20), nullable=True),
        sa.Column('mediana_corretivo', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('mediana_regiao', sa.String(10), nullable=True),
        sa.Column('mediana_captura_asia', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('micro_capturou_liquidez', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('micro_reagiu_poi', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('micro_ineficiencia', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('micro_quebrou_estrutura', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('proj_fibonacci', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('proj_ote', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('proj_order_blocks', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('proj_fvg', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('entrada_aguardou_interna', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('entrada_captura_interna', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('entrada_reagiu_ob', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('entrada_executada', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('ger_stop_110', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alvo_fib_extensao', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alvo_liquidez_externa', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alvo_pdl_pdh', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alvo_asia', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('alvo_ponto_parada', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trade_id'], ['trading_trades.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trading_methods_trade_id'), 'trading_methods', ['trade_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_trading_methods_trade_id'), table_name='trading_methods')
    op.drop_table('trading_methods')
    op.drop_index(op.f('ix_trading_trades_estado'), table_name='trading_trades')
    op.drop_index(op.f('ix_trading_trades_data_operacao'), table_name='trading_trades')
    op.drop_index(op.f('ix_trading_trades_operator_id'), table_name='trading_trades')
    op.drop_table('trading_trades')
    op.drop_index(op.f('ix_trading_checklists_data_pregao'), table_name='trading_checklists')
    op.drop_index(op.f('ix_trading_checklists_operator_id'), table_name='trading_checklists')
    op.drop_table('trading_checklists')
    op.drop_index(op.f('ix_trading_months_operator_id'), table_name='trading_months')
    op.drop_table('trading_months')
    op.drop_index(op.f('ix_trading_accounts_operator_id'), table_name='trading_accounts')
    op.drop_table('trading_accounts')
