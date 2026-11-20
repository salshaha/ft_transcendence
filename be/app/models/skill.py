from app.extensions import db


class Skill(db.Model):
    __tablename__ = "skills"
    __table_args__ = (
        db.CheckConstraint(
            "category IN ("
            "'interpersonal', 'technical', 'artistic', 'linguistic', 'other'"
            ")",
            name="skills_category_check",
        ),
        db.Index("idx_skills_created_by", "created_by"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    category = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )
    created_by = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL")
    )

    creator = db.relationship("User", foreign_keys=[created_by])
    student_skills = db.relationship(
        "StudentSkill", back_populates="skill", passive_deletes=True
    )


class StudentSkill(db.Model):
    __tablename__ = "student_skills"
    __table_args__ = (db.Index("idx_student_skills_skill", "skill_id"),)

    student_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    skill_id = db.Column(
        db.BigInteger,
        db.ForeignKey("skills.id", ondelete="CASCADE"),
        primary_key=True,
    )
    proficiency_level = db.Column(db.Integer, nullable=False)
    added_on = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    student = db.relationship(
        "User", back_populates="skills", foreign_keys=[student_id]
    )
    skill = db.relationship("Skill", back_populates="student_skills")
