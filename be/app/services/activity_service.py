import hashlib
from urllib.parse import parse_qs, urlsplit

from flask import current_app, g, request, session
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models.activity_event import ActivityEvent


# Endpoint names are internal Flask blueprint/function names. Recording these
# selected successful changes centrally keeps the activity feed consistent
# without saving request bodies, passwords, grades, or message contents.
_TRACKED_ENDPOINTS = {
    "auth.login": ("signed_in", "session", None),
    "auth.logout": ("signed_out", "session", None),
    "auth.register": ("account_created", "user", None),
    "auth.confirm_password_reset": ("password_reset_completed", "user", None),
    "auth.microsoft_callback": ("signed_in", "session", None),
    "admin.create_user": ("user_created", "user", None),
    "admin.update_user": ("user_updated", "user", "user_id"),
    "admin.delete_user": ("user_deleted", "user", "user_id"),
    "admin.create_course_route": ("course_created", "course", None),
    "admin.update_course_route": ("course_updated", "course", "course_id"),
    "admin.delete_course_route": ("course_deleted", "course", "course_id"),
    "admin.enroll_student_route": ("student_enrolled", "course", "course_id"),
    "admin.remove_student_route": ("student_removed", "course", "course_id"),
    "admin.import_data": ("data_imported", "data", None),
    "instructor.create_course_project": ("project_created", "project", "course_id"),
    "instructor.update_course_project": ("project_updated", "project", "project_id"),
    "instructor.delete_course_project": ("project_deleted", "project", "project_id"),
    "instructor.upload_requirements": ("requirements_uploaded", "project", "project_id"),
    "instructor.sync_microsoft_courses": ("courses_synchronized", "course", None),
    "instructor.create_or_update_grade": ("grade_saved", "grade", None),
    "student.create_team_route": ("team_created", "team", None),
    "student.join_team_route": ("team_joined", "team", "team_id"),
    "student.leave_team_route": ("team_left", "team", "team_id"),
    "student.submit_project_route": ("submission_created", "submission", "team_id"),
    "student.peer_feedback_route": ("peer_feedback_submitted", "peer_feedback", None),
    "users.update_info": ("credentials_updated", "user", None),
    "users.update_me": ("profile_updated", "user", None),
    "users.upload_avatar": ("avatar_uploaded", "user", None),
    "users.delete_avatar": ("avatar_deleted", "user", None),
    "users.add_skill": ("skill_added", "skill", None),
    "users.update_skill": ("skill_updated", "skill", "skill_id"),
    "users.remove_skill": ("skill_removed", "skill", "skill_id"),
    "tasks.add_task": ("task_created", "task", None),
    "tasks.update": ("task_updated", "task", "task_id"),
    "tasks.delete": ("task_deleted", "task", "task_id"),
}


def _response_entity_id(response, entity_type):
    if not response.is_json:
        return None
    try:
        payload = response.get_json(silent=True) or {}
    except (TypeError, ValueError):
        return None

    if entity_type == "data":
        return payload.get("entity")
    if entity_type == "user" and payload.get("user"):
        return payload["user"].get("id")
    if entity_type == "course" and payload.get("course"):
        return payload["course"].get("id")
    if entity_type == "team" and payload.get("team"):
        return payload["team"].get("id")
    if entity_type == "task" and payload.get("task"):
        return payload["task"].get("id")
    if entity_type == "project" and payload.get("project"):
        return payload["project"].get("id")
    return None


def init_activity_tracking(app):
    @app.before_request
    def remember_activity_actor():
        g.activity_actor_id = session.get("user_id")

    @app.after_request
    def record_successful_activity(response):
        tracked = _TRACKED_ENDPOINTS.get(request.endpoint)
        successful = 200 <= response.status_code < 300
        if request.endpoint == "auth.microsoft_callback" and response.status_code == 302:
            successful = not parse_qs(urlsplit(response.headers.get("Location", "")).query).get("microsoft_error")
        if tracked is None or not successful:
            return response

        action, entity_type, resource_argument = tracked
        actor_id = session.get("user_id") or getattr(g, "activity_actor_id", None)
        if request.endpoint == "auth.register":
            actor_id = _response_entity_id(response, "user")
        if request.endpoint == "auth.confirm_password_reset" and actor_id is None:
            payload = request.get_json(silent=True) or {}
            reset_token = payload.get("token")
            if isinstance(reset_token, str) and reset_token:
                from app.models.password_reset import PasswordResetToken

                token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
                reset = PasswordResetToken.query.filter_by(
                    token_hash=token_hash
                ).first()
                actor_id = reset.user_id if reset else None
        if actor_id is None:
            return response

        route_ids = {
            key: value
            for key, value in (request.view_args or {}).items()
            if key.endswith("_id") and isinstance(value, (int, str))
        }
        resource_id = (
            route_ids.get(resource_argument) if resource_argument else None
        )
        if resource_id is None:
            resource_id = _response_entity_id(response, entity_type)
        if entity_type == "user" and resource_id is None:
            resource_id = actor_id
        details = {"record_count": None} if entity_type == "data" else route_ids
        if entity_type == "data" and response.is_json:
            payload = response.get_json(silent=True) or {}
            details = {"record_count": payload.get("imported", 0)}

        try:
            db.session.add(ActivityEvent(
                actor_user_id=actor_id,
                action=action,
                entity_type=entity_type,
                entity_id=str(resource_id) if resource_id is not None else None,
                details=details or None,
            ))
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            current_app.logger.exception("Unable to record user activity")
        return response
