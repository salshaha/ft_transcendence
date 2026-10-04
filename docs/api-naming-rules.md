# API Naming Conventions

This should be written down before people start creating endpoints.

**REST-style APIs**

Base:

`/api`

Then resources:
```
/api/users
/api/courses
/api/projects
/api/teams
/api/skills
```
Authentication:
```
/api/auth/register
/api/auth/login
/api/auth/logout
```
For example:
```
GET    /api/courses
POST   /api/courses

GET    /api/courses/<id>
PUT    /api/courses/<id>
DELETE /api/courses/<id>
```
For projects:
```
GET    /api/projects
POST   /api/projects

GET    /api/projects/<id>
PUT    /api/projects/<id>
DELETE /api/projects/<id>
```
Don't do this
```
/getAllStudents
/createNewProject
/deleteTeam
/getStudentById
```
Prefer:

```
GET    /api/students
POST   /api/projects
DELETE /api/teams/<id>
GET    /api/students/<id>
```

HTTP methods communicate the operation.