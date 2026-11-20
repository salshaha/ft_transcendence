"""Baseline schema for the tables that predate Flask-Migrate.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-20

The project also ships sql/sql-schema.sql as a PostgreSQL init script. To keep
both bootstrap paths working, every table/index in this baseline is created
with IF NOT EXISTS. Databases initialized by the SQL script can therefore run
``flask db upgrade`` without a manual stamp, while a completely empty database
is created from this migration.

All triggers and functions are created with CREATE OR REPLACE / DROP IF EXISTS
for the same reason.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("microsoft_id", sa.String(length=255), unique=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("major", sa.String(length=150)),
        sa.Column("joined_year", sa.Integer()),
        sa.Column("student_id", sa.String(length=50), unique=True),
        sa.Column("domain", sa.String(length=100)),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text()),
        sa.Column("profile_picture", sa.Text()),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "role IN ('student', 'instructor', 'admin')",
            name="users_role_check",
        ),
        sa.CheckConstraint(
            "microsoft_id IS NOT NULL OR password_hash IS NOT NULL",
            name="chk_users_authentication",
        ),
        if_not_exists=True,
    )

    op.create_table(
        "courses",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("instructor_id", sa.BigInteger(), nullable=False),
        sa.Column("microsoft_class_id", sa.String(length=255), unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("academic_year", sa.String(length=20), nullable=False),
        sa.Column("semester", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "semester IN ('fall', 'spring', 'summer')",
            name="courses_semester_check",
        ),
        sa.ForeignKeyConstraint(
            ["instructor_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        if_not_exists=True,
    )

    op.create_table(
        "course_enrollments",
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("student_id", "course_id"),
        if_not_exists=True,
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("course_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("min_members_per_team", sa.Integer(), nullable=False),
        sa.Column("max_members_per_team", sa.Integer(), nullable=False),
        sa.Column("prd", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "min_members_per_team >= 1", name="chk_project_min_members"
        ),
        sa.CheckConstraint(
            "max_members_per_team >= min_members_per_team",
            name="chk_project_max_members",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        if_not_exists=True,
    )

    op.create_table(
        "teams",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("feedback", sa.Text()),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "name", name="uq_teams_project_name"),
        sa.UniqueConstraint("id", "project_id", name="uq_teams_id_project"),
        if_not_exists=True,
    )

    op.create_table(
        "team_members",
        sa.Column("team_id", sa.BigInteger(), nullable=False),
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["team_id"], ["teams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("team_id", "student_id"),
        if_not_exists=True,
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("team_id", sa.BigInteger(), nullable=False),
        sa.Column("assignee_id", sa.BigInteger()),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'todo'"),
        ),
        sa.Column("description", sa.Text()),
        sa.CheckConstraint(
            "status IN ('todo', 'in_progress', 'review', 'done')",
            name="tasks_status_check",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"], ["teams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="RESTRICT"
        ),
        if_not_exists=True,
    )

    op.create_table(
        "skills",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("created_by", sa.BigInteger()),
        sa.CheckConstraint(
            "category IN ("
            "'interpersonal', 'technical', 'artistic', 'linguistic', 'other'"
            ")",
            name="skills_category_check",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        if_not_exists=True,
    )

    op.create_table(
        "student_skills",
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("skill_id", sa.BigInteger(), nullable=False),
        sa.Column("proficiency_level", sa.Integer(), nullable=False),
        sa.Column(
            "added_on",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["skill_id"], ["skills.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("student_id", "skill_id"),
        if_not_exists=True,
    )

    op.create_index(
        "idx_courses_instructor",
        "courses",
        ["instructor_id"],
        if_not_exists=True,
    )
    op.create_index(
        "idx_course_enrollments_course",
        "course_enrollments",
        ["course_id"],
        if_not_exists=True,
    )
    op.create_index(
        "idx_teams_project",
        "teams",
        ["project_id"],
        if_not_exists=True,
    )
    op.create_index(
        "idx_team_members_student",
        "team_members",
        ["student_id"],
        if_not_exists=True,
    )
    op.create_index(
        "idx_tasks_team", "tasks", ["team_id"], if_not_exists=True
    )
    op.create_index(
        "idx_tasks_assignee", "tasks", ["assignee_id"], if_not_exists=True
    )
    op.create_index(
        "idx_tasks_created_by", "tasks", ["created_by"], if_not_exists=True
    )
    op.create_index(
        "idx_skills_created_by", "skills", ["created_by"], if_not_exists=True
    )
    op.create_index(
        "idx_student_skills_skill",
        "student_skills",
        ["skill_id"],
        if_not_exists=True,
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$;
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
        CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
        CREATE TRIGGER trg_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION check_student_project_team()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            target_project_id BIGINT;
        BEGIN
            PERFORM pg_advisory_xact_lock(NEW.student_id);

            SELECT project_id
            INTO target_project_id
            FROM teams
            WHERE id = NEW.team_id;

            IF target_project_id IS NULL THEN
                RAISE EXCEPTION 'Team % does not exist', NEW.team_id;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM team_members tm
                JOIN teams t ON t.id = tm.team_id
                WHERE tm.student_id = NEW.student_id
                  AND t.project_id = target_project_id
                  AND tm.team_id <> NEW.team_id
            ) THEN
                RAISE EXCEPTION
                    'Student % already belongs to another team in project %',
                    NEW.student_id,
                    target_project_id;
            END IF;

            RETURN NEW;
        END;
        $$;
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_check_student_project_team ON team_members;
        CREATE TRIGGER trg_check_student_project_team
        BEFORE INSERT OR UPDATE OF team_id, student_id
        ON team_members
        FOR EACH ROW
        EXECUTE FUNCTION check_student_project_team();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION check_task_assignee_membership()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            assignee_role VARCHAR(20);
        BEGIN
            IF NEW.assignee_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT role
            INTO assignee_role
            FROM users
            WHERE id = NEW.assignee_id;

            IF assignee_role IS DISTINCT FROM 'student' THEN
                RAISE EXCEPTION
                    'Task assignee % must be a student',
                    NEW.assignee_id;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM team_members
                WHERE team_id = NEW.team_id
                  AND student_id = NEW.assignee_id
            ) THEN
                RAISE EXCEPTION
                    'Assignee % is not a member of team %',
                    NEW.assignee_id,
                    NEW.team_id;
            END IF;

            RETURN NEW;
        END;
        $$;
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_check_task_assignee_membership ON tasks;
        CREATE TRIGGER trg_check_task_assignee_membership
        BEFORE INSERT OR UPDATE OF team_id, assignee_id
        ON tasks
        FOR EACH ROW
        EXECUTE FUNCTION check_task_assignee_membership();
        """
    )


def downgrade():
    # Baseline downgrades are destructive. Take a backup before running this.
    op.execute(
        "DROP TRIGGER IF EXISTS trg_check_task_assignee_membership ON tasks"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS trg_check_student_project_team ON team_members"
    )
    op.execute("DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks")
    op.execute("DROP TRIGGER IF EXISTS trg_users_updated_at ON users")

    op.drop_table("student_skills", if_exists=True)
    op.drop_table("skills", if_exists=True)
    op.drop_table("tasks", if_exists=True)
    op.drop_table("team_members", if_exists=True)
    op.drop_table("teams", if_exists=True)
    op.drop_table("projects", if_exists=True)
    op.drop_table("course_enrollments", if_exists=True)
    op.drop_table("courses", if_exists=True)
    op.drop_table("users", if_exists=True)

    op.execute("DROP FUNCTION IF EXISTS check_task_assignee_membership()")
    op.execute("DROP FUNCTION IF EXISTS check_student_project_team()")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
