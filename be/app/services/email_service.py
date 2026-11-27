"""Transactional email delivery service powered by the official Resend SDK."""

import re
import secrets
from threading import Lock

import resend
from flask import current_app
from resend.exceptions import ResendError

from app.services.email_templates import render_password_reset_email

_RESEND_CLIENT_LOCK = Lock()
_SAFE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")


class EmailConfigurationError(RuntimeError):
    """Raised when outbound email settings are incomplete."""


class EmailDeliveryError(RuntimeError):
    """Raised when the email provider rejects or fails to deliver a message."""


def _safe_provider_value(value, default="unknown"):
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        stripped = value.strip()
        if _SAFE_TOKEN_RE.match(stripped):
            return stripped
    return default


def is_email_configured():
    """Return True when both Resend API credentials and sender address are set."""
    api_key = str(current_app.config.get("RESEND_API_KEY", "") or "").strip()
    email_from = str(current_app.config.get("EMAIL_FROM", "") or "").strip()
    return bool(api_key and email_from)


def send_email(
    *,
    to_email,
    subject,
    html_body,
    text_body=None,
    idempotency_key=None,
    correlation_id=None,
):
    """Send one transactional email via Resend without exposing provider internals."""
    op_id = correlation_id or secrets.token_hex(8)
    api_key = str(current_app.config.get("RESEND_API_KEY", "") or "").strip()
    email_from = str(current_app.config.get("EMAIL_FROM", "") or "").strip()
    if not api_key or not email_from:
        current_app.logger.error(
            "operation=send_email error_category=email_configuration_missing correlation_id=%s",
            op_id,
        )
        raise EmailConfigurationError("Transactional email delivery is not configured")

    recipient = str(to_email or "").strip()
    if not recipient:
        raise ValueError("Recipient email address is required")

    params = {
        "from": email_from,
        "to": [recipient],
        "subject": subject,
        "html": html_body,
    }
    if text_body:
        params["text"] = text_body

    options = {"idempotency_key": idempotency_key} if idempotency_key else None

    try:
        with _RESEND_CLIENT_LOCK:
            resend.api_key = api_key
            response = (
                resend.Emails.send(params, options=options)
                if options
                else resend.Emails.send(params)
            )
    except ResendError as exc:
        safe_code = _safe_provider_value(getattr(exc, "code", None))
        safe_type = _safe_provider_value(getattr(exc, "error_type", None))
        current_app.logger.error(
            "operation=send_email error_category=provider_error correlation_id=%s provider_code=%s provider_error_type=%s",
            op_id,
            safe_code,
            safe_type,
        )
        raise EmailDeliveryError("Unable to send email at this time") from exc
    except Exception as exc:
        current_app.logger.error(
            "operation=send_email error_category=unexpected_provider_exception correlation_id=%s exception_class=%s",
            op_id,
            type(exc).__name__,
        )
        raise EmailDeliveryError("Unable to send email at this time") from exc

    if not isinstance(response, dict) or not response.get("id"):
        current_app.logger.error(
            "operation=send_email error_category=invalid_provider_response correlation_id=%s",
            op_id,
        )
        raise EmailDeliveryError("Unable to send email at this time")

    return response["id"]


def send_password_reset_email(
    *,
    to_email,
    reset_url,
    first_name=None,
    expires_minutes=60,
    idempotency_key=None,
    correlation_id=None,
):
    """Render and send a password-reset email using Resend."""
    subject, html_body, text_body = render_password_reset_email(
        reset_url=reset_url,
        first_name=first_name,
        expires_minutes=expires_minutes,
    )
    return send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        idempotency_key=idempotency_key,
        correlation_id=correlation_id,
    )
