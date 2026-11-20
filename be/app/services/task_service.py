from datetime import datetime, timezone

from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.student_dashboard import (
    Course,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.user import User

TASK_STATUSES = frozenset({"todo", "in_progress", "review", "done"})


class TaskError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _task_query():
    return Task.query.options(
        joinedload(Task.team)
        .joinedload(Team.project)
        .joinedload(Project.course)
    )


def _load_team(team_id):
    return (
        Team.query.options(
            joinedload(Team.project).joinedload(Project.course)
        )
        .filter(Team.id == team_id)
        .one_or_none()
    )


def _is_team_member(user, team_id):
    if user.role != "student":
        return False
    return (
        TeamMember.query.filter_by(team_id=team_id, student_id=user.id).first()
        is not None
    )


def _teaches_course(user, course_id):
    return (
        user.role == "instructor"
        and Course.query.filter_by(
            id=course_id, instructor_id=user.id
        ).first()
        is not None
    )


def can_read_team(user, team):
    if user.role == "admin":
        return True
    if user.role == "student":
        return _is_team_member(user, team.id)
    if user.role == "instructor":
        return _teaches_course(user, team.project.course_id)
    return False


def can_manage_team_tasks(user, team):
    if user.role == "admin":
        return True
    if user.role == "student":
        return _is_team_member(user, team.id)
    return False


def _scope_tasks(query, user):
    if user.role == "admin":
        return query
    if user.role == "student":
        return query.join(
            TeamMember, TeamMember.team_id == Task.team_id
        ).filter(TeamMember.student_id == user.id)
    if user.role == "instructor":
        return (
            query.join(Team, Team.id == Task.team_id)
            .join(Project, Project.id == Team.project_id)
            .join(Course, Course.id == Project.course_id)
            .filter(Course.instructor_id == user.id)
        )
    return query.filter(Task.id.is_(None))


def _iso(value):
    return value.isoformat() if value is not None else None


def serialize_task(task):
    return {
        "id": task.id,
        "team_id": task.team_id,
        "assignee_id": task.assignee_id,
        "created_by": task.created_by,
        "created_at": _iso(task.created_at),
        "updated_at": _iso(task.updated_at),
        "title": task.title,
        "due_date": _iso(task.due_date),
        "status": task.status,
        "description": task.description,
    }


def _parse_int(value, field_name):
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise TaskError(f"{field_name} must be an integer")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise TaskError(f"{field_name} must be an integer") from exc


def _parse_datetime(value):
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise TaskError("due_date must be an ISO-8601 datetime")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise TaskError("due_date must be an ISO-8601 datetime") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _validate_assignee(team_id, assignee_id):
    if assignee_id is None:
        return
    assignee = db.session.get(User, assignee_id)
    if assignee is None or assignee.role != "student":
        raise TaskError("assignee_id must reference a student")
    if not TeamMember.query.filter_by(
        team_id=team_id, student_id=assignee_id
    ).first():
        raise TaskError("Assignee must be a member of the task's team")


def _validate_title(value):
    if not isinstance(value, str) or not value.strip():
        raise TaskError("title is required")
    value = value.strip()
    if len(value) > 255:
        raise TaskError("title must be 255 characters or fewer")
    return value


def _validate_status(value):
    if value not in TASK_STATUSES:
        raise TaskError(
            "Invalid task status. Use todo, in_progress, review, or done"
        )
    return value


def _validate_description(value):
    if value is not None and not isinstance(value, str):
        raise TaskError("description must be text")
    return value


def list_tasks(user, team_id=None):
    if team_id is not None:
        try:
            team_id = int(team_id)
        except (TypeError, ValueError) as exc:
            raise TaskError("team_id must be an integer") from exc

        team = _load_team(team_id)
        if team is None:
            raise TaskError("Team not found", 404)
        if not can_read_team(user, team):
            raise TaskError("You cannot view tasks for this team", 403)

        tasks = (
            _task_query()
            .filter(Task.team_id == team_id)
            .order_by(Task.id.asc())
            .all()
        )
    else:
        tasks = (
            _scope_tasks(_task_query(), user)
            .order_by(Task.id.asc())
            .all()
        )

    return [serialize_task(task) for task in tasks]


def create_task(user, data):
    if user.role == "instructor":
        raise TaskError(
            "Instructors have read-only access to team tasks", 403
        )

    team_id = _parse_int(data.get("team_id"), "team_id")
    if team_id is None:
        raise TaskError("team_id is required")

    team = _load_team(team_id)
    if team is None:
        raise TaskError("Team not found", 404)
    if not can_manage_team_tasks(user, team):
        raise TaskError("You cannot create tasks for this team", 403)

    title = _validate_title(data.get("title", data.get("task")))
    status = _validate_status(data.get("status", "todo"))
    description = _validate_description(data.get("description"))
    due_date = _parse_datetime(data.get("due_date"))
    assignee_id = _parse_int(data.get("assignee_id"), "assignee_id")
    _validate_assignee(team_id, assignee_id)

    task = Task(
        team_id=team_id,
        assignee_id=assignee_id,
        created_by=user.id,
        title=title,
        due_date=due_date,
        status=status,
        description=description,
    )
    db.session.add(task)
    db.session.commit()
    return serialize_task(task)


def _load_task(task_id):
    task = _task_query().filter(Task.id == task_id).one_or_none()
    if task is None:
        raise TaskError("Task not found", 404)
    return task


def update_task(user, task_id, data):
    task = _load_task(task_id)
    if not can_manage_team_tasks(user, task.team):
        raise TaskError("You cannot edit tasks for this team", 403)

    if "team_id" in data:
        requested_team_id = _parse_int(data.get("team_id"), "team_id")
        if requested_team_id != task.team_id:
            raise TaskError("Tasks cannot be moved between teams")

    updates = {}
    if "title" in data or "task" in data:
        updates["title"] = _validate_title(
            data.get("title", data.get("task"))
        )
    if "status" in data:
        updates["status"] = _validate_status(data["status"])
    if "description" in data:
        updates["description"] = _validate_description(
            data.get("description")
        )
    if "due_date" in data:
        updates["due_date"] = _parse_datetime(data.get("due_date"))
    if "assignee_id" in data:
        assignee_id = _parse_int(data.get("assignee_id"), "assignee_id")
        _validate_assignee(task.team_id, assignee_id)
        updates["assignee_id"] = assignee_id

    if not updates:
        raise TaskError("At least one editable task field is required")

    for field, value in updates.items():
        setattr(task, field, value)

    db.session.commit()
    return serialize_task(task)


def delete_task(user, task_id):
    task = _load_task(task_id)
    if not can_manage_team_tasks(user, task.team):
        raise TaskError("You cannot delete tasks for this team", 403)

    db.session.delete(task)
    db.session.commit()
    return {"message": "Task deleted successfully"}
