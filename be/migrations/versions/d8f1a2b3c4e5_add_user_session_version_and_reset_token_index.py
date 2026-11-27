"""Add user session_version for password-reset invalidation and merge heads.

Revision ID: d8f1a2b3c4e5
Revises: a7f3c1e9d4b2, b3a91d8702f4, c6d8e4a1f7b2
Create Date: 2026-11-27

"""

import sqlalchemy as sa
from alembic import op

revision = "d8f1a2b3c4e5"
down_revision = ("a7f3c1e9d4b2", "b3a91d8702f4", "c6d8e4a1f7b2")
branch_labels = None
depends_on = None


def _column_names(table):
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _index_names(table):
    return {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade():
    if "session_version" not in _column_names("users"):
        op.add_column(
            "users",
            sa.Column(
                "session_version",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            ),
        )

    existing_indexes = _index_names("password_reset_tokens")
    if "idx_password_reset_user" not in existing_indexes:
        op.create_index(
            "idx_password_reset_user",
            "password_reset_tokens",
            ["user_id"],
            unique=False,
        )
    if "idx_password_reset_expires_at" not in existing_indexes:
        op.create_index(
            "idx_password_reset_expires_at",
            "password_reset_tokens",
            ["expires_at"],
            unique=False,
        )


def downgrade():
    existing_indexes = _index_names("password_reset_tokens")
    if "idx_password_reset_expires_at" in existing_indexes:
        op.drop_index(
            "idx_password_reset_expires_at",
            table_name="password_reset_tokens",
        )

    if "session_version" in _column_names("users"):
        op.drop_column("users", "session_version")
