from app.extensions import db


class PeerFeedback(db.Model):
    __tablename__ = "peer_feedback"
    __table_args__ = (
        db.UniqueConstraint(
            "project_id", "from_student_id", "to_student_id",
            name="uq_peer_feedback_project_from_to",
        ),
        db.Index("idx_peer_feedback_project", "project_id"),
        db.Index("idx_peer_feedback_to", "to_student_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    project_id = db.Column(
        db.BigInteger, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    from_student_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_student_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating = db.Column(db.Integer)
    feedback = db.Column(db.Text)
    criteria = db.Column(db.JSON, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    project = db.relationship("Project", foreign_keys=[project_id])
    author = db.relationship("User", foreign_keys=[from_student_id])
    recipient = db.relationship("User", foreign_keys=[to_student_id])