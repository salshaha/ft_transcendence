import hmac
import secrets

from flask import jsonify, request, session

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})
CSRF_SESSION_KEY = "_csrf_token"
CSRF_HEADER_NAMES = ("X-CSRF-Token", "X-CSRFToken")


def get_csrf_token():
    """Return the session's CSRF token, creating it on first use."""
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def rotate_csrf_token():
    """Replace the session's CSRF token after an authentication change."""
    token = secrets.token_urlsafe(32)
    session[CSRF_SESSION_KEY] = token
    return token


def _provided_token():
    for header in CSRF_HEADER_NAMES:
        value = request.headers.get(header)
        if value:
            return value
    return None


def init_csrf(app):
    """Require a synchronizer token for state-changing API requests.

    The token lives in the signed, HttpOnly session cookie and must be sent
    back in the X-CSRF-Token header. This works with the credentialed CORS
    setup without making the session cookie readable by JavaScript.
    """

    @app.before_request
    def protect_api_requests():
        if not request.path.startswith("/api/"):
            return None
        if request.method in SAFE_METHODS:
            return None

        expected = session.get(CSRF_SESSION_KEY)
        provided = _provided_token()
        if (
            not expected
            or not provided
            or not hmac.compare_digest(str(expected), str(provided))
        ):
            return jsonify({
                "message": "CSRF token missing or invalid. Refresh the page and retry."
            }), 403
        return None
