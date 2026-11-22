import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
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
    from app.services.auth_service import get_authenticated_user

    user, _error = get_authenticated_user()
    if user is not None and (
        user.microsoft_tenant_id or user.microsoft_object_id or user.microsoft_id
    ):
        delete_token_cache(user.id)

    # Also clear any in-progress Microsoft OAuth flow.
    session.pop("microsoft_auth_flow", None)

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


import os
from urllib.parse import urlencode
from flask import Blueprint, current_app, redirect, session

from app.services.microsoft_identity import (
    MicrosoftIdentityError,
    complete_auth_flow,
    delete_token_cache,
    fetch_signed_in_profile,
    is_configured,
    save_token_cache,
    start_auth_flow,
)

microsoft_bp = Blueprint("microsoft_auth", __name__)


def _microsoft_frontend_redirect(error=None):
    target = current_app.config["FRONTEND_ORIGIN"].rstrip("/") + "/"
    if error:
        target += "?" + urlencode({"microsoft_error": str(error)[:240]})
    return redirect(target)


@microsoft_bp.route("/microsoft/status", methods=["GET"])
def microsoft_status():
    return jsonify({"configured": is_configured()}), 200


@microsoft_bp.route("/microsoft/login", methods=["GET"])
def microsoft_login():
    if not is_configured():
        return _microsoft_frontend_redirect(
            "Microsoft sign-in is not configured."
        )
    try:
        flow = start_auth_flow()
    except MicrosoftIdentityError as exc:
        return _microsoft_frontend_redirect(str(exc))
    session["microsoft_auth_flow"] = flow
    return redirect(flow["auth_uri"])


@microsoft_bp.route("/microsoft/callback", methods=["GET"])
def microsoft_callback():
    flow = session.pop("microsoft_auth_flow", None)

    if request.args.get("error"):
        return _microsoft_frontend_redirect(
            request.args.get("error_description") or request.args.get("error")
        )

    try:
        token_result, token_cache = complete_auth_flow(
            flow, request.args.to_dict(flat=True)
        )
    except MicrosoftIdentityError as exc:
        return _microsoft_frontend_redirect(str(exc))

    claims = token_result.get("id_token_claims") or {}
    tenant_id = claims.get("tid")
    object_id = claims.get("oid")
    if not tenant_id or not object_id:
        return _microsoft_frontend_redirect(
            "Microsoft did not return a work or school account identity."
        )

    try:
        profile = fetch_signed_in_profile(token_result["access_token"])
    except MicrosoftIdentityError as exc:
        return _microsoft_frontend_redirect(str(exc))

    email = normalize_email(
        claims.get("email")
        or claims.get("preferred_username")
        or claims.get("upn")
        or profile.get("mail")
        or profile.get("userPrincipalName")
    )
    if not email:
        return _microsoft_frontend_redirect(
            "Your Microsoft account did not provide a usable email address."
        )

    microsoft_id = f"{tenant_id}:{object_id}"

    try:
        user = User.query.filter_by(
            microsoft_tenant_id=tenant_id,
            microsoft_object_id=object_id,
        ).first()
        if user is None:
            user = User.query.filter_by(microsoft_id=microsoft_id).first()

        email_user = User.query.filter_by(email=email).first()
        if user is not None and email_user is not None and user.id != email_user.id:
            raise MicrosoftIdentityError(
                "This Microsoft account conflicts with an existing account. "
                "Contact your administrator."
            )
        if user is None and email_user is not None:
            # Do not link accounts automatically based solely on email.
            raise MicrosoftIdentityError(
                "This email address is already used by another account. "
                "Contact your administrator to link your Microsoft identity."
            )

        display_name = (
            claims.get("name")
            or profile.get("displayName")
            or email.split("@", 1)[0]
        ).strip()
        name_parts = display_name.split(None, 1)
        first_name = (
            claims.get("given_name")
            or profile.get("givenName")
            or (name_parts[0] if name_parts else "User")
        )
        last_name = (
            claims.get("family_name")
            or profile.get("surname")
            or (name_parts[1] if len(name_parts) > 1 else "User")
        )
        first_name = str(first_name).strip()[:100] or "User"
        last_name = str(last_name).strip()[:100] or "User"

        if user is None:
            user = User(
                first_name=first_name,
                last_name=last_name,
                email=email,
                role="student",
                student_id=f"MS-{tenant_id}-{object_id}"[:50],
                microsoft_id=microsoft_id,
                microsoft_tenant_id=tenant_id,
                microsoft_object_id=object_id,
                password_hash=None,
            )
            db.session.add(user)
        else:
            if not user.microsoft_tenant_id:
                user.microsoft_tenant_id = tenant_id
            if not user.microsoft_object_id:
                user.microsoft_object_id = object_id
            if not user.microsoft_id:
                user.microsoft_id = microsoft_id

        db.session.commit()
    except MicrosoftIdentityError as exc:
        db.session.rollback()
        return _microsoft_frontend_redirect(str(exc))
    except (IntegrityError, SQLAlchemyError):
        db.session.rollback()
        current_app.logger.exception("Microsoft account sign-in failed")
        return _microsoft_frontend_redirect(
            "Unable to connect this Microsoft account. Please try again or "
            "contact your administrator."
        )

    try:
        save_token_cache(user.id, token_cache)
    except MicrosoftIdentityError:
        # Token caching is best-effort for the auth milestone.
        current_app.logger.warning("Unable to store Microsoft token cache")

    start_user_session(user)
    return _microsoft_frontend_redirect()


