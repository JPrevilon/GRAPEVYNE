"""Add private tasting-memory fields to cellar entries.

Revision ID: 0002_prompt08_cellar_memories
Revises: 0001_prompt07_baseline
Create Date: 2026-08-02

"""

from alembic import op
import sqlalchemy as sa


revision = "0002_prompt08_cellar_memories"
down_revision = "0001_prompt07_baseline"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("cellar_entries", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("memory_title", sa.String(length=160), nullable=True)
        )
        batch_op.add_column(sa.Column("tasted_on", sa.Date(), nullable=True))
        batch_op.add_column(
            sa.Column("location", sa.String(length=240), nullable=True)
        )
        batch_op.add_column(
            sa.Column("pairing", sa.String(length=240), nullable=True)
        )
        batch_op.add_column(
            sa.Column("opened_with", sa.String(length=240), nullable=True)
        )
        batch_op.add_column(
            sa.Column("would_buy_again", sa.Boolean(), nullable=True)
        )


def downgrade():
    with op.batch_alter_table("cellar_entries", schema=None) as batch_op:
        batch_op.drop_column("would_buy_again")
        batch_op.drop_column("opened_with")
        batch_op.drop_column("pairing")
        batch_op.drop_column("location")
        batch_op.drop_column("tasted_on")
        batch_op.drop_column("memory_title")
