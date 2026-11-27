from datetime import datetime, timezone

from flask import current_app
from sqlalchemy import nullslast, or_
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.student_dashboard import (
    Course,
    Project,
    Task,
    Team,
    TeamMember,
)
from app.models.task_collaboration import TaskAttachment, TaskComment
from app.models.user import User
from app.realtime import emit_task_event
from app.services.storage import FILE_RULES

TASK_STATUSES = frozenset({"todo", "in_progress", "review", "done"})
TASK_SORT_FIELDS = {"created_at", "updated_at", "due_date", "title", "id"}


def _positive_int(value, field_name, default=None, maximum=None):
    if value in (None, ""):
        if default is None:
            raise TaskError(f"{field_name} is required")
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise TaskError(f"{field_name} must be a positive integer") from exc
    if parsed < 1:
        raise TaskError(f"{field_name} must be a positive integer")
    return min(parsed, maximum) if maximum is not None else parsed


def task_attachment_rules():
    rule = FILE_RULES["task_attachment"]
    return {
        "accepted_extensions": sorted(rule.extensions),
        "accepted_mime_types": sorted(rule.mime_types),
        "max_size_bytes": int(current_app.config[rule.limit_config_key]),
    }


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


def can_give_task_feedback(user, task):
    return user.role == "instructor" and _teaches_course(
        user, task.team.project.course_id
    )


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


def _person(user):
    if user is None:
        return None
    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}",
        "email": user.email,
    }


def serialize_task(task):
    team = task.team
    project = team.project if team else None
    course = project.course if project else None
    members = []
    if team is not None:
        members = [
            {
                "id": member.student_id,
                "student_id": member.student.student_id
                if member.student else None,
                "name": (
                    f"{member.student.first_name} {member.student.last_name}"
                    if member.student else f"Student {member.student_id}"
                ),
            }
            for member in team.members
        ]

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
        "assignee": _person(task.assignee),
        "creator": _person(task.creator),
        "team": {
            "id": team.id,
            "name": team.name,
            "members": members,
        } if team else None,
        "project": {
            "id": project.id,
            "title": project.title,
        } if project else None,
        "course": {
            "id": course.id,
            "name": course.name,
        } if course else None,
        "comment_count": TaskComment.query.filter_by(task_id=task.id).count(),
        "attachment_count": TaskAttachment.query.filter_by(task_id=task.id).count(),
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


def list_tasks(user, team_id=None, *, search=None, status=None, assignee_id=None,
               project_id=None, sort="created_at", order="desc", page=1,
               per_page=12, paginate=False):
    if team_id is not None:
        team_id = _positive_int(team_id, "team_id")
        team = _load_team(team_id)
        if team is None:
            raise TaskError("Team not found", 404)
        if not can_read_team(user, team):
            raise TaskError("You cannot view tasks for this team", 403)
        query = _task_query().filter(Task.team_id == team_id)
    else:
        query = _scope_tasks(_task_query(), user)

    search = search.strip()[:100] if isinstance(search, str) else ""
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Task.title.ilike(pattern), Task.description.ilike(pattern))
        )
    if status:
        status = status.strip().lower()
        if status not in TASK_STATUSES:
            raise TaskError("Unsupported task status")
        query = query.filter(Task.status == status)
    if assignee_id not in (None, "", "all"):
        if assignee_id == "unassigned":
            query = query.filter(Task.assignee_id.is_(None))
        else:
            query = query.filter(Task.assignee_id == _positive_int(assignee_id, "assignee_id"))
    if project_id not in (None, "", "all"):
        query = query.filter(
            Task.team.has(Team.project_id == _positive_int(project_id, "project_id"))
        )

    sort = (sort or "created_at").strip().lower()
    if sort not in TASK_SORT_FIELDS:
        raise TaskError(f"Unsupported sort field: {sort}")
    direction = (order or "desc").strip().lower()
    if direction not in {"asc", "desc"}:
        raise TaskError("sort order must be asc or desc")
    sort_column = {
        "created_at": Task.created_at,
        "updated_at": Task.updated_at,
        "due_date": Task.due_date,
        "title": Task.title,
        "id": Task.id,
    }[sort]
    order_column = sort_column.asc() if direction == "asc" else sort_column.desc()
    if sort == "due_date":
        order_column = nullslast(order_column)
    query = query.order_by(order_column, Task.id.asc())

    if not paginate:
        return [serialize_task(task) for task in query.all()]

    page = _positive_int(page, "page", default=1)
    per_page = _positive_int(per_page, "per_page", default=12, maximum=50)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    if pagination.pages and page > pagination.pages:
        pagination = query.paginate(
            page=pagination.pages, per_page=per_page, error_out=False
        )
    return {
        "tasks": [serialize_task(task) for task in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": per_page,
        "pages": pagination.pages,
        "filters": {
            "search": search,
            "status": status or "",
            "assignee_id": assignee_id or "",
            "project_id": project_id or "",
            "sort": sort,
            "order": direction,
        },
    }


def create_task(user, data):
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
    result = serialize_task(task)
    emit_task_event("created", result)
    return result


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

    previous = {field: getattr(task, field) for field in updates}
    for field, value in updates.items():
        setattr(task, field, value)

    db.session.commit()
    result = serialize_task(task)
    changes = {
        field: result.get(field)
        for field, value in updates.items()
        if previous[field] != value
    }
    emit_task_event("updated", result, changes)
    return result


def delete_task(user, task_id):
    task = _load_task(task_id)
    if not can_manage_team_tasks(user, task.team):
        raise TaskError("You cannot delete tasks for this team", 403)

    result = serialize_task(task)
    db.session.delete(task)
    db.session.commit()
    emit_task_event("deleted", result)
    return {"message": "Task deleted successfully"}
