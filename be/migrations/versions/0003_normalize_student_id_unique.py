"""Normalize the legacy users.student_id unique index.

Revision ID: 0003_student_id_unique
Revises: 0002_student_gpa
Create Date: 2026-11-20

Older databases added student_id through a manual SQL migration that created a
unique index named ix_users_student_id. The schema and ORM model use a unique
constraint instead. This migration converts the index into the matching
constraint so Alembic autogenerate stays clean. It is a no-op on databases that
already have the constraint.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_student_id_unique"
down_revision = "0002_student_gpa"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        DO $$
        DECLARE
            has_constraint BOOLEAN;
        BEGIN
            SELECT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid
                 AND a.attnum = ANY (c.conkey)
                WHERE c.conrelid = 'users'::regclass
                  AND c.contype = 'u'
                  AND a.attname = 'student_id'
                  AND array_length(c.conkey, 1) = 1
            )
            INTO has_constraint;

            IF NOT has_constraint THEN
                IF EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_index i ON i.indexrelid = c.oid
                    WHERE c.relname = 'ix_users_student_id'
                      AND i.indisunique
                ) THEN
                    ALTER TABLE users
                        ADD CONSTRAINT users_student_id_key
                        UNIQUE USING INDEX ix_users_student_id;
                ELSE
                    DROP INDEX IF EXISTS ix_users_student_id;
                    ALTER TABLE users
                        ADD CONSTRAINT users_student_id_key
                        UNIQUE (student_id);
                END IF;
            END IF;
        END;
        $$;
        """
    )


def downgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = 'users'::regclass
                  AND conname = 'users_student_id_key'
            ) THEN
                ALTER TABLE users DROP CONSTRAINT users_student_id_key;
                CREATE UNIQUE INDEX IF NOT EXISTS ix_users_student_id
                    ON users (student_id);
            END IF;
        END;
        $$;
        """
    )
