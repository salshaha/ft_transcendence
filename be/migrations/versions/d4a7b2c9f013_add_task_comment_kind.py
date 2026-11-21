import sqlalchemy as sa
from alembic import op

revision = "d4a7b2c9f013"
down_revision = "c3f9a1d7e2b4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("task_comments", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                sa.String(length=20),
                nullable=False,
                server_default="comment",
            )
        )
        batch_op.create_check_constraint(
            "chk_task_comments_kind",
            "kind IN ('comment', 'instructor_feedback')",
        )
        batch_op.create_index(
            "idx_task_comments_task_kind", ["task_id", "kind"], unique=False
        )


def downgrade():
    with op.batch_alter_table("task_comments", schema=None) as batch_op:
        batch_op.drop_index("idx_task_comments_task_kind")
        batch_op.drop_constraint("chk_task_comments_kind", type_="check")
        batch_op.drop_column("kind")
