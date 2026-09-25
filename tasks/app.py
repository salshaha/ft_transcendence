from flask import Flask, request
from flask import Flask
from login.login import user_

app = Flask(__name__)

app.register_blueprint(user_)

if __name__ == "__main__":
    app.run(debug=True)

@app.route('/tasks', methods=['GET'])
def show_tasks():
    return get_tasks()

def get_tasks():
    return str(list_of_tasks)

list_of_tasks = []

@app.route('/tasks', methods=['POST'])
def add_task():
    task = request.form.get('task')
    list_of_tasks.append(task)
    return show_tasks()

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if 0 <= task_id < len(list_of_tasks):
        list_of_tasks.pop(task_id)
        return show_tasks()
    else:
        return "Task not found", 404

@app.route('/tasks/<int:task_id>', methods=['PUT'])
def update(task_id):
    if 0 <= task_id < len(list_of_tasks):
        new_task = request.form.get('task')
        list_of_tasks[task_id] = new_task
        return list_of_tasks
    else:
        return "Task not found", 404

