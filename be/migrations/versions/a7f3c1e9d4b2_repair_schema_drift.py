import sqlalchemy as sa
from alembic import op

revision = "a7f3c1e9d4b2"
down_revision = "f6a9d1e4b2c7"
branch_labels = None
depends_on = None


def _column_names(table):
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _constraint_names(table):
    inspector = sa.inspect(op.get_bind())
    checks = {constraint["name"] for constraint in inspector.get_check_constraints(table)}
    uniques = {constraint["name"] for constraint in inspector.get_unique_constraints(table)}
    return checks | uniques


def _index_names(table):
    return {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}


def _add_column_if_missing(table, name, type_):
    if name not in _column_names(table):
        op.add_column(table, sa.Column(name, type_, nullable=True))


def _drop_column_if_exists(table, name):
    if name in _column_names(table):
        op.drop_column(table, name)


def _create_index_if_missing(name, table, columns):
    if name not in _index_names(table):
        op.create_index(name, table, columns)


def _drop_index_if_exists(name, table):
    if name in _index_names(table):
        op.drop_index(name, table_name=table)


def _restore_submission_unique_name(target_name):
    team_uniques = [
        constraint
        for constraint in sa.inspect(op.get_bind()).get_unique_constraints("submissions")
        if constraint["column_names"] == ["team_id"]
    ]
    if target_name in {constraint["name"] for constraint in team_uniques}:
        return
    existing = next((constraint["name"] for constraint in team_uniques if constraint["name"]), None)
    if existing:
        op.execute(
            'ALTER TABLE submissions RENAME CONSTRAINT "%s" TO "%s"'
            % (existing.replace('"', '""'), target_name)
        )
    else:
        op.create_unique_constraint(target_name, "submissions", ["team_id"])


def upgrade():
    _add_column_if_missing("users", "microsoft_tenant_id", sa.String(length=255))
    _add_column_if_missing("users", "microsoft_object_id", sa.String(length=255))

    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_authentication")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_authentication CHECK ("
        "(microsoft_tenant_id IS NOT NULL AND microsoft_object_id IS NOT NULL) "
        "OR microsoft_id IS NOT NULL OR password_hash IS NOT NULL)"
    )

    if "uq_users_microsoft_identity" not in _constraint_names("users"):
        op.create_unique_constraint(
            "uq_users_microsoft_identity",
            "users",
            ["microsoft_tenant_id", "microsoft_object_id"],
        )

    for name, table, columns in [
        ("idx_grade_audits_grade", "grade_audits", ["grade_id"]),
        ("idx_grades_project", "grades", ["project_id"]),
        ("idx_grades_student", "grades", ["student_id"]),
        ("idx_password_reset_user", "password_reset_tokens", ["user_id"]),
        ("idx_peer_feedback_project", "peer_feedback", ["project_id"]),
        ("idx_peer_feedback_to", "peer_feedback", ["to_student_id"]),
        ("idx_submissions_team", "submissions", ["team_id"]),
    ]:
        _create_index_if_missing(name, table, columns)

    _restore_submission_unique_name("uq_submissions_team")


def downgrade():
    _restore_submission_unique_name("submissions_team_id_key")

    for name, table in [
        ("idx_submissions_team", "submissions"),
        ("idx_peer_feedback_to", "peer_feedback"),
        ("idx_peer_feedback_project", "peer_feedback"),
        ("idx_password_reset_user", "password_reset_tokens"),
        ("idx_grades_student", "grades"),
        ("idx_grades_project", "grades"),
        ("idx_grade_audits_grade", "grade_audits"),
    ]:
        _drop_index_if_exists(name, table)

    if "uq_users_microsoft_identity" in _constraint_names("users"):
        op.drop_constraint("uq_users_microsoft_identity", "users", type_="unique")

    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_authentication")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_authentication CHECK "
        "(microsoft_id IS NOT NULL OR password_hash IS NOT NULL)"
    )

    _drop_column_if_exists("users", "microsoft_object_id")
    _drop_column_if_exists("users", "microsoft_tenant_id")
