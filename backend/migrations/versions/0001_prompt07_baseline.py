"""Record the accepted Prompt 07 database baseline.

Revision ID: 0001_prompt07_baseline
Revises:
Create Date: 2026-08-02

"""

from alembic import op
import sqlalchemy as sa


revision = "0001_prompt07_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "wines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_api_id", sa.String(length=160), nullable=True),
        sa.Column("source", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("winery", sa.String(length=255), nullable=True),
        sa.Column("varietal", sa.String(length=120), nullable=True),
        sa.Column("region", sa.String(length=160), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("vintage", sa.String(length=40), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("average_rating", sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source",
            "external_api_id",
            name="uq_wines_source_external_api_id",
        ),
    )
    op.create_index(
        op.f("ix_wines_external_api_id"),
        "wines",
        ["external_api_id"],
        unique=False,
    )

    op.create_table(
        "cellar_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("wine_id", sa.Integer(), nullable=False),
        sa.Column("user_rating", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("favorite", sa.Boolean(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("occasion", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "(user_rating IS NULL) OR (user_rating BETWEEN 1 AND 5)",
            name="ck_cellar_entries_user_rating_range",
        ),
        sa.CheckConstraint(
            "status IN ('saved', 'tasted', 'wishlist', 'buy_again', 'archived')",
            name="ck_cellar_entries_status",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["wine_id"],
            ["wines.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "wine_id",
            name="uq_cellar_entries_user_wine",
        ),
    )
    op.create_index(
        op.f("ix_cellar_entries_user_id"),
        "cellar_entries",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cellar_entries_wine_id"),
        "cellar_entries",
        ["wine_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_cellar_entries_wine_id"), table_name="cellar_entries")
    op.drop_index(op.f("ix_cellar_entries_user_id"), table_name="cellar_entries")
    op.drop_table("cellar_entries")
    op.drop_index(op.f("ix_wines_external_api_id"), table_name="wines")
    op.drop_table("wines")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
