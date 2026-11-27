from flask import Blueprint, current_app, jsonify, redirect, request, session
import requests
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models.user import User
from app.security.csrf import get_csrf_token
from app.security.rate_limit import limiter, get_remote_address
from app.services.auth_service import (
    clear_user_session,
    get_authenticated_user,
    serialize_session_user,
    start_user_session,
)
from app.services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
)
from app.services.password_reset_service import (
    InvalidResetTokenError,
    PasswordResetStorageError,
    PasswordResetValidationError,
    confirm_password_reset as complete_password_reset,
    request_password_reset as initiate_password_reset,
    validate_reset_token,
)
from app.services.user_service import (
    UserConflictError,
    UserValidationError,
    create_user,
)
from app.services.microsoft_identity import (
    MicrosoftIdentityError,
    complete_auth_flow,
    fetch_signed_in_profile,
    is_configured,
    save_token_cache,
    start_auth_flow,
)
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
@limiter.limit("5 per hour", key_func=get_remote_address)
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
@limiter.limit("10 per minute", key_func=get_remote_address)
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


def _microsoft_frontend_redirect(error=None):
    target = current_app.config["FRONTEND_ORIGIN"].rstrip("/") + "/"
    if error:
        from urllib.parse import urlencode

        target += "?" + urlencode({"microsoft_error": str(error)[:240]})
    return redirect(target)


@auth_bp.route("/microsoft/status", methods=["GET"])
def microsoft_status():
    return jsonify({"configured": is_configured()}), 200


@auth_bp.route("/microsoft/login", methods=["GET"])
def microsoft_login():
    try:
        flow = start_auth_flow()
        session["microsoft_auth_flow"] = flow
        return redirect(flow["auth_uri"])
    except MicrosoftIdentityError as exc:
        return _microsoft_frontend_redirect(str(exc))


@auth_bp.route("/microsoft/callback", methods=["GET"])
def microsoft_callback():
    flow = session.pop("microsoft_auth_flow", None)
    if request.args.get("error"):
        return _microsoft_frontend_redirect(
            request.args.get("error_description") or request.args["error"]
        )

    try:
        token_result, token_cache = complete_auth_flow(
            flow, request.args.to_dict(flat=True)
        )
        claims = token_result["id_token_claims"]
        tenant_id = claims.get("tid")
        object_id = claims.get("oid")
        if not tenant_id or not object_id:
            raise MicrosoftIdentityError(
                "Microsoft did not return a work or school account identity."
            )

        profile = fetch_signed_in_profile(token_result["access_token"])
        email = normalize_email(
            claims.get("email")
            or profile.get("mail")
            or claims.get("preferred_username")
            or claims.get("upn")
            or profile.get("userPrincipalName")
        )
        if not email:
            raise MicrosoftIdentityError(
                "Your Microsoft account did not provide a usable email address."
            )

        microsoft_id = f"{tenant_id}:{object_id}"
        user = User.query.filter_by(microsoft_id=microsoft_id).first()
        email_user = User.query.filter_by(email=email).first()
        if user and email_user and user.id != email_user.id:
            raise MicrosoftIdentityError(
                "This Microsoft account conflicts with an existing account. Contact your administrator."
            )
        user = user or email_user
        if user and user.microsoft_id and user.microsoft_id != microsoft_id:
            raise MicrosoftIdentityError(
                "This account is already linked to a different Microsoft identity. Contact your administrator."
            )

        if user is None:
            display_name = (
                claims.get("name")
                or profile.get("displayName")
                or email.split("@", 1)[0]
            ).strip()
            name_parts = display_name.split(None, 1)
            first_name = (
                claims.get("given_name")
                or profile.get("givenName")
                or name_parts[0]
            )[:100]
            last_name = (
                claims.get("family_name")
                or profile.get("surname")
                or (name_parts[1] if len(name_parts) > 1 else "Student")
            )[:100]
            user = User(
                first_name=first_name,
                last_name=last_name,
                email=email,
                role="student",
                student_id=f"MS-{object_id}"[:50],
                microsoft_id=microsoft_id,
            )
            db.session.add(user)
        else:
            user.microsoft_id = microsoft_id
            if user.role == "student" and not user.student_id:
                user.student_id = f"MS-{object_id}"[:50]

        db.session.commit()
        save_token_cache(user.id, token_cache)
        start_user_session(user)
        return _microsoft_frontend_redirect()
    except MicrosoftIdentityError as exc:
        db.session.rollback()
        return _microsoft_frontend_redirect(str(exc))
    except (IntegrityError, SQLAlchemyError):
        db.session.rollback()
        current_app.logger.exception("Microsoft account sign-in failed")
        return _microsoft_frontend_redirect(
            "Unable to connect this Microsoft account. Please try again or contact your administrator."
        )
    except requests.RequestException:
        db.session.rollback()
        current_app.logger.exception("Microsoft Graph profile request failed")
        return _microsoft_frontend_redirect(
            "Microsoft Graph could not be reached. Please try again."
        )


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


@auth_bp.route("/forgot-password", methods=["POST"])
@auth_bp.route("/password-reset/request", methods=["POST"])
@limiter.limit(
    lambda: current_app.config.get("PASSWORD_RESET_REQUEST_LIMIT", "5 per hour"),
    key_func=get_remote_address,
)
def request_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    try:
        message = initiate_password_reset(data.get("email"))
    except PasswordResetValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except EmailConfigurationError:
        return jsonify({
            "message": "Password reset email service is currently unavailable. Please try again later."
        }), 503
    except EmailDeliveryError:
        return jsonify({
            "message": "Unable to send password reset email right now. Please try again later."
        }), 503
    except PasswordResetStorageError:
        return jsonify({"message": "Unable to process password reset request"}), 500

    return jsonify({"message": message}), 200


@auth_bp.route("/reset-password/validate", methods=["POST"])
@auth_bp.route("/password-reset/validate", methods=["POST"])
@limiter.limit("20 per hour", key_func=get_remote_address)
def validate_password_reset_token():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"valid": False, "message": "A JSON object is required"}), 400

    is_valid, error_message = validate_reset_token(data.get("token"))
    if not is_valid:
        return jsonify({"valid": False, "message": error_message}), 400

    return jsonify({"valid": True, "message": "Reset token is valid"}), 200


@auth_bp.route("/reset-password", methods=["POST"])
@auth_bp.route("/password-reset/confirm", methods=["POST"])
@limiter.limit(
    lambda: current_app.config.get("PASSWORD_RESET_CONFIRM_LIMIT", "10 per hour"),
    key_func=get_remote_address,
)
def confirm_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A JSON object is required"}), 400

    raw_token = data.get("token")
    new_password = data.get("new_password", data.get("password"))
    confirm_password = data.get("confirm_password")
    if confirm_password is not None and confirm_password != new_password:
        return jsonify({"message": "Passwords do not match"}), 400

    try:
        user = complete_password_reset(
            raw_token=raw_token,
            new_password=new_password,
        )
    except PasswordResetValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except InvalidResetTokenError as exc:
        return jsonify({"message": str(exc)}), 400
    except PasswordResetStorageError:
        return jsonify({"message": "Unable to reset password"}), 500

    if session.get("user_id") == user.id:
        csrf_token = clear_user_session()
    else:
        csrf_token = get_csrf_token()

    return jsonify({
        "message": "Password reset successfully",
        "csrf_token": csrf_token,
    }), 200


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


