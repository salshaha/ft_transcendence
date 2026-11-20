from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.auth_service import get_authenticated_user
from app.services.task_service import (
    TaskError,
    create_task,
    delete_task,
    list_tasks,
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
    try:
        return jsonify(list_tasks(user, team_id)), 200
    except TaskError as exc:
        return jsonify({"message": exc.message}), exc.status
    except SQLAlchemyError:
        return _database_error("Unable to load tasks")


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
