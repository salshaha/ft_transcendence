"""Transactional email delivery service powered by the official Resend SDK."""

from threading import Lock

import resend
from flask import current_app
from resend.exceptions import ResendError

from app.services.email_templates import render_password_reset_email

_RESEND_CLIENT_LOCK = Lock()


class EmailConfigurationError(RuntimeError):
    """Raised when outbound email settings are incomplete."""


class EmailDeliveryError(RuntimeError):
    """Raised when the email provider rejects or fails to deliver a message."""


def is_email_configured():
    """Return True when both Resend API credentials and sender address are set."""
    api_key = str(current_app.config.get("RESEND_API_KEY", "") or "").strip()
    email_from = str(current_app.config.get("EMAIL_FROM", "") or "").strip()
    return bool(api_key and email_from)


def send_email(*, to_email, subject, html_body, text_body=None, idempotency_key=None):
    """Send one transactional email via Resend without exposing provider internals."""
    api_key = str(current_app.config.get("RESEND_API_KEY", "") or "").strip()
    email_from = str(current_app.config.get("EMAIL_FROM", "") or "").strip()
    if not api_key or not email_from:
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
        current_app.logger.error(
            "Resend email delivery failed (code=%s, type=%s)",
            getattr(exc, "code", "unknown"),
            getattr(exc, "error_type", "unknown"),
        )
        raise EmailDeliveryError("Unable to send email at this time") from exc
    except Exception as exc:
        current_app.logger.exception("Unexpected error during Resend email delivery")
        raise EmailDeliveryError("Unable to send email at this time") from exc

    if not isinstance(response, dict) or not response.get("id"):
        current_app.logger.error("Resend email delivery returned an unexpected response")
        raise EmailDeliveryError("Unable to send email at this time")

    return response["id"]


def send_password_reset_email(
    *,
    to_email,
    reset_url,
    first_name=None,
    expires_minutes=60,
    idempotency_key=None,
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
    )
