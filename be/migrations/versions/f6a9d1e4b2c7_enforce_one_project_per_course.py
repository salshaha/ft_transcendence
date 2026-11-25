from alembic import op

revision = "f6a9d1e4b2c7"
down_revision = "e5b8c9d2a1f4"
branch_labels = None
depends_on = None


def _is_postgresql():
    return op.get_bind().dialect.name == "postgresql"


def upgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "chk_projects_max_grade", "max_grade > 0"
        )
    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "chk_grades_nonnegative", "grade >= 0"
        )

    if not _is_postgresql():
        return

    op.execute(
        """
        CREATE OR REPLACE FUNCTION enforce_one_project_per_course()
        RETURNS trigger AS $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM projects
                WHERE course_id = NEW.course_id AND id <> NEW.id
            ) THEN
                RAISE EXCEPTION
                    'This course already has a project (course_id: %)', NEW.course_id
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_projects_one_per_course
        BEFORE INSERT OR UPDATE OF course_id ON projects
        FOR EACH ROW EXECUTE FUNCTION enforce_one_project_per_course();
        """
    )


def downgrade():
    if _is_postgresql():
        op.execute("DROP TRIGGER IF EXISTS trg_projects_one_per_course ON projects")
        op.execute("DROP FUNCTION IF EXISTS enforce_one_project_per_course()")

    with op.batch_alter_table("grades", schema=None) as batch_op:
        batch_op.drop_constraint("chk_grades_nonnegative", type_="check")
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint("chk_projects_max_grade", type_="check")
