from flask import Blueprint, jsonify, request, session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db


tasks_bp = Blueprint("tasks", __name__)

TASK_STATUSES = {"todo", "in_progress", "review", "done"}


def _request_data():
    return request.get_json(silent=True) or request.form


def _serialize_task(task):
    return dict(task)


def _load_tasks(team_id=None):
    query = (
        "SELECT id, team_id, assignee_id, created_by, created_at, "
        "updated_at, title, due_date, status, description "
        "FROM tasks"
    )
    parameters = {}
    if team_id is not None:
        query += " WHERE team_id = :team_id"
        parameters["team_id"] = team_id
    query += " ORDER BY id"

    rows = db.session.execute(text(query), parameters).mappings().all()
    return [_serialize_task(row) for row in rows]


@tasks_bp.route("/tasks", methods=["GET"])
def show_tasks():
    team_id = request.args.get("team_id", type=int)
    try:
        return jsonify(_load_tasks(team_id)), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to load tasks"}), 500


@tasks_bp.route("/tasks", methods=["POST"])
def add_task():
    user_id = session.get("user_id")
    if user_id is None:
        return jsonify({"message": "No user is logged in"}), 401

    data = _request_data()
    title = data.get("title", data.get("task"))
    team_id = data.get("team_id")
    if not title or team_id is None:
        return jsonify({"message": "title and team_id are required"}), 400

    status = data.get("status", "todo")
    if status not in TASK_STATUSES:
        return jsonify({"message": "Invalid task status"}), 400

    try:
        result = db.session.execute(
            text(
                "INSERT INTO tasks "
                "(team_id, assignee_id, created_by, title, due_date, status, description) "
                "VALUES (:team_id, :assignee_id, :created_by, :title, :due_date, "
                ":status, :description) "
                "RETURNING id"
            ),
            {
                "team_id": team_id,
                "assignee_id": data.get("assignee_id"),
                "created_by": user_id,
                "title": title,
                "due_date": data.get("due_date"),
                "status": status,
                "description": data.get("description"),
            },
        )
        task_id = result.scalar_one()
        db.session.commit()
        return jsonify(_load_task(task_id)), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Invalid team, assignee, or task data"}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to create task"}), 500


def _load_task(task_id):
    row = db.session.execute(
        text(
            "SELECT id, team_id, assignee_id, created_by, created_at, "
            "updated_at, title, due_date, status, description "
            "FROM tasks WHERE id = :task_id"
        ),
        {"task_id": task_id},
    ).mappings().first()
    return _serialize_task(row) if row else None


@tasks_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    try:
        result = db.session.execute(
            text("DELETE FROM tasks WHERE id = :task_id RETURNING id"),
            {"task_id": task_id},
        )
        if result.scalar_one_or_none() is None:
            db.session.rollback()
            return jsonify({"message": "Task not found"}), 404
        db.session.commit()
        return jsonify({"message": "Task deleted successfully"}), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to delete task"}), 500


@tasks_bp.route("/tasks/<int:task_id>", methods=["PUT"])
def update(task_id):
    data = _request_data()
    updates = {}
    for column in ("team_id", "assignee_id", "due_date", "status", "description"):
        if column in data:
            updates[column] = data.get(column)

    if "title" in data or "task" in data:
        updates["title"] = data.get("title", data.get("task"))
    if not updates:
        return jsonify({"message": "At least one task field is required"}), 400
    if "title" in updates and not updates["title"]:
        return jsonify({"message": "title cannot be empty"}), 400
    if "status" in updates and updates["status"] not in TASK_STATUSES:
        return jsonify({"message": "Invalid task status"}), 400

    assignments = ", ".join(
        f"{column} = :{column}" for column in updates
    )
    parameters = {**updates, "task_id": task_id}

    try:
        result = db.session.execute(
            text(
                f"UPDATE tasks SET {assignments} "
                "WHERE id = :task_id RETURNING id"
            ),
            parameters,
        )
        if result.scalar_one_or_none() is None:
            db.session.rollback()
            return jsonify({"message": "Task not found"}), 404
        db.session.commit()
        return jsonify(_load_task(task_id)), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Invalid team, assignee, or task data"}), 400
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to update task"}), 500
