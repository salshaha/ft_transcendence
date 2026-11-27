from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.auth_service import get_authenticated_user
from app.services.task_service import (
    TaskError,
    create_task,
    delete_task,
    list_tasks,
    task_attachment_rules,
    update_task,
)

tasks_bp = Blueprint("tasks", __name__)


def _request_data():
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data
    return request.form


def _database_error(message):
    db.session.rollback()
    current_app.logger.exception(message)
    return jsonify({"message": message}), 500


@tasks_bp.route("/tasks", methods=["GET"])
def show_tasks():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    team_id = request.args.get("team_id")
    paginate = request.args.get("paginate", "").lower() in {"1", "true", "yes"}
    try:
        tasks = list_tasks(
            user,
            team_id,
            search=request.args.get("search"),
            status=request.args.get("status"),
            assignee_id=request.args.get("assignee_id"),
            project_id=request.args.get("project_id"),
            sort=request.args.get("sort", "created_at"),
            order=request.args.get("order", "desc"),
            page=request.args.get("page", 1),
            per_page=request.args.get("per_page", 12),
            paginate=paginate,
        )
        return jsonify(tasks), 200
    except TaskError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to load tasks")


@tasks_bp.route("/tasks/attachment-rules", methods=["GET"])
def show_task_attachment_rules():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status
    return jsonify(task_attachment_rules()), 200


@tasks_bp.route("/tasks", methods=["POST"])
def add_task():
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        return jsonify(create_task(user, _request_data())), 201
    except TaskError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to create task")


@tasks_bp.route("/tasks/<int:task_id>", methods=["PUT"])
def update(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        return jsonify(update_task(user, task_id, _request_data())), 200
    except TaskError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to update task")


@tasks_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
def delete(task_id):
    user, error = get_authenticated_user()
    if error:
        message, status = error
        return jsonify({"message": message}), status

    try:
        return jsonify(delete_task(user, task_id)), 200
    except TaskError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to delete task")
