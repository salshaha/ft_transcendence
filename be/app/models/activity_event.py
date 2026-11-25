from app.extensions import db


class ActivityEvent(db.Model):
    __tablename__ = "activity_events"
    __table_args__ = (
        db.Index("idx_activity_events_created_at", "created_at"),
        db.Index("idx_activity_events_actor_created", "actor_user_id", "created_at"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    actor_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action = db.Column(db.String(64), nullable=False)
    entity_type = db.Column(db.String(40), nullable=False)
    entity_id = db.Column(db.String(64))
    details = db.Column(db.JSON)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    actor = db.relationship("User", foreign_keys=[actor_user_id])
