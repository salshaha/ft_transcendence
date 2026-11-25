from app.extensions import db


class TeamMessage(db.Model):
    __tablename__ = "team_messages"
    __table_args__ = (
        db.Index("idx_team_messages_team_created", "team_id", "created_at"),
        db.Index("idx_team_messages_sender", "sender_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    team_id = db.Column(
        db.BigInteger,
        db.ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    team = db.relationship("Team")
    sender = db.relationship("User", foreign_keys=[sender_id])


class FriendRequest(db.Model):
    __tablename__ = "friend_requests"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')",
            name="chk_friend_requests_status",
        ),
        db.CheckConstraint(
            "requester_id <> recipient_id",
            name="chk_friend_requests_distinct_users",
        ),
        db.UniqueConstraint(
            "requester_id",
            "recipient_id",
            name="uq_friend_requests_pair",
        ),
        db.Index("idx_friend_requests_recipient", "recipient_id", "status"),
        db.Index("idx_friend_requests_requester", "requester_id", "status"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    requester_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    recipient_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = db.Column(
        db.String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )
    responded_at = db.Column(db.DateTime(timezone=True), nullable=True)

    requester = db.relationship("User", foreign_keys=[requester_id])
    recipient = db.relationship("User", foreign_keys=[recipient_id])


class Friendship(db.Model):
    __tablename__ = "friendships"
    __table_args__ = (
        db.CheckConstraint(
            "user_id <> friend_id",
            name="chk_friendships_distinct_users",
        ),
        db.UniqueConstraint("user_id", "friend_id", name="uq_friendships_pair"),
        db.Index("idx_friendships_user", "user_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    friend_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    user = db.relationship("User", foreign_keys=[user_id])
    friend = db.relationship("User", foreign_keys=[friend_id])
