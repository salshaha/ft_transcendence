# routes.py

# from template.users import users
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

# user_ = Blueprint("user", __name__)
auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json

    password = data.get("password")
    email = data.get("email")

    if not email or not password:
        return "wrong email or password", 401

	# this is a temporary solution, we will replace it with a database query later because we are using a database to store user information
	# instead of a list of users, we will use a database to store user information
    for user in users:
        if user["email"] == email:
            if check_password_hash(user["password"], password):
                return jsonify({"message": "Login successful"}), 200

    return jsonify({"wrong email or password"}), 401

# need to fix
@auth_bp.route("/logout")
def logout():
    return jsonify({"message": "Logout successful"}), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")

    if not name or not email or not password:
        return jsonify({
            "message": "Name, email and password are required"}), 400

    for user in users:
        if user["email"] == email:
            return jsonify({"message": "Email already exists"}), 409

    new_user = {
        "name": name,
        "email": email,
        "password": generate_password_hash(password),
        "phone": phone
    }

	# this will also be replaced with a database query later because we are using a database to store user information instead of a list of users
	# we should insert the new user into the database instead of appending it to the list of users
    users.append(new_user)

    return jsonify({
        "message": "User created successfully",
        "user": {
            "name": new_user["name"],
            "email": new_user["email"]
        }
    }), 201
