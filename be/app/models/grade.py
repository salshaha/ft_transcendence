from app.extensions import db


class Grade(db.Model):
    __tablename__ = "grades"
    __table_args__ = (
        db.UniqueConstraint("student_id", "project_id", name="uq_grades_student_project"),
        db.CheckConstraint("grade >= 0", name="chk_grades_nonnegative"),
        db.Index("idx_grades_project", "project_id"),
        db.Index("idx_grades_student", "student_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    student_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id = db.Column(
        db.BigInteger, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    grade = db.Column(db.Numeric(5, 2))
    feedback = db.Column(db.Text)
    published = db.Column(db.Boolean, nullable=False, server_default=db.false())
    published_at = db.Column(db.DateTime(timezone=True))
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

    student = db.relationship("User", foreign_keys=[student_id])
    project = db.relationship("Project", foreign_keys=[project_id])


class GradeAudit(db.Model):
    __tablename__ = "grade_audits"
    __table_args__ = (db.Index("idx_grade_audits_grade", "grade_id"),)

    id = db.Column(db.BigInteger, primary_key=True)
    grade_id = db.Column(
        db.BigInteger, db.ForeignKey("grades.id", ondelete="CASCADE"), nullable=False
    )
    changed_by = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL")
    )
    old_grade = db.Column(db.Numeric(5, 2))
    new_grade = db.Column(db.Numeric(5, 2))
    old_feedback = db.Column(db.Text)
    new_feedback = db.Column(db.Text)
    changed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    grade = db.relationship("Grade", backref=db.backref("audits", passive_deletes=True))
    changer = db.relationship("User", foreign_keys=[changed_by])