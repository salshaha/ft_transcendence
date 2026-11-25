from flask import request, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def api_client_key():
    """Use the authenticated account when available, otherwise the peer IP.

    Deliberately do not trust forwarded-for headers here: they are only safe
    after the app is deployed behind a correctly configured trusted proxy.
    """
    user_id = session.get("user_id")
    if user_id is not None:
        return f"user:{user_id}"
    return f"ip:{get_remote_address() or request.remote_addr or 'unknown'}"


limiter = Limiter(
    key_func=api_client_key,
    default_limits_exempt_when=lambda: not request.path.startswith("/api/"),
    application_limits_exempt_when=lambda: not request.path.startswith("/api/"),
)
