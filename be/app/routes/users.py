from email_validator import EmailNotValidError, validate_email
from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models.user import User

users_bp = Blueprint("users", __name__)


def see_if_validate_email(email):
    if not isinstance(email, str):
        return False
    try:
        return validate_email(email.strip(), check_deliverability=False).normalized.casefold()
    except EmailNotValidError:
        return False


@users_bp.route("/update_info", methods=["PUT"])
def update_info():
    user_id = session.get("user_id")
    if user_id is None:
        return jsonify({"message": "No user is logged in"}), 401

    user = db.session.get(User, user_id)
    if user is None:
        session.clear()
        return jsonify({"message": "User not found"}), 404

    data = request.get_json(silent=True) or request.form
    password = data.get("password")
    email = data.get("email")

    if password is not None:
        if not isinstance(password, str) or len(password) < 8:
            return jsonify({"message": "Password must be at least 8 characters"}), 400
        user.password_hash = generate_password_hash(password)

    if email is not None:
        normalized_email = see_if_validate_email(email)
        if not normalized_email:
            return jsonify({"message": "Invalid email address"}), 400
        user.email = normalized_email

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Email already exists"}), 409

    return jsonify({"message": "Information updated successfully"}), 200
