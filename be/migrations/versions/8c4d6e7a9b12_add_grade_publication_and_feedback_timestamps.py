"""Add grade publication and peer feedback timestamps.

Revision ID: 8c4d6e7a9b12
Revises: 7a1c2b3d4e5f
Create Date: 2026-11-25
"""

from alembic import op
import sqlalchemy as sa


revision = "8c4d6e7a9b12"
down_revision = "7a1c2b3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table("peer_feedback", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            )
        )


def downgrade():
    with op.batch_alter_table("peer_feedback", schema=None) as batch_op:
        batch_op.drop_column("updated_at")
    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.drop_column("published_at")
