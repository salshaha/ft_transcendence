-- Legacy bootstrap script for databases created before student_id/domain were
-- added. New databases should use sql/sql-schema.sql or `flask db upgrade`;
-- Alembic revision 0003 converts this script's unique index into the matching
-- unique constraint. Safe to run more than once.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS student_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS domain VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = ANY (i.indkey)
        WHERE i.indrelid = 'users'::regclass
          AND i.indisunique
          AND a.attname = 'student_id'
    ) THEN
        CREATE UNIQUE INDEX ix_users_student_id ON users (student_id);
    END IF;
END;
$$;
