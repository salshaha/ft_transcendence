"""Add Microsoft tenant and object ID columns to users.

Revision ID: 7a1c2b3d4e5f
Revises: d4a7b2c9f013
Create Date: 2026-11-22
"""

from alembic import op
import sqlalchemy as sa


revision = "7a1c2b3d4e5f"
down_revision = "d4a7b2c9f013"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("microsoft_tenant_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("microsoft_object_id", sa.String(length=255), nullable=True))
        batch_op.drop_constraint("chk_users_authentication", type_="check")
        batch_op.create_check_constraint(
            "chk_users_authentication",
            "("
            "microsoft_tenant_id IS NOT NULL AND microsoft_object_id IS NOT NULL"
            ") OR microsoft_id IS NOT NULL OR password_hash IS NOT NULL",
        )
        batch_op.create_unique_constraint(
            "uq_users_microsoft_identity",
            ["microsoft_tenant_id", "microsoft_object_id"],
        )


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_microsoft_identity", type_="unique")
        batch_op.drop_constraint("chk_users_authentication", type_="check")
        batch_op.create_check_constraint(
            "chk_users_authentication",
            "microsoft_id IS NOT NULL OR password_hash IS NOT NULL",
        )
        batch_op.drop_column("microsoft_object_id")
        batch_op.drop_column("microsoft_tenant_id")
