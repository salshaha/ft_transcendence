# Foundational Security and Platform Decisions

This document records the decisions made before feature work starts. The goal
is to avoid rebuilding authentication, authorization, migrations, and file
handling for every new screen.

## Database schema and migrations

- `be/migrations/` is now a real Flask-Migrate/Alembic environment.
- `0001_baseline_schema` covers every table that existed in
  `sql/sql-schema.sql` before this phase: `users`, `courses`,
  `course_enrollments`, `projects`, `teams`, `team_members`, `tasks`, `skills`,
  and `student_skills`.
- `0002_add_student_gpa` adds the optional `student_gpa` table. A missing row
  means the student's GPA is not available.
- `0003_student_id_unique` converts the legacy `ix_users_student_id` unique
  index into the unique constraint used by the ORM, keeping autogenerate clean.
- All ORM models are imported from `app.models`, including `Skill`,
  `StudentSkill`, and `StudentGPA`, so `flask db migrate` no longer proposes
  dropping the skills tables.
- The baseline migration is intentionally idempotent (`IF NOT EXISTS`). It
  works both for a database created by the PostgreSQL init script and for an
  empty database created by `flask db upgrade`.

Commands, from `be/` with the virtual environment active:

```bash
flask --app run.py db upgrade
flask --app run.py db check
flask --app run.py db migrate -m "describe the change"
```

Review every generated migration before committing it. After changing a model,
the expected sequence is: change model, generate migration, review, apply,
commit the migration, then let other developers apply it.

## Roles and account provisioning

The selected model is **admin-provisioned instructors**, not open instructor
signup:

- `POST /api/auth/register` only creates students.
- A request that asks for the `instructor` role receives `403` with a message
  telling the person to contact an administrator.
- Administrators and instructors are created or repaired through Flask CLI
  commands:
  
  ```bash
  # First admin. Missing values are prompted for.
  flask --app run.py create-admin

  # Non-interactive seeding (password environment variables are supported).
  ADMIN_EMAIL=admin@example.com \\
  ADMIN_PASSWORD='a-long-password' \\
  flask --app run.py create-admin

  # Provision an instructor. Public registration never creates one.
  flask --app run.py create-instructor

  # Update an existing account with the same email and set its password.
  flask --app run.py create-admin --email admin@example.com --force
  ```

Environment fallbacks are `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `INSTRUCTOR_EMAIL`,
`INSTRUCTOR_PASSWORD`, `INSTRUCTOR_FIRST_NAME`, and
`INSTRUCTOR_LAST_NAME`.

The eventual admin UI should call the same `app.services.user_service`
functions instead of duplicating validation and password hashing.

## Task authorization

Tasks are no longer public.

| Operation | Student | Instructor | Admin |
| --- | --- | --- | --- |
| `GET /api/tasks` | Only tasks for teams they belong to | Only tasks in courses they teach | All tasks |
| `GET /api/tasks?team_id=...` | Team membership required | Course ownership required | Allowed |
| `POST /api/tasks` | Team membership required | Forbidden (read-only) | Allowed |
| `PUT /api/tasks/<id>` | Team membership required | Forbidden (read-only) | Allowed |
| `DELETE /api/tasks/<id>` | Team membership required | Forbidden (read-only) | Allowed |

Additional rules:

- Anonymous requests receive `401`.
- A `team_id` filter is authorization-checked, not just used as a query filter.
- Tasks cannot be moved between teams with `PUT`.
- An assignee must be a student who is a member of the task's team, both in the
  service layer and in the existing PostgreSQL trigger.

## Account credential changes

`PUT /api/update_info` now requires `current_password` whenever the email or
password is being changed. It accepts either `new_password` or the legacy
`password` field, but not conflicting values. A wrong current password returns
`403`. The session email and CSRF token are refreshed after a successful
change.

## CSRF protection

The application uses cookie sessions with credentialed CORS, so every
state-changing `/api/*` request requires a synchronizer token:

1. The frontend calls `GET /api/auth/csrf` (or `GET /api/auth/session`).
2. The server stores a random token in the signed, HttpOnly session.
3. The frontend sends the token in `X-CSRF-Token` (or `X-CSRFToken`) on
   `POST`, `PUT`, `PATCH`, and `DELETE` requests.
4. Missing or mismatched tokens receive `403`.

`GET`, `HEAD`, `OPTIONS`, and `TRACE` are exempt. Login rotates the session and
returns a new token, so the frontend updates its cached token from every JSON
response that contains one. `fe/src/services/apiClient.js` handles the bootstrap
and one automatic retry after a stale-token response.

For production, set `SESSION_COOKIE_SECURE=true`. The cookie already uses
`HttpOnly` and `SameSite=Lax`.

`GET /api/auth/session` restores the signed-in user after a page refresh and
also returns the current CSRF token.

When the public API is added later, API-key-authenticated server-to-server
requests should bypass the session CSRF check only after the key has actually
been validated. Never bypass it merely because an `X-API-Key` header is
present.

## File storage

**Decision for this phase: local disk behind a storage interface.**

- `app/services/storage.py` defines `StorageBackend`, `LocalStorageBackend`,
  and `StorageService`.
- Files are stored under `STORAGE_ROOT` (default `be/uploads/`, which is
  git-ignored) and are **not** inside the Flask static directory.
- Future file features must call `StorageService.save_upload(...)`, store the
  returned key/metadata in PostgreSQL, and stream files back through an
  authorization-aware route. They must not expose raw filesystem paths.
- Stored keys are generated, not user-controlled: `category/owner/uuid.ext`.
- Path traversal is rejected when resolving keys.
- Validation covers category, extension, MIME type, magic bytes, and size.
- Categories and defaults:
  - `avatar`: PNG/JPEG/GIF/WebP, 5 MB
  - `project_requirements`: PDF only, 20 MB
  - `task_attachment`: PDF/images/ZIP/Office/text, 25 MB
  - `project_submission`: PDF/images/ZIP/Office/text, 100 MB
- The abstraction is the seam for S3/MinIO later. Switching backends should
  only require a new `StorageBackend` implementation and configuration, not
  changes to every file endpoint.

Relevant environment variables:

```env
STORAGE_BACKEND=local
STORAGE_ROOT=/absolute/path/to/uploads
STORAGE_MAX_AVATAR_BYTES=5242880
STORAGE_MAX_PROJECT_REQUIREMENTS_BYTES=20971520
STORAGE_MAX_TASK_ATTACHMENT_BYTES=26214400
STORAGE_MAX_PROJECT_SUBMISSION_BYTES=104857600
MAX_CONTENT_LENGTH_BYTES=115343360
```

## Password reset

Changing a password while signed in is covered by `PUT /api/update_info`.
Forgotten-password recovery is implemented with Resend transactional email
delivery (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password/validate`,
and `POST /api/auth/reset-password`, with `/api/auth/password-reset/*` aliases),
SHA-256 hashed expiring single-use tokens in `password_reset_tokens`, and
`users.session_version` invalidation across active sessions. See
[docs/password-recovery.md](password-recovery.md) for setup and API details.
