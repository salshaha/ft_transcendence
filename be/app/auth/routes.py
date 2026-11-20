import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.security.csrf import get_csrf_token
from app.services.auth_service import (
    clear_user_session,
    get_authenticated_user,
    serialize_session_user,
    start_user_session,
)
from app.services.user_service import (
    UserConflictError,
    UserValidationError,
    create_user,
    set_password,
)
from app.utils.validation import validate_password
from app.utils.validation import normalize_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.after_request
def prevent_auth_response_caching(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return response


@auth_bp.route("/csrf", methods=["GET"])
def csrf():
    """Bootstrap the synchronizer token used by state-changing requests."""
    return jsonify({"csrf_token": get_csrf_token()}), 200


@auth_bp.route("/session", methods=["GET"])
def session_info():
    """Return the signed-in user, if any, so the frontend can restore state."""
    user, error = get_authenticated_user()
    if error:
        return jsonify({
            "authenticated": False,
            "user": None,
            "csrf_token": get_csrf_token(),
        }), 200

    return jsonify({
        "authenticated": True,
        "user": serialize_session_user(user),
        "csrf_token": get_csrf_token(),
    }), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    role = data.get("role", "student")
    if role == "instructor":
        return jsonify({
            "message": (
                "Instructor accounts are created by an administrator. "
                "Contact your administrator to request access."
            )
        }), 403
    if role != "student":
        return jsonify({"message": "Role must be student"}), 400

    try:
        user = create_user(
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            email=data.get("email"),
            password=data.get("password"),
            role="student",
            student_id=data.get("student_id"),
        )
    except UserValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except UserConflictError as exc:
        return jsonify({"message": str(exc)}), 409
    except SQLAlchemyError:
        current_app.logger.exception("Unable to register user")
        return jsonify({"message": "Unable to create account"}), 500

    return jsonify({
        "message": "User created successfully",
        "user": serialize_session_user(user),
        "csrf_token": get_csrf_token(),
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
    if (
        not user
        or not user.password_hash
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"message": "Wrong email or password"}), 401

    csrf_token = start_user_session(user)
    return jsonify({
        "message": "Login successful",
        "user": serialize_session_user(user),
        "csrf_token": csrf_token,
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    csrf_token = clear_user_session()
    return jsonify({
        "message": "Logout successful",
        "csrf_token": csrf_token,
    }), 200


@auth_bp.route("/password-reset/request", methods=["POST"])
def request_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    email = normalize_email(data.get("email"))
    response = {"message": "If the account exists, a reset token has been issued."}
    if not email:
        return jsonify(response), 200

    user = User.query.filter_by(email=email).first()
    if user is None or not user.password_hash:
        return jsonify(response), 200

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.session.add(reset)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to issue reset token"}), 500

    response["reset_token"] = raw_token
    return jsonify(response), 200


@auth_bp.route("/password-reset/confirm", methods=["POST"])
def confirm_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    raw_token = data.get("token")
    new_password = data.get("new_password", data.get("password"))
    if not isinstance(raw_token, str) or not raw_token:
        return jsonify({"message": "Reset token is required"}), 400

    password_error = validate_password(new_password)
    if password_error:
        return jsonify({"message": password_error}), 400

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    reset = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if (
        reset is None
        or reset.used_at is not None
        or reset.expires_at < datetime.now(timezone.utc)
    ):
        return jsonify({"message": "Invalid or expired reset token"}), 400

    user = db.session.get(User, reset.user_id)
    if user is None:
        return jsonify({"message": "Invalid or expired reset token"}), 400

    try:
        set_password(user, new_password)
        reset.used_at = datetime.now(timezone.utc)
        db.session.commit()
    except (UserValidationError, SQLAlchemyError):
        db.session.rollback()
        return jsonify({"message": "Unable to reset password"}), 400

    return jsonify({"message": "Password reset successfully"}), 200
