from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models.user import User


def _get_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        raise LookupError("User not found")
    return user


def _commit():
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise


def update_info_phone(user_id, phone_number):
    raise ValueError(
        "Phone information cannot be updated because the users table "
        "does not contain a phone column"
    )


def update_info_email(user_id, email):
    user = _get_user(user_id)
    user.email = email
    _commit()
    return user


def update_info_password(user_id, password):
    user = _get_user(user_id)
    user.password_hash = generate_password_hash(password)
    _commit()
    return user
