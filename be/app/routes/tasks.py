# tasks.py

from flask import Blueprint, request

tasks_bp = Blueprint("tasks", __name__)
# app = Flask(__name__)

@tasks_bp.route('/tasks', methods=['GET'])
def show_tasks():
    return get_tasks()

def get_tasks():
    return str(list_of_tasks)

# to be removed after connecting to the database model
list_of_tasks = []

@tasks_bp.route('/tasks', methods=['POST'])
def add_task():
    task = request.form.get('task')
    list_of_tasks.append(task)
    return show_tasks()

@tasks_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if 0 <= task_id < len(list_of_tasks):
        list_of_tasks.pop(task_id)
        return show_tasks()
    else:
        return "Task not found", 404

@tasks_bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update(task_id):
    if 0 <= task_id < len(list_of_tasks):
        new_task = request.form.get('task')
        list_of_tasks[task_id] = new_task
        return list_of_tasks
    else:
        return "Task not found", 404

