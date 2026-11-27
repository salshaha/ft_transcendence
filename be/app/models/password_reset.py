from app.extensions import db


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        db.Index("idx_password_reset_user", "user_id"),
        db.Index("idx_password_reset_expires_at", "expires_at"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = db.Column(db.String(255), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    user = db.relationship("User", foreign_keys=[user_id])