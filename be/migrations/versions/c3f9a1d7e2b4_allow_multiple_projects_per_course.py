from alembic import op

revision = "c3f9a1d7e2b4"
down_revision = "b7d4a2f19c63"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint("projects_course_id_key", type_="unique")
        batch_op.create_index("idx_projects_course", ["course_id"], unique=False)


def downgrade():
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_index("idx_projects_course")
        batch_op.create_unique_constraint("projects_course_id_key", ["course_id"])
