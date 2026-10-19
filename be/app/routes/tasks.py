# tasks.py

import os

from flask import Blueprint, request
from sqlalchemy import create_engine, text

tasks_bp = Blueprint("tasks", __name__)


def _get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be set")
    return create_engine(database_url)

@tasks_bp.route('/tasks', methods=['GET'])
def show_tasks():
    return get_tasks()

def get_tasks():
    with _get_engine().connect() as connection:
        tasks = connection.execute(
            text("SELECT task FROM tasks ORDER BY id")
        ).scalars().all()
    return str(tasks)

@tasks_bp.route('/tasks', methods=['POST'])
def add_task():
    task = request.form.get('task')
    with _get_engine().begin() as connection:
        connection.execute(
            text("INSERT INTO tasks (task) VALUES (:task)"),
            {"task": task},
        )
    return show_tasks()

@tasks_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    with _get_engine().begin() as connection:
        result = connection.execute(
            text("DELETE FROM tasks WHERE id = :task_id"),
            {"task_id": task_id},
        )
    if result.rowcount == 0:
        return "Task not found", 404
    return show_tasks()

@tasks_bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update(task_id):
    new_task = request.form.get('task')
    with _get_engine().begin() as connection:
        result = connection.execute(
            text("UPDATE tasks SET task = :task WHERE id = :task_id"),
            {"task": new_task, "task_id": task_id},
        )
    if result.rowcount == 0:
        return "Task not found", 404
    return show_tasks()