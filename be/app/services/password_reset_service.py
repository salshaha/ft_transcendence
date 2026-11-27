"""Business logic for secure password recovery and token lifecycle."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
    is_email_configured,
    send_password_reset_email,
)
from app.utils.validation import normalize_email, validate_password

GENERIC_RESET_REQUEST_MESSAGE = (
    "If an account with that email exists, a password reset link has been sent."
)


class PasswordResetValidationError(ValueError):
    """Raised when the caller provides invalid password-reset input."""


class InvalidResetTokenError(ValueError):
    """Raised when a reset token is missing, invalid, expired, or already used."""


class PasswordResetStorageError(RuntimeError):
    """Raised when password-reset state cannot be persisted safely."""


def _hash_token(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _as_utc(value):
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _build_reset_url(raw_token):
    base_url = str(
        current_app.config.get("FRONTEND_URL")
        or current_app.config.get("FRONTEND_ORIGIN")
        or ""
    ).strip().rstrip("/")
    query = urlencode({"token": raw_token})
    return f"{base_url}/reset-password?{query}"


def request_password_reset(email):
    """Issue a single-use password-reset token and deliver it via Resend."""
    normalized_email = normalize_email(email)
    if not normalized_email:
        raise PasswordResetValidationError("A valid email address is required")

    if not is_email_configured():
        raise EmailConfigurationError(
            "Password reset email service is currently unavailable"
        )

    user = User.query.filter_by(email=normalized_email).first()
    if user is None or not user.password_hash:
        return GENERIC_RESET_REQUEST_MESSAGE

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    now = datetime.now(timezone.utc)
    expires_minutes = max(
        5, int(current_app.config.get("PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", 60))
    )
    expires_at = now + timedelta(minutes=expires_minutes)

    try:
        (
            db.session.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .update({PasswordResetToken.used_at: now}, synchronize_session=False)
        )
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.session.add(reset)
        db.session.flush()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Unable to stage password reset token")
        raise PasswordResetStorageError("Unable to process password reset request") from exc

    try:
        send_password_reset_email(
            to_email=user.email,
            reset_url=_build_reset_url(raw_token),
            first_name=user.first_name,
            expires_minutes=expires_minutes,
            idempotency_key=f"password-reset:{token_hash[:32]}",
        )
    except (EmailConfigurationError, EmailDeliveryError):
        db.session.rollback()
        raise

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Unable to commit password reset token")
        raise PasswordResetStorageError("Unable to process password reset request") from exc

    return GENERIC_RESET_REQUEST_MESSAGE


def validate_reset_token(raw_token):
    """Validate whether a raw reset token exists, is unused, and has not expired."""
    if not isinstance(raw_token, str) or not raw_token.strip():
        return False, "Reset token is required"

    token_hash = _hash_token(raw_token.strip())
    reset = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    now = datetime.now(timezone.utc)
    if (
        reset is None
        or reset.used_at is not None
        or _as_utc(reset.expires_at) <= now
    ):
        return False, "Invalid or expired reset token"

    user = db.session.get(User, reset.user_id)
    if user is None or not user.password_hash:
        return False, "Invalid or expired reset token"

    return True, None


def confirm_password_reset(*, raw_token, new_password):
    """Atomically consume a valid reset token, update password, and invalidate sessions."""
    if not isinstance(raw_token, str) or not raw_token.strip():
        raise PasswordResetValidationError("Reset token is required")

    password_error = validate_password(new_password)
    if password_error:
        raise PasswordResetValidationError(password_error)

    token_hash = _hash_token(raw_token.strip())
    now = datetime.now(timezone.utc)

    try:
        consumed_count = (
            db.session.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .update(
                {PasswordResetToken.used_at: now},
                synchronize_session=False,
            )
        )
        if consumed_count != 1:
            db.session.rollback()
            raise InvalidResetTokenError("Invalid or expired reset token")

        reset = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
        user = db.session.get(User, reset.user_id) if reset is not None else None
        if (
            reset is None
            or user is None
            or not user.password_hash
            or _as_utc(reset.expires_at) <= now
        ):
            db.session.rollback()
            raise InvalidResetTokenError("Invalid or expired reset token")

        user.password_hash = generate_password_hash(new_password)
        user.session_version = int(user.session_version or 1) + 1
        db.session.commit()
        return user
    except InvalidResetTokenError:
        raise
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception("Unable to complete password reset")
        raise PasswordResetStorageError("Unable to reset password") from exc
