from flask import session

from app.extensions import db
from app.models.user import User
from app.security.csrf import rotate_csrf_token


def get_authenticated_user(allowed_roles=None):
    """Return (user, error) for the current session.

    ``allowed_roles`` is an optional iterable of roles. A signed-in user with
    the wrong role receives 403 instead of 401.
    """
    user_id = session.get("user_id")
    if user_id is None:
        return None, ("Authentication required", 401)

    user = db.session.get(User, user_id)
    if user is None:
        session.clear()
        rotate_csrf_token()
        return None, ("Authenticated user was not found", 401)

    if allowed_roles is not None and user.role not in set(allowed_roles):
        return None, ("You do not have permission to perform this action", 403)

    return user, None


def start_user_session(user):
    """Rotate the session after login and return the new CSRF token."""
    session.clear()
    session.permanent = True
    session["user_id"] = user.id
    session["email"] = user.email
    return rotate_csrf_token()


def clear_user_session():
    """Clear authentication state while keeping a usable CSRF token."""
    session.clear()
    return rotate_csrf_token()


def serialize_session_user(user):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
    }
