# AI Implementation Notes

This document summarizes the work completed by the AI agent on the
`ft_transcendence` project, including new features, API additions, database
changes, demo data, and how to access and test the application.

---

## 1. How to access the website

### Running with Docker (recommended)

From the project root:

```bash
docker compose up -d --build
```

Services:

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432

### Running backend locally

```bash
cd be
source .venv/bin/activate
python run.py
```

The Flask backend runs on:

```text
http://127.0.0.1:5000
```

### Running frontend locally

```bash
cd fe
npm install
npm run dev
```

The React frontend runs on:

```text
http://localhost:5173
```

### Database access

PostgreSQL is configured by `.env`:

```env
POSTGRES_DB=team_platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_to_a_strong_password
POSTGRES_PORT=5432
```

Connect with:

```bash
psql -h localhost -p 5432 -U postgres -d team_platform
```

---

## 2. Demo accounts

All demo accounts use the password `Password123!`.

### Instructor accounts

- instructor1@example.com
- instructor2@example.com
- instructor3@example.com
- instructor4@example.com
- instructor5@example.com

### Student accounts

- student1@example.com
- student2@example.com
- ...
- student100@example.com

### Admin account

- admin@example.com
- Password: `AdminPass123!`

---

## 3. Database and migrations

The following migrations were added or used:

- `0001_baseline_schema` - baseline schema for all original tables
- `0002_add_student_gpa` - optional student GPA table
- `0003_normalize_student_id_unique` - student ID unique constraint
- `f2b106ff08e8_add_core_workflow_tables` - submissions, grades, grade audits, peer feedback, password reset tokens
- `9e295a365101_add_project_deadline_and_requirements_` - project deadline, requirements PDF metadata, team leader/status

Apply migrations with:

```bash
cd be
flask --app run.py db upgrade
flask --app run.py db check
```

---

## 4. Features completed

### Foundational work

- Database migrations cover all ORM models.
- Authorization holes fixed for tasks and credential changes.
- Role-based registration (students only; instructors/admins provisioned via CLI).
- CSRF protection for state-changing API requests.
- Local file storage abstraction for avatars, PDFs, attachments, and submissions.

### Core workflow

- Courses, projects, teams, tasks.
- Project creation, update, deletion.
- Project deadline support.
- Project requirements PDF upload, replacement, viewing, and download.
- Team creation, joining, leaving.
- Team details and member management.
- Task Kanban support with statuses: todo, in_progress, review, done.
- Task comments are not yet implemented, but task CRUD is available.
- Project submissions with file upload and metadata.
- Instructor grading per student with feedback.
- Grade edit history through `grade_audits`.
- Published grades visible to students.
- Peer feedback between team members.
- Password reset request/confirm flow.
- User profile view/edit.
- Avatar upload, replacement, and removal.
- Skill add, update, remove, and listing.
- Admin dashboard, user management, and course management.

---

## 5. API summary

### Authentication

- `GET /api/auth/csrf`
- `GET /api/auth/session`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`

### Users and profiles

- `GET /api/users/me`
- `PUT /api/users/me`
- `POST /api/users/me/avatar`
- `DELETE /api/users/me/avatar`
- `GET /api/users/skills`
- `POST /api/users/me/skills`
- `PUT /api/users/me/skills/<skill_id>`
- `DELETE /api/users/me/skills/<skill_id>`
- `PUT /api/update_info`

### Students

- `GET /api/student/profile`
- `GET /api/student/courses`
- `GET /api/student/courses/<course_id>/project`
- `GET /api/student/deadlines`
- `GET /api/student/teams/available`
- `POST /api/student/teams`
- `GET /api/student/teams/<team_id>`
- `POST /api/student/teams/<team_id>/join`
- `POST /api/student/teams/<team_id>/leave`
- `POST /api/student/teams/<team_id>/submission`
- `GET /api/student/teams/<team_id>/submission`
- `POST /api/student/peer-feedback`
- `GET /api/student/grades`
- `GET /api/student/projects/<project_id>/requirements`
- `GET /api/student/dashboard`

### Instructors

- `GET /api/instructor/dashboard`
- `GET /api/instructor/courses`
- `GET /api/instructor/courses/<course_id>/students`
- `POST /api/instructor/courses/<course_id>/project`
- `GET /api/instructor/projects/<project_id>`
- `PUT /api/instructor/projects/<project_id>`
- `DELETE /api/instructor/projects/<project_id>`
- `POST /api/instructor/projects/<project_id>/requirements`
- `GET /api/instructor/projects/<project_id>/requirements`
- `GET /api/instructor/projects/<project_id>/teams`
- `GET /api/instructor/projects/<project_id>/submissions`
- `POST /api/instructor/grades`

### Tasks

- `GET /api/tasks`
- `GET /api/tasks?team_id=<id>`
- `POST /api/tasks`
- `PUT /api/tasks/<task_id>`
- `DELETE /api/tasks/<task_id>`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/<user_id>`
- `DELETE /api/admin/users/<user_id>`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `PUT /api/admin/courses/<course_id>`
- `DELETE /api/admin/courses/<course_id>`
- `POST /api/admin/courses/<course_id>/students`
- `DELETE /api/admin/courses/<course_id>/students/<student_id>`

---

## 6. File storage

Files are stored under `STORAGE_ROOT` (default `be/uploads/`) and are not served
directly. They are streamed through authorized endpoints.

Supported categories:

- `avatar`
- `project_requirements`
- `task_attachment`
- `project_submission`

---

## 7. Notes and limitations

- Real-time WebSockets, direct messaging, friends, notifications, public API,
  WAF, Vault, and internationalization are not fully implemented.
- Course slides and labs are intentionally excluded from this phase.
- SSR is intentionally skipped.
- The implementation focuses on the core workflow:
  course -> project -> team -> tasks -> submission -> grading -> peer feedback.