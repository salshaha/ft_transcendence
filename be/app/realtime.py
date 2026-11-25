"""Authenticated Socket.IO rooms for team collaboration events."""

from flask import has_app_context, session
from flask_socketio import emit, join_room, leave_room

from app.extensions import db, socketio


def team_room(team_id):
    return f"team:{team_id}"


def user_room(user_id):
    return f"user:{user_id}"


def init_realtime(app):
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["FRONTEND_ORIGINS"],
        logger=False,
        engineio_logger=False,
    )
    socketio.on_event("connect", handle_connect)
    socketio.on_event("disconnect", handle_disconnect)
    socketio.on_event("join_team", handle_join_team)
    socketio.on_event("leave_team", handle_leave_team)
    app.extensions["socketio"] = socketio


def _socket_user():
    from app.models.user import User

    user_id = session.get("user_id")
    if user_id is None:
        return None
    return db.session.get(User, user_id)


def _team_id_from(value):
    if isinstance(value, dict):
        value = value.get("team_id")
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def handle_connect(_auth=None):
    user = _socket_user()
    if user is None:
        return False
    join_room(user_room(user.id))
    return True


def handle_disconnect():
    return None


def handle_join_team(data=None):
    from app.models.student_dashboard import Team
    from app.services.task_service import can_read_team

    user = _socket_user()
    if user is None:
        emit("realtime_error", {"message": "Authentication required"})
        return

    team_id = _team_id_from(data)
    team = db.session.get(Team, team_id) if team_id is not None else None
    if team is None or not can_read_team(user, team):
        emit("realtime_error", {"message": "You cannot access this team"})
        return

    join_room(team_room(team_id))
    emit("team_joined", {"team_id": team_id})


def handle_leave_team(data=None):
    if _socket_user() is None:
        return
    team_id = _team_id_from(data)
    if team_id is not None:
        leave_room(team_room(team_id))
        emit("team_left", {"team_id": team_id})


def emit_to_team(event, payload, team_id):
    """Emit only when running inside a configured Flask application."""
    if team_id is None or not has_app_context() or socketio.server is None:
        return
    socketio.emit(event, payload, room=team_room(team_id))


def emit_task_event(action, task, changes=None):
    payload = {
        "action": action,
        "team_id": task.get("team_id"),
        "task_id": task.get("id"),
        "task": task,
        "changes": changes or {},
    }
    emit_to_team(f"task_{action}", payload, task.get("team_id"))
    if action == "updated":
        if "status" in (changes or {}):
            emit_to_team("task_status_changed", payload, task.get("team_id"))
        if "assignee_id" in (changes or {}):
            emit_to_team("task_assigned", payload, task.get("team_id"))


def emit_comment_event(action, comment, team_id):
    emit_to_team(
        f"comment_{action}",
        {
            "action": action,
            "team_id": team_id,
            "comment_id": comment.get("id"),
            "task_id": comment.get("task_id"),
            "comment": comment,
        },
        team_id,
    )


def emit_submission_event(submission):
    team_id = submission.get("team_id")
    emit_to_team(
        "submission_updated",
        {"action": "updated", "team_id": team_id, "submission": submission},
        team_id,
    )


def emit_to_user(event, payload, user_id):
    if user_id is None or not has_app_context() or socketio.server is None:
        return
    socketio.emit(event, payload, room=user_room(user_id))


def emit_grade_event(grade):
    emit_to_user(
        "grade_published",
        {
            "action": "published" if grade.get("published") else "unpublished",
            "student_id": grade.get("student_id"),
            "project_id": grade.get("project_id"),
            "grade": grade.get("grade"),
        },
        grade.get("student_id"),
    )


def emit_team_message_event(message):
    team_id = message.get("team_id")
    emit_to_team(
        "message_created",
        {
            "action": "created",
            "team_id": team_id,
            "message_id": message.get("id"),
            "message": message,
        },
        team_id,
    )


def emit_friend_event(action, payload, user_id):
    emit_to_user(
        f"friend_{action}",
        {"action": action, **payload},
        user_id,
    )


def revoke_team_access(user_id, team_id):
    if user_id is None or team_id is None:
        return
    emit_to_user(
        "team_access_revoked",
        {"action": "revoked", "team_id": team_id},
        user_id,
    )
    if not has_app_context() or socketio.server is None:
        return
    room = user_room(user_id)
    for sid in socketio.server.manager.get_participants("/", room):
        socketio.server.leave_room(sid, team_room(team_id), namespace="/")
