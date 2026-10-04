# Database Migration Strategy

PostgreSQL + SQLAlchemy + Alembic/Flask-Migrate

The basic workflow becomes:

```
Developer changes model
        ↓
Create migration
        ↓
Commit migration
        ↓
Other developers pull
        ↓
Run migration
        ↓
Their database gets updated
```

Conceptually:

```
Migration 001
    ↓
Migration 002
    ↓
Migration 003
    ↓
Migration 004
```

rather than everyone manually editing PostgreSQL.

Why?

Imagine one team member adds:

`skills`

and another adds:

`projects`

You don't want everyone manually recreating those tables.

Instead, Git contains the database changes.

Important distinction

Your repository contains:

`backend/migrations/`

The actual PostgreSQL data does not belong in Git.