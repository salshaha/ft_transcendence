from flask import Blueprint, jsonify, request, send_file
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.auth_service import get_authenticated_user
from app.services.storage import StorageError, StorageValidationError
from app.services.task_collaboration_service import (
    TaskCollaborationError,
    create_comment,
    delete_attachment,
    delete_comment,
    list_attachments,
    list_comments,
    read_attachment_file,
    update_comment,
    upload_attachment,
)

task_collaboration_bp = Blueprint("task_collaboration", __name__)


def _database_error(message):
    db.session.rollback()
    return jsonify({"message": message}), 500


def _request_data():
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data
    return request.form


def _wants_download():
    return str(request.args.get("download", "")).lower() in {"1", "true", "yes"}


@task_collaboration_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
def comments_for_task(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"comments": list_comments(user, task_id)}), 200
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to load comments")


@task_collaboration_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
def add_comment(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"comment": create_comment(user, task_id, _request_data())}), 201
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to save comment")


@task_collaboration_bp.route("/comments/<int:comment_id>", methods=["PUT"])
def edit_comment(comment_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"comment": update_comment(user, comment_id, _request_data())}), 200
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to update comment")


@task_collaboration_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
def remove_comment(comment_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify(delete_comment(user, comment_id)), 200
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to delete comment")


@task_collaboration_bp.route("/tasks/<int:task_id>/attachments", methods=["GET"])
def attachments_for_task(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify({"attachments": list_attachments(user, task_id)}), 200
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to load attachments")


@task_collaboration_bp.route("/tasks/<int:task_id>/attachments", methods=["POST"])
def add_attachment(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    file_storage = request.files.get("file") or request.files.get("attachment")
    try:
        attachment = upload_attachment(user, task_id, file_storage)
        return jsonify({"attachment": attachment}), 201
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except StorageValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except (StorageError, OSError):
        return jsonify({"message": "Unable to store attachment"}), 500
    except SQLAlchemyError:
        return _database_error("Unable to save attachment")


@task_collaboration_bp.route("/attachments/<int:attachment_id>/file", methods=["GET"])
def attachment_file(attachment_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        stream, content_type, download_name, as_attachment = read_attachment_file(
            user, attachment_id, _wants_download()
        )
        return send_file(
            stream,
            mimetype=content_type,
            as_attachment=as_attachment,
            download_name=download_name,
        )
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except (StorageError, OSError):
        return jsonify({"message": "Unable to read attachment"}), 500


@task_collaboration_bp.route("/attachments/<int:attachment_id>", methods=["DELETE"])
def remove_attachment(attachment_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    try:
        return jsonify(delete_attachment(user, attachment_id)), 200
    except TaskCollaborationError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to delete attachment")
