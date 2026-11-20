from app.extensions import db


class Submission(db.Model):
    __tablename__ = "submissions"
    __table_args__ = (
        db.UniqueConstraint("team_id", name="uq_submissions_team"),
        db.Index("idx_submissions_team", "team_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    team_id = db.Column(
        db.BigInteger, db.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    submitted_by = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL")
    )
    file_key = db.Column(db.Text, nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(255), nullable=False)
    size = db.Column(db.BigInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    submitted_at = db.Column(
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

    team = db.relationship("Team", backref=db.backref("submission", uselist=False))
    submitter = db.relationship("User", foreign_keys=[submitted_by])