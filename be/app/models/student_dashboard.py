from app.extensions import db


class CourseEnrollment(db.Model):
    __tablename__ = "course_enrollments"
    __table_args__ = (
        db.Index("idx_course_enrollments_course", "course_id"),
    )

    student_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    course_id = db.Column(
        db.BigInteger, db.ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )
    enrolled_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    student = db.relationship("User", foreign_keys=[student_id])
    course = db.relationship("Course", back_populates="enrollments")


class Course(db.Model):
    __tablename__ = "courses"
    __table_args__ = (
        db.CheckConstraint(
            "semester IN ('fall', 'spring', 'summer')",
            name="courses_semester_check",
        ),
        db.Index("idx_courses_instructor", "instructor_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    instructor_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    microsoft_class_id = db.Column(db.String(255), unique=True)
    name = db.Column(db.String(255), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    semester = db.Column(db.String(10), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    instructor = db.relationship("User", foreign_keys=[instructor_id])
    enrollments = db.relationship(
        "CourseEnrollment", back_populates="course", passive_deletes=True
    )
    projects = db.relationship(
        "Project", back_populates="course", passive_deletes=True
    )


class Project(db.Model):
    __tablename__ = "projects"
    __table_args__ = (
        db.CheckConstraint(
            "min_members_per_team >= 1", name="chk_project_min_members"
        ),
        db.CheckConstraint(
            "max_members_per_team >= min_members_per_team",
            name="chk_project_max_members",
        ),
        db.Index("idx_projects_course", "course_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    deadline = db.Column(db.DateTime(timezone=True))
    min_members_per_team = db.Column(db.Integer, nullable=False)
    max_members_per_team = db.Column(db.Integer, nullable=False)
    prd = db.Column(db.Text, nullable=False, server_default="")
    requirements_file_key = db.Column(db.Text)
    requirements_original_name = db.Column(db.String(255))
    requirements_content_type = db.Column(db.String(255))
    requirements_size = db.Column(db.BigInteger)
    requirements_sha256 = db.Column(db.String(64))
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )

    course = db.relationship("Course", back_populates="projects")
    teams = db.relationship("Team", back_populates="project", passive_deletes=True)


class Team(db.Model):
    __tablename__ = "teams"
    __table_args__ = (
        db.UniqueConstraint("project_id", "name", name="uq_teams_project_name"),
        db.UniqueConstraint("id", "project_id", name="uq_teams_id_project"),
        db.Index("idx_teams_project", "project_id"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    project_id = db.Column(
        db.BigInteger, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.String(150), nullable=False)
    leader_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL")
    )
    status = db.Column(db.String(20), nullable=False, server_default="forming")
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )
    feedback = db.Column(db.Text)

    project = db.relationship("Project", back_populates="teams")
    members = db.relationship(
        "TeamMember", back_populates="team", passive_deletes=True
    )
    tasks = db.relationship("Task", back_populates="team", passive_deletes=True)


class TeamMember(db.Model):
    __tablename__ = "team_members"
    __table_args__ = (db.Index("idx_team_members_student", "student_id"),)

    team_id = db.Column(
        db.BigInteger, db.ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True
    )
    student_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.current_timestamp(),
    )
    last_read_at = db.Column(db.DateTime(timezone=True), nullable=True)

    team = db.relationship("Team", back_populates="members")
    student = db.relationship("User", foreign_keys=[student_id])


class Task(db.Model):
    __tablename__ = "tasks"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('todo', 'in_progress', 'review', 'done')",
            name="tasks_status_check",
        ),
        db.Index("idx_tasks_team", "team_id"),
        db.Index("idx_tasks_assignee", "assignee_id"),
        db.Index("idx_tasks_created_by", "created_by"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    team_id = db.Column(
        db.BigInteger, db.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    assignee_id = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by = db.Column(
        db.BigInteger, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
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
    title = db.Column(db.String(255), nullable=False)
    due_date = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), nullable=False, server_default="todo")
    description = db.Column(db.Text)

    team = db.relationship("Team", back_populates="tasks")
    assignee = db.relationship("User", foreign_keys=[assignee_id])
    creator = db.relationship("User", foreign_keys=[created_by])
