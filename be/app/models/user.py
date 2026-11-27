from app.extensions import db


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint(
            "role IN ('student', 'instructor', 'admin')",
            name="users_role_check",
        ),
        db.CheckConstraint(
            "("
            "microsoft_tenant_id IS NOT NULL AND microsoft_object_id IS NOT NULL"
            ") OR microsoft_id IS NOT NULL OR password_hash IS NOT NULL",
            name="chk_users_authentication",
        ),
        db.UniqueConstraint(
            "microsoft_tenant_id",
            "microsoft_object_id",
            name="uq_users_microsoft_identity",
        ),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    microsoft_id = db.Column(db.String(255), unique=True)
    microsoft_tenant_id = db.Column(db.String(255))
    microsoft_object_id = db.Column(db.String(255))
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    major = db.Column(db.String(150))
    joined_year = db.Column(db.Integer)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.Text)
    session_version = db.Column(
        db.Integer, nullable=False, default=1, server_default="1"
    )
    profile_picture = db.Column(db.Text)
    role = db.Column(db.String(20), nullable=False)
    student_id = db.Column(db.String(50), unique=True)
    domain = db.Column(db.String(100))
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

    gpa = db.relationship(
        "StudentGPA",
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    skills = db.relationship(
        "StudentSkill",
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
