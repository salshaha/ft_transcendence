"""add project status

Revision ID: 1f4a2b6c8d90
Revises: a7f3c1e9d4b2
Create Date: 2026-11-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "1f4a2b6c8d90"
down_revision = "a7f3c1e9d4b2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default="todo",
            )
        )
    op.execute(
        "UPDATE projects SET status = 'todo' "
        "WHERE status IS NULL OR status NOT IN "
        "('todo', 'in_progress', 'review', 'done')"
    )
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "chk_projects_status",
            "status IN ('todo', 'in_progress', 'review', 'done')",
        )


def downgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_check_constraint("chk_projects_status")
        batch_op.drop_column("status")
