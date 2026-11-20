from app.extensions import db


class StudentGPA(db.Model):
    __tablename__ = "student_gpa"
    __table_args__ = (
        db.CheckConstraint("gpa >= 0", name="chk_student_gpa_non_negative"),
    )

    student_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    gpa = db.Column(db.Numeric(4, 2), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    student = db.relationship("User", back_populates="gpa")
