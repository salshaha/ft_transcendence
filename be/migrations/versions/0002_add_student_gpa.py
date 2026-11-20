"""Add the student_gpa table.

Revision ID: 0002_student_gpa
Revises: 0001_baseline
Create Date: 2026-11-20

The table is optional: a student without a row simply has no GPA available.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_student_gpa"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_gpa",
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("gpa", sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("gpa >= 0", name="chk_student_gpa_non_negative"),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("student_id"),
        if_not_exists=True,
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_student_gpa_updated_at ON student_gpa;
        CREATE TRIGGER trg_student_gpa_updated_at
        BEFORE UPDATE ON student_gpa
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade():
    op.execute(
        "DROP TRIGGER IF EXISTS trg_student_gpa_updated_at ON student_gpa"
    )
    op.drop_table("student_gpa", if_exists=True)
