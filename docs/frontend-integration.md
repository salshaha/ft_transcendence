# Figma Frontend Integration

The Figma dashboard visuals are integrated into the existing React/Vite app. The frontend remains JavaScript-based; the dashboard components were converted from TSX to JSX. Tailwind CSS 4 and its Vite plugin are used for the Figma utility styles. React, Vite, Docker services, and backend architecture remain unchanged.

The authenticated user returned by login selects the dashboard: `student` renders the student experience and `instructor` renders the instructor experience. The role-picker in the Figma export was a demo and is not used. Authentication and dashboard data continue to use Flask's cookie session.

## Existing API integration

| UI | Existing endpoint | Current use |
| --- | --- | --- |
| Sign in / sign up / sign out | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout` | Existing auth flow; logout is now shared by both roles. |
| Instructor overview and navigation | `GET /api/instructor/dashboard` | Real instructor, course, deadline, student, project, submission-availability, and resource-availability data. |
| Student overview and available teams | `GET /api/student/dashboard` | Real profile, enrolled course, deadline, and available-team data. |
| Student profile | `GET /api/student/profile` | Real profile fields; no GPA or skills are returned. |
| Student courses | `GET /api/student/courses` | Enrolled course and instructor data. |
| Join a team | `POST /api/student/teams/<id>/join` | Uses the existing membership validation and refreshes the dashboard after success. |
| Change student email | `PUT /api/update_info` | Updates the account email after the current password is entered. Phone is not shown because the schema has no phone field. |
| Restore a signed-in session after refresh | `GET /api/auth/session` | Called on app load to restore the authenticated user and CSRF token. |
| CSRF protection | `GET /api/auth/csrf` | Every state-changing request sends the returned token in `X-CSRF-Token`; the API client bootstraps and retries it automatically. |

Empty lists and unsupported capabilities are shown explicitly. Figma sample names, courses, team memberships, dates, grades, and success states are not used as application data. The student settings page does not claim that a password-reset email was sent, and unsupported actions are disabled.

## Backend functionality still needed

The foundational backend phase added migrations, task authorization, CSRF protection, admin-provisioned instructor accounts, and a local file-storage abstraction. See `docs/foundations.md`.

| Capability | Current gap | Suggested follow-up |
| --- | --- | --- |
| Course slides and labs | There is no course-resource table or upload/list API. | Add a course-resource model and migration with course, title, type, storage key, uploader, and timestamps; add instructor upload and student/instructor list/download endpoints. Store file contents in an approved file store, not directly in frontend code. |
| Create instructor projects | The schema supports one project per course, but there is no project creation endpoint. | Add instructor-authorized project creation and retrieval endpoints using the existing `projects` model and enforce the existing one-project-per-course and team-size constraints. |
| Student project details and requirements | Student course/dashboard responses do not include associated project requirements or teams. | Add course-scoped project detail access for enrolled students, reusing the existing `projects`, `teams`, and membership relationships. |
| Create a team | Students can list and join teams, but there is no team-creation endpoint. | Add an enrollment- and project-scoped team creation endpoint; create its initial membership transactionally and enforce the existing team-size rules. |
| Student skills | `skills` and `student_skills` exist in the schema, but there are no read/write endpoints. | Add authenticated profile skill list, add, and remove endpoints that reuse those tables and validate proficiency values. |
| GPA and individual project grading/feedback | `student_gpa` now stores an optional GPA and the student profile returns it, but there is no GPA-management endpoint, submission table, or individual evaluation table/API. Team feedback alone does not represent individual grades. | Confirm the authoritative GPA source and grading workflow first. Then add suitable evaluation records and APIs, plus instructor read/write endpoints. |
| Password reset | There is no reset-token workflow or outbound email configuration. | Add expiring, single-use reset tokens stored as hashes, request/confirmation endpoints, and configured email delivery. |
| Notifications | There is no notification table or API. | Add recipient-scoped notification storage, read state, and list/mark-read endpoints when notification events are defined. |
| Classmate profiles and course materials | Course API responses do not include classmates or resources. | Extend or add enrollment-scoped endpoints after the resource API and profile visibility rules are defined. |
| Editable phone/personal fields | The current schema has no phone column; the update endpoint accepts email and password only. | Confirm which fields may be edited and add a migration only for approved persistent fields. |

These are follow-up items, not claims that the current UI implements those features. Password reset, resources, project creation, skills, and team creation should be added in a separate backend-focused phase with migrations and API tests.
