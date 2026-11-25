from app.extensions import db


class TaskComment(db.Model):
    __tablename__ = "task_comments"
    __table_args__ = (
        db.CheckConstraint(
            "kind IN ('comment', 'instructor_feedback')",
            name="chk_task_comments_kind",
        ),
        db.Index("idx_task_comments_task", "task_id"),
        db.Index("idx_task_comments_author", "author_id"),
        db.Index("idx_task_comments_task_kind", "task_id", "kind"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    task_id = db.Column(
        db.BigInteger, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    author_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body = db.Column(db.Text, nullable=False)
    kind = db.Column(
        db.String(20), nullable=False, default="comment", server_default="comment"
    )
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

    task = db.relationship("Task")
    author = db.relationship("User", foreign_keys=[author_id])


class TaskAttachment(db.Model):
    __tablename__ = "task_attachments"
    __table_args__ = (
        db.Index("idx_task_attachments_task", "task_id"),
        db.Index("idx_task_attachments_uploader", "uploader_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    task_id = db.Column(
        db.BigInteger, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    uploader_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    file_key = db.Column(db.Text, nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(255), nullable=False)
    size = db.Column(db.BigInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    task = db.relationship("Task")
    uploader = db.relationship("User", foreign_keys=[uploader_id])
