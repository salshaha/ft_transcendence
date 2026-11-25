# ft_transcendence

A full-stack web application designed to help university students find suitable teammates for academic projects and allow instructors to monitor, evaluate, and provide feedback on student project progress.

---

## Table of Contents

* [Project Overview](#project-overview)
* [Features](#features)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [Prerequisites](#prerequisites)
* [Getting Started](#getting-started)
* [Environment Variables](#environment-variables)
* [Backend Setup](#backend-setup)
* [Frontend Setup](#frontend-setup)
* [Database](#database)
* [Docker](#docker)
* [Makefile](#makefile)
* [Running the Application](#running-the-application)
* [API Structure](#api-structure)
* [Development Workflow](#development-workflow)
* [Git Workflow](#git-workflow)
* [Testing](#testing)
* [Troubleshooting](#troubleshooting)
* [Contributing](#contributing)

---

## Project Overview

`ft_transcendence` is a university project management and team-building platform.

The application is designed around two main types of users:

* Students
* Instructors

Students can create profiles, add their skills, view their courses, discover classmates, find available teammates, and create or join project teams.

Instructors can manage their courses, provide course materials, create projects, define project requirements, view created teams, monitor students, and provide feedback and grades.

The project uses a React frontend, Flask backend, and PostgreSQL database.

---

## Features

### Student

The planned student functionality includes:

* Sign up
* Login
* Sign out
* Reset password
* View profile
* Edit personal information
* Add skills
* View courses
* View instructor information
* View classmates and their profiles
* View course slides
* View course labs
* View projects
* Receive notifications
* View project requirements
* View available team members
* Create a team
* Join a team
* Provide feedback to team members after a project

### Instructor

The planned instructor functionality includes:

* Sign up
* Login
* Sign out
* View courses
* View students in a course
* View uploaded slides and labs
* Upload slides
* Upload labs
* Create projects
* Define minimum and maximum team size
* Upload project requirements
* View created teams
* View student GPA
* Provide student feedback
* Comment on student performance
* Grade students after project completion

---

## Technology Stack

| Component           | Technology              |
| ------------------- | ----------------------- |
| Frontend            | React                   |
| Backend             | Flask / Python          |
| Database            | PostgreSQL              |
| ORM                 | SQLAlchemy              |
| Database migrations | Alembic / Flask-Migrate |
| Containerization    | Docker / Docker Compose |
| API                 | REST-style HTTP API     |
| Version control     | Git                     |

---

# Project Structure

```text
ft_transcendence/
│
├── be/
│   ├── app/
│   │   ├── auth/
│   │   │   └── routes.py
│   │   │
│   │   ├── config.py
│   │   ├── __init__.py
│   │   │
│   │   ├── models/
│   │   │   └── user.py
│   │   │
│   │   ├── routes/
│   │   │   ├── tasks.py
│   │   │   └── users.py
│   │   │
│   │   ├── services/
│   │   │   └── user_service.py
│   │   │
│   │   └── utils/
│   │
│   ├── migrations/
│   ├── requirements.txt
│   ├── run.py
│   └── tests/
│
├── db/
│   └── README.md
│
├── docs/
│   ├── api-naming-rules.md
│   ├── Architecture.md
│   ├── database-migration.md
│   ├── git-rules.md
│   └── rules.md
│
├── fe/
│   ├── package.json
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       └── services/
│
├── docker-compose.yml
├── Makefile
├── README.md
├── .env
├── .env.example
└── .gitignore
```

### Backend directories

#### `be/app/auth/`

Contains authentication-related routes and logic.

Examples:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

#### `be/app/models/`

Contains database models.

Example:

```text
user.py
```

Models represent database entities and are implemented using SQLAlchemy.

#### `be/app/routes/`

Contains API routes that are not specifically authentication routes.

Examples include:

* User profile/settings
* Tasks
* Courses
* Projects
* Teams

#### `be/app/services/`

Contains business logic and database operations used by the API routes.

For example:

```text
routes/users.py
        ↓
services/user_service.py
        ↓
models/user.py
        ↓
PostgreSQL
```

#### `be/migrations/`

Contains database migration files.

Migration files should be committed to Git.

Actual database data should never be committed.

#### `be/tests/`

Contains backend tests.

---

# Prerequisites

Before setting up the project, install the following:

* Git
* Python 3
* pip
* Node.js
* npm
* Docker
* Docker Compose

Verify the installations:

```bash
git --version
python3 --version
pip3 --version
node --version
npm --version
docker --version
docker compose version
```

If your system uses `python` instead of `python3`, use the command available on your system.

---

# Getting Started

## 1. Clone the repository

Clone the repository:

```bash
git clone <REPOSITORY_URL>
```

Enter the project:

```bash
cd ft_transcendence
```

Check the repository:

```bash
git status
```

---

## 2. Check the project structure

Run:

```bash
tree
```

The repository should contain the main directories:

```text
be/
fe/
db/
docs/
docker-compose.yml
Makefile
README.md
```

---

# Environment Variables

The project uses environment variables for configuration.

Create your local `.env` file from the example:

```bash
cp .env.example .env
```

The `.env` file must **not** be committed to Git.

The repository should contain:

```text
.env.example
```

but not the actual developer-specific:

```text
.env
```

### Example `.env`

```env
SECRET_KEY=generate-a-unique-random-value-at-least-32-characters-long

POSTGRES_DB=ft_transcendence
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this-password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

DATABASE_URL=postgresql://postgres:change-this-password@localhost:5432/ft_transcendence
```

The exact database variables may change when the PostgreSQL/Docker configuration is finalized.

Never commit real passwords, API keys, tokens, or other secrets.

For Microsoft sign-in, roster tokens are encrypted in local file storage using a key derived from `SECRET_KEY`. Set a unique, stable secret of at least 32 characters before connecting Microsoft accounts; changing it later requires users to sign in with Microsoft again.

Additional security/storage settings (all optional for local development):

```env
# Set to true when serving over HTTPS.
SESSION_COOKIE_SECURE=false
SESSION_LIFETIME_DAYS=14

# Local disk is the selected storage backend for this phase.
STORAGE_BACKEND=local
STORAGE_ROOT=/absolute/path/to/uploads

# Upload limits in bytes.
MAX_CONTENT_LENGTH_BYTES=115343360
STORAGE_MAX_AVATAR_BYTES=5242880
STORAGE_MAX_PROJECT_REQUIREMENTS_BYTES=20971520
STORAGE_MAX_TASK_ATTACHMENT_BYTES=26214400
STORAGE_MAX_PROJECT_SUBMISSION_BYTES=104857600
```

See `docs/foundations.md` for the authorization, CSRF, role-provisioning, and
file-storage decisions.

## Microsoft sign-in and course roster sync

Create a Microsoft Entra app registration for **accounts in this organization** and add a **Web** redirect URI that exactly matches `MICROSOFT_REDIRECT_URI` (the local default is `http://localhost:5000/api/auth/microsoft/callback`). Add these values to the local `.env` file:

```env
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback
```

Grant the app the delegated Microsoft Graph permissions `User.Read` and `EduRoster.ReadBasic`, then grant tenant admin consent for the roster permission. Graph's education roster endpoints require a work or school account. The app reads an instructor's taught classes and class members with delegated access; Microsoft documents `EduRoster.ReadBasic` as the least-privileged delegated permission for these operations ([class list](https://learn.microsoft.com/en-us/graph/api/educationuser-list-taughtclasses?view=graph-rest-1.0), [class members](https://learn.microsoft.com/en-us/graph/api/educationclass-list-members?view=graph-rest-1.0)).

From `be/`, install backend requirements before starting Flask:

```bash
python -m pip install -r requirements.txt
python run.py
```

The login page shows **Sign in with Microsoft** when the configuration is ready. A first-time account is created as a student and linked to its Microsoft identity; instructor accounts must already be provisioned with the matching email and instructor role. After an instructor signs in with Microsoft, open **My courses** and choose **Sync Microsoft classes**. Sync adds or updates classes and enrolls roster students; it does not remove local course enrollments. MSAL's authorization-code flow is used for the web sign-in, and its token cache is encrypted before storage ([MSAL Python authorization-code flow](https://learn.microsoft.com/en-us/entra/msal/python/getting-started/acquiring-tokens)).

---

# Backend Setup

Move into the backend:

```bash
cd be
```

## 1. Create a Python virtual environment

```bash
python3 -m venv .venv
```

Activate it.

### Linux/macOS

```bash
source .venv/bin/activate
```

### Fish shell

```fish
source .venv/bin/activate.fish
```

After activation, the shell should indicate that the virtual environment is active.

---

## 2. Upgrade pip

```bash
python -m pip install --upgrade pip
```

---

## 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

---

## 4. Create the first admin or provision an instructor

Public registration only creates student accounts. Instructor and admin
accounts are provisioned by an administrator:

```bash
cd be
flask --app run.py create-admin
flask --app run.py create-instructor
```

For non-interactive setup, set `ADMIN_EMAIL`/`ADMIN_PASSWORD` or
`INSTRUCTOR_EMAIL`/`INSTRUCTOR_PASSWORD` before running the command. Use
`--force` to update an existing account and reset its password.

Apply database migrations after pulling schema changes:

```bash
flask --app run.py db upgrade
```

---

## 5. Run the Flask backend

From inside `be/`:

```bash
python run.py
```

The Flask development server should start.

Alternatively:

```bash
flask --app run.py run
```

The exact command used by the team should be documented once the backend configuration is finalized.

---

# Frontend Setup

Open another terminal and return to the project root:

```bash
cd ft_transcendence
```

Enter the frontend:

```bash
cd fe
```

Install the Node dependencies:

```bash
npm install
```

Run the React development server:

```bash
npm run dev
```

The exact frontend command depends on the React build tool configured in `package.json`.

If the project uses a different script, check:

```bash
cat package.json
```

and run the appropriate script.

---

# Database

The project uses **PostgreSQL** as its database.

SQLite is not used as the project's production/development database.

The intended architecture is:

```text
React
   │
   │ HTTP
   ▼
Flask API
   │
   ▼
SQLAlchemy
   │
   ▼
PostgreSQL
```

Database models belong in:

```text
be/app/models/
```

Database operations/business logic belong in:

```text
be/app/services/
```

Database migrations belong in:

```text
be/migrations/
```

---

## Database Migration Rules

Database schema changes should be handled through migrations.

Do not manually modify the database schema on one developer's machine and expect the rest of the team to reproduce it.

When the database structure changes:

1. Modify the SQLAlchemy model.
2. Generate a migration.
3. Review the migration.
4. Apply the migration.
5. Commit the migration file.
6. Other developers pull the migration and apply it locally.

Migration files must be committed to Git.

Database data must not be committed.

See:

```text
docs/database-migration.md
```

for the project's migration rules.

---

# Docker

Docker Compose is located at the repository root:

```text
docker-compose.yml
```

This allows the project services to be managed from the root directory.

Run Docker Compose from:

```text
ft_transcendence/
```

Start the services:

```bash
docker compose up -d
```

Build and start:

```bash
docker compose up -d --build
```

View running containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs
```

View logs for a specific service:

```bash
docker compose logs <service-name>
```

Stop the services:

```bash
docker compose down
```

Stop the services and remove associated containers:

```bash
docker compose down
```

Do not manually create separate PostgreSQL containers if PostgreSQL is already defined in `docker-compose.yml`.

---

# Makefile

The Makefile provides shortcuts for common project commands.

From the project root:

```bash
make
```

or:

```bash
make help
```

depending on the targets implemented in the Makefile.

Common targets may include:

```bash
make build
make up
make down
make clean
make re
```

The exact available commands should be checked with:

```bash
cat Makefile
```

Do not assume a Make target exists unless it is defined in the Makefile.

---

# Running the Application

The expected development environment consists of:

```text
┌──────────────────────────┐
│        React FE          │
│          fe/             │
└────────────┬─────────────┘
             │
             │ HTTP / REST API
             ▼
┌──────────────────────────┐
│        Flask BE          │
│          be/             │
└────────────┬─────────────┘
             │
             │ SQLAlchemy
             ▼
┌──────────────────────────┐
│       PostgreSQL         │
│        Database          │
└──────────────────────────┘
```

During development, the frontend and backend may run separately.

### Terminal 1 — Database

Start PostgreSQL using the project's Docker configuration:

```bash
docker compose up -d
```

### Terminal 2 — Backend

```bash
cd be
source .venv/bin/activate
python run.py
```

For Fish:

```fish
cd be
source .venv/bin/activate.fish
python run.py
```

### Terminal 3 — Frontend

```bash
cd fe
npm install
npm run dev
```

---

# API Structure

The project follows REST-style API naming.

Authentication routes use:

```text
/api/auth/register
/api/auth/login
/api/auth/logout
```

Other resources use their respective resource names.

Examples:

```text
/api/users
/api/courses
/api/projects
/api/teams
/api/skills
```

HTTP methods should represent the operation being performed.

| Method | Purpose       |
| ------ | ------------- |
| GET    | Retrieve data |
| POST   | Create data   |
| PUT    | Update data   |
| DELETE | Delete data   |

For example:

```text
GET    /api/users
POST   /api/users
PUT    /api/users/me
DELETE /api/users/me
```

The exact API endpoints should follow:

```text
docs/api-naming-rules.md
```

State-changing API requests use cookie sessions and require a CSRF token.
Fetch it from `GET /api/auth/csrf`, store it in memory, and send it back in the
`X-CSRF-Token` header for `POST`, `PUT`, `PATCH`, and `DELETE`. The React client
in `fe/src/services/apiClient.js` already handles this bootstrap and retry
behaviour. `GET /api/auth/session` restores the signed-in user after refresh.

Do not introduce a new endpoint naming convention without updating the API rules and discussing it with the team.

---

# Application Architecture

The backend follows a separation-of-responsibilities approach.

```text
                    React
                      │
                      │ HTTP
                      ▼
              ┌───────────────┐
              │ Flask Routes  │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │   Services    │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │    Models     │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              └───────────────┘
```

### Routes

Routes handle HTTP requests and responses.

```text
be/app/routes/
be/app/auth/
```

### Services

Services contain business logic and database operations.

```text
be/app/services/
```

### Models

Models represent database entities.

```text
be/app/models/
```

### Configuration

Application configuration is located in:

```text
be/app/config.py
```

### Application factory

The Flask application is created by:

```text
be/app/__init__.py
```

The application entry point is:

```text
be/run.py
```

---

# Development Workflow

Before starting work:

```bash
git checkout main
git pull
```

Create a feature branch:

```bash
git checkout -b feature/<feature-name>
```

Examples:

```bash
git checkout -b feature/authentication
git checkout -b feature/landing-page
git checkout -b feature/database
git checkout -b feature/user-profile
```

Work only on the feature assigned to you.

Check your changes:

```bash
git status
```

Review the changes:

```bash
git diff
```

Commit your work:

```bash
git add .
git commit -m "feat: add user authentication"
```

Push the branch:

```bash
git push -u origin feature/<feature-name>
```

Create a Pull Request and have the changes reviewed before merging into `main`.

---

# Git Commit Convention

Use descriptive commit prefixes.

### New functionality

```text
feat:
```

Example:

```bash
git commit -m "feat: add user registration"
```

### Bug fixes

```text
fix:
```

Example:

```bash
git commit -m "fix: validate login credentials"
```

### Documentation

```text
docs:
```

Example:

```bash
git commit -m "docs: update database setup"
```

### Refactoring

```text
refactor:
```

Example:

```bash
git commit -m "refactor: reorganize backend routes"
```

### Tests

```text
test:
```

Example:

```bash
git commit -m "test: add authentication tests"
```

Follow the complete rules in:

```text
docs/git-rules.md
```

---

# Testing

Backend tests are located in:

```text
be/tests/
```

Run the project's configured tests using the test command defined by the team.

If using pytest:

```bash
cd be
pytest
```

Before creating a Pull Request, verify:

```bash
git status
```

and run the relevant tests for the code being changed.

---

# Troubleshooting

## Flask cannot find the application

Make sure you are inside:

```text
be/
```

and run:

```bash
python run.py
```

The entry point is:

```text
be/run.py
```

which imports:

```python
from app import create_app
```

---

## Python module import errors

Make sure the virtual environment is active:

```bash
source .venv/bin/activate
```

For Fish:

```fish
source .venv/bin/activate.fish
```

Then reinstall dependencies:

```bash
pip install -r requirements.txt
```

---

## PostgreSQL connection errors

Check that the database container is running:

```bash
docker compose ps
```

Check PostgreSQL logs:

```bash
docker compose logs <postgres-service-name>
```

Check your `.env` configuration.

Make sure the PostgreSQL host, port, username, password, and database name match the Docker configuration.

---

## Frontend dependencies are missing

From `fe/`:

```bash
npm install
```

Then:

```bash
npm run dev
```

---

## Docker containers are not running

From the project root:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

For detailed logs:

```bash
docker compose logs
```

---

# Important Development Rules

1. Do not commit `.env`.
2. Do not commit passwords, API keys, or other secrets.
3. Do not commit PostgreSQL database data.
4. Do not use SQLite as a replacement for the project's PostgreSQL database.
5. Do not create multiple Flask application instances.
6. Keep authentication routes under `app/auth/`.
7. Keep resource routes under `app/routes/`.
8. Keep business/database operations under `app/services/`.
9. Keep database models under `app/models/`.
10. Use migrations for database schema changes.
11. Follow the API naming rules.
12. Follow the Git branching and commit rules.
13. Test changes before opening a Pull Request.
14. Do not modify another developer's feature without discussing the change.
15. Keep the repository structure consistent with `docs/Architecture.md`.

---

# Documentation

Project documentation is located in:

```text
docs/
```

### Architecture

```text
docs/Architecture.md
```

Contains the project's architectural decisions and structure.

### API naming

```text
docs/api-naming-rules.md
```

Contains API endpoint naming conventions.

### Database migrations

```text
docs/database-migration.md
```

Contains database migration rules.

### Git rules

```text
docs/git-rules.md
```

Contains Git workflow and commit conventions.

### Project rules

```text
docs/rules.md
```

Contains general project development rules.

---

# First-Time Developer Checklist

After cloning the repository:

- [ ] Clone repository
- [ ] Enter ft_transcendence/
- [ ] Check git status
- [ ] Copy .env.example to .env
- [ ] Configure local environment variables
- [ ] Check Docker installation
- [ ] Start Docker services
- [ ] Enter be/
- [ ] Create Python virtual environment
- [ ] Activate virtual environment
- [ ] Install requirements.txt
- [ ] Run backend
- [ ] Enter fe/
- [ ] Install npm dependencies
- [ ] Run frontend
- [ ] Verify frontend can communicate with backend
- [ ] Verify database connection

---

# Team Development Checklist

Before pushing a feature:

- [ ] Feature is on its own branch
- [ ] Code follows project structure
- [ ] No .env or secrets are committed
- [ ] No SQLite database files are committed
- [ ] Database changes have migrations
- [ ] Relevant tests pass
- [ ] API naming follows project rules
- [ ] Git commit follows project conventions
- [ ] Changes have been reviewed


---

# Current Development Status

The repository currently contains the base project architecture for:

* React frontend
* Flask backend
* PostgreSQL database integration
* Flask application factory
* Authentication routes
* User routes
* Task routes
* User service layer
* Database models
* Database migrations
* Backend tests
* Docker Compose
* Project documentation

Some backend functionality is still under development. In particular, temporary in-memory data and previous SQLite implementations are being replaced with the project's PostgreSQL/SQLAlchemy architecture.

Developers should follow the existing architecture rather than introducing separate Flask applications, SQLite databases, or alternative project structures.

---

## License

This project is developed as part of the university `ft_transcendence` project.
