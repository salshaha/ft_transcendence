import sqlalchemy as sa
from alembic import op

revision = "e5b8c9d2a1f4"
down_revision = "7a1c2b3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "max_grade",
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default=sa.text("100"),
            )
        )
    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "published_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )


def downgrade():
    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.drop_column("published_at")
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_column("max_grade")
