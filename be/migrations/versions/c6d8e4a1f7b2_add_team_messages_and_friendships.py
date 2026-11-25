from alembic import op
import sqlalchemy as sa


revision = "c6d8e4a1f7b2"
down_revision = "f3b9c2d4e6a8"
branch_labels = None
depends_on = None


def _team_member_columns():
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("team_members")}


def upgrade():
    op.create_table(
        "team_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "team_id",
            sa.BigInteger(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_team_messages_team_created",
        "team_messages",
        ["team_id", "created_at"],
    )
    op.create_index("idx_team_messages_sender", "team_messages", ["sender_id"])

    op.create_table(
        "friend_requests",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "requester_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')",
            name="chk_friend_requests_status",
        ),
        sa.CheckConstraint(
            "requester_id <> recipient_id",
            name="chk_friend_requests_distinct_users",
        ),
        sa.UniqueConstraint(
            "requester_id",
            "recipient_id",
            name="uq_friend_requests_pair",
        ),
    )
    op.create_index(
        "idx_friend_requests_recipient",
        "friend_requests",
        ["recipient_id", "status"],
    )
    op.create_index(
        "idx_friend_requests_requester",
        "friend_requests",
        ["requester_id", "status"],
    )

    op.create_table(
        "friendships",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "friend_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "user_id <> friend_id",
            name="chk_friendships_distinct_users",
        ),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friendships_pair"),
    )
    op.create_index("idx_friendships_user", "friendships", ["user_id"])

    if "last_read_at" not in _team_member_columns():
        with op.batch_alter_table("team_members", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True)
            )


def downgrade():
    if "last_read_at" in _team_member_columns():
        with op.batch_alter_table("team_members", schema=None) as batch_op:
            batch_op.drop_column("last_read_at")
    op.drop_table("friendships")
    op.drop_table("friend_requests")
    op.drop_table("team_messages")
