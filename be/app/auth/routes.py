from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash
from email_validator import EmailNotValidError, validate_email

from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)
PUBLIC_ROLES = {"student", "instructor"}


def normalize_email(value):
    if not isinstance(value, str):
        return None
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized.casefold()
    except EmailNotValidError:
        return None


def public_user(user):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = normalize_email(data.get("email"))
    password = data.get("password")
    role = data.get("role")
    student_id = data.get("student_id")

    if not isinstance(first_name, str) or not first_name.strip():
        return jsonify({"message": "First name is required"}), 400
    if not isinstance(last_name, str) or not last_name.strip():
        return jsonify({"message": "Last name is required"}), 400
    first_name = first_name.strip()
    last_name = last_name.strip()
    if len(first_name) > 100 or len(last_name) > 100:
        return jsonify({"message": "Names must be 100 characters or fewer"}), 400
    if not email:
        return jsonify({"message": "A valid email address is required"}), 400
    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters"}), 400
    if not isinstance(role, str) or role not in PUBLIC_ROLES:
        return jsonify({"message": "Role must be student or instructor"}), 400

    if role == "student":
        if not isinstance(student_id, str) or not student_id.strip():
            return jsonify({"message": "Student ID is required for students"}), 400
        student_id = student_id.strip()
        if len(student_id) > 50:
            return jsonify({"message": "Student ID must be 50 characters or fewer"}), 400
    else:
        student_id = None

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already exists"}), 409

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        student_id=student_id,
    )
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Email or student ID already exists"}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Unable to register user")
        return jsonify({"message": "Unable to create account"}), 500

    return jsonify({
        "message": "User created successfully",
        "user": public_user(user),
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Wrong email or password"}), 401

    email = normalize_email(data.get("email"))
    password = data.get("password")
    if not email or not isinstance(password, str):
        return jsonify({"message": "Wrong email or password"}), 401

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Wrong email or password"}), 401

    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["email"] = user.email
    return jsonify({
        "message": "Login successful",
        "user": public_user(user),
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout successful"}), 200
