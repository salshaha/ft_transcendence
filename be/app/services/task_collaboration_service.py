from io import BytesIO

from flask import current_app
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.student_dashboard import Project, Task, Team
from app.models.task_collaboration import TaskAttachment, TaskComment
from app.services.storage import StorageError
from app.services.task_service import can_give_task_feedback, can_read_team


COMMENT_KINDS = frozenset({"comment", "instructor_feedback"})


class TaskCollaborationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _task_query():
    return Task.query.options(
        joinedload(Task.team).joinedload(Team.project).joinedload(Project.course)
    )


def _load_task(task_id):
    task = _task_query().filter(Task.id == task_id).one_or_none()
    if task is None:
        raise TaskCollaborationError("Task not found", 404)
    return task


def _load_comment(comment_id):
    comment = (
        TaskComment.query.options(
            joinedload(TaskComment.task)
            .joinedload(Task.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(TaskComment.id == comment_id)
        .one_or_none()
    )
    if comment is None:
        raise TaskCollaborationError("Comment not found", 404)
    return comment


def _load_attachment(attachment_id):
    attachment = (
        TaskAttachment.query.options(
            joinedload(TaskAttachment.task)
            .joinedload(Task.team)
            .joinedload(Team.project)
            .joinedload(Project.course)
        )
        .filter(TaskAttachment.id == attachment_id)
        .one_or_none()
    )
    if attachment is None:
        raise TaskCollaborationError("Attachment not found", 404)
    return attachment


def _ensure_can_read(user, task):
    if not can_read_team(user, task.team):
        raise TaskCollaborationError("You cannot view this task", 403)


def _is_owner(entry, user):
    if hasattr(entry, "author_id"):
        return entry.author_id == user.id
    return entry.uploader_id == user.id


def _ensure_can_modify_entry(user, entry):
    if user.role == "admin" or _is_owner(entry, user):
        return
    raise TaskCollaborationError("You cannot modify this item", 403)


def _validate_body(value):
    if not isinstance(value, str) or not value.strip():
        raise TaskCollaborationError("Comment cannot be empty")
    body = value.strip()
    if len(body) > 5000:
        raise TaskCollaborationError("Comment must be 5000 characters or fewer")
    return body


def _validate_kind(value, user, task):
    kind = value or "comment"
    if kind not in COMMENT_KINDS:
        raise TaskCollaborationError("Invalid comment kind")
    if user.role == "instructor":
        if not can_give_task_feedback(user, task):
            raise TaskCollaborationError("You cannot provide feedback on this task", 403)
        return "instructor_feedback"
    if kind == "instructor_feedback":
        raise TaskCollaborationError("Only instructors can provide feedback", 403)
    return "comment"


def _person(user):
    if user is None:
        return None
    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}",
        "email": user.email,
    }


def _iso(value):
    return value.isoformat() if value is not None else None


def serialize_comment(comment):
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "body": comment.body,
        "kind": comment.kind,
        "author_id": comment.author_id,
        "author": _person(comment.author),
        "author_role": comment.author.role if comment.author else None,
        "created_at": _iso(comment.created_at),
        "updated_at": _iso(comment.updated_at),
    }


def serialize_attachment(attachment):
    return {
        "id": attachment.id,
        "task_id": attachment.task_id,
        "uploader_id": attachment.uploader_id,
        "uploader": _person(attachment.uploader),
        "file": {
            "key": attachment.file_key,
            "original_name": attachment.original_name,
            "content_type": attachment.content_type,
            "size": attachment.size,
            "sha256": attachment.sha256,
            "url": f"/api/attachments/{attachment.id}/file",
        },
        "created_at": _iso(attachment.created_at),
    }


def list_comments(user, task_id):
    task = _load_task(task_id)
    _ensure_can_read(user, task)
    comments = (
        TaskComment.query.filter_by(task_id=task.id)
        .options(joinedload(TaskComment.author))
        .order_by(TaskComment.created_at.asc(), TaskComment.id.asc())
        .all()
    )
    return [serialize_comment(comment) for comment in comments]


def create_comment(user, task_id, data):
    task = _load_task(task_id)
    _ensure_can_read(user, task)
    body = _validate_body(data.get("body", data.get("comment")))
    kind = _validate_kind(data.get("kind"), user, task)
    comment = TaskComment(task_id=task.id, author_id=user.id, body=body, kind=kind)
    db.session.add(comment)
    db.session.commit()
    return serialize_comment(comment)


def update_comment(user, comment_id, data):
    comment = _load_comment(comment_id)
    _ensure_can_modify_entry(user, comment)
    comment.body = _validate_body(data.get("body", data.get("comment")))
    db.session.commit()
    return serialize_comment(comment)


def delete_comment(user, comment_id):
    comment = _load_comment(comment_id)
    _ensure_can_modify_entry(user, comment)
    db.session.delete(comment)
    db.session.commit()
    return {"message": "Comment deleted"}


def list_attachments(user, task_id):
    task = _load_task(task_id)
    _ensure_can_read(user, task)
    attachments = (
        TaskAttachment.query.filter_by(task_id=task.id)
        .options(joinedload(TaskAttachment.uploader))
        .order_by(TaskAttachment.created_at.desc(), TaskAttachment.id.desc())
        .all()
    )
    return [serialize_attachment(attachment) for attachment in attachments]


def upload_attachment(user, task_id, file_storage):
    task = _load_task(task_id)
    _ensure_can_read(user, task)
    if user.role == "instructor":
        raise TaskCollaborationError("Instructors cannot upload task attachments", 403)
    if file_storage is None:
        raise TaskCollaborationError("A file is required")

    storage = current_app.extensions["storage"]
    stored = storage.save_upload(file_storage, "task_attachment", task.id)
    attachment = TaskAttachment(
        task_id=task.id,
        uploader_id=user.id,
        file_key=stored.key,
        original_name=stored.original_name,
        content_type=stored.content_type,
        size=stored.size,
        sha256=stored.sha256,
    )
    db.session.add(attachment)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        storage.delete(stored.key)
        raise
    return serialize_attachment(attachment)


def read_attachment_file(user, attachment_id, as_attachment=False):
    attachment = _load_attachment(attachment_id)
    _ensure_can_read(user, attachment.task)
    storage = current_app.extensions["storage"]
    try:
        stream = storage.open(attachment.file_key)
        data = stream.read()
        stream.close()
    except (StorageError, OSError) as exc:
        raise TaskCollaborationError("Unable to read attachment", 500) from exc
    return BytesIO(data), attachment.content_type, attachment.original_name, as_attachment


def delete_attachment(user, attachment_id):
    attachment = _load_attachment(attachment_id)
    _ensure_can_modify_entry(user, attachment)
    file_key = attachment.file_key
    db.session.delete(attachment)
    db.session.commit()
    current_app.extensions["storage"].delete(file_key)
    return {"message": "Attachment deleted"}
