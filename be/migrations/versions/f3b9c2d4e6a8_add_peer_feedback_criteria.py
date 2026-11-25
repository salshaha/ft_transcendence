"""Repair peer feedback schema for structured criteria.

Revision ID: f3b9c2d4e6a8
Revises: 8c4d6e7a9b12
Create Date: 2026-11-25
"""

from alembic import op
import sqlalchemy as sa


revision = "f3b9c2d4e6a8"
down_revision = "8c4d6e7a9b12"
branch_labels = None
depends_on = None


def _peer_feedback_columns():
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("peer_feedback")}


def upgrade():
    columns = _peer_feedback_columns()
    with op.batch_alter_table("peer_feedback", schema=None) as batch_op:
        if "updated_at" not in columns:
            batch_op.add_column(
                sa.Column(
                    "updated_at",
                    sa.DateTime(timezone=True),
                    server_default=sa.func.current_timestamp(),
                    nullable=False,
                )
            )
        if "criteria" not in columns:
            batch_op.add_column(sa.Column("criteria", sa.JSON(), nullable=True))


def downgrade():
    columns = _peer_feedback_columns()
    with op.batch_alter_table("peer_feedback", schema=None) as batch_op:
        if "criteria" in columns:
            batch_op.drop_column("criteria")
        if "updated_at" in columns:
            batch_op.drop_column("updated_at")
