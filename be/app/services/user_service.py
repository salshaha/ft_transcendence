# user_service.py

import os

from sqlalchemy import create_engine, text


def _get_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be set")
    return create_engine(database_url)

def update_info_phone(user_id, phone_number):
    with _get_engine().begin() as connection:
        connection.execute(
            text("UPDATE users SET phone = :phone WHERE id = :user_id"),
            {"phone": phone_number, "user_id": user_id},
        )

def update_info_email(user_id, email):
    with _get_engine().begin() as connection:
        connection.execute(
            text("UPDATE users SET email = :email WHERE id = :user_id"),
            {"email": email, "user_id": user_id},
        )

def update_info_password(user_id, password):
    with _get_engine().begin() as connection:
        connection.execute(
            text("UPDATE users SET password = :password WHERE id = :user_id"),
            {"password": password, "user_id": user_id},
        )
