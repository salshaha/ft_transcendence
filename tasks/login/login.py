from template.users import users
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from email_validator import validate_email, EmailNotValidError


user_ = Blueprint("user", __name__)


@user_.route("/login", methods=["POST"])
def login():
    data = request.json

    password = data.get("password")
    email = data.get("email")

    if not email or not password:
        return jsonify({"wrong email or password"}), 401

    for user in users:
        if user["email"] == email:
            if check_password_hash(user["password"], password):
                session.clear()
                session.permanent = True
                session["email"] = user["email"]
                return jsonify({"message": "Login successful"}), 200

    return jsonify({"wrong email or password"}), 401

@user_.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout successful"}), 200


def see_if_validate_email(email):
	try:
		normalized = validate_email(email, check_deliverability=True)
		return normalized
	except EmailNotValidError:
		return False

@user_.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")

    if not name or not email or not password:
        return jsonify({
            "message": "Name, email and password are required"}), 400

    email = see_if_validate_email(email)
    if not email:
        return jsonify({"message": "Invalid email address"}), 400

    for user in users:
        if user["email"] == email:
            return jsonify({"message": "Email already exists"}), 409

    new_user = {
        "name": name,
        "email": email,
        "password": generate_password_hash(password),
        "phone": phone
    }

    users.append(new_user)

    return jsonify({
        "message": "User created successfully",
        "user": {
            "name": new_user["name"],
            "email": new_user["email"]
        }
    }), 201
