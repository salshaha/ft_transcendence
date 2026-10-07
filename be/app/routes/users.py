# users.py


from flask import request, session, Blueprint 
from werkzeug.security import generate_password_hash, check_password_hash
import app.services.user_service

users_bp = Blueprint("users", __name__)

@users_bp.route("/update_info", methods=['PUT'])
def update_info():
    user_id = session.get('user_id')
    if user_id is None:
        return "No user is logged in"

    phone = request.form.get('phone_number')
    password = request.form.get("password")
    email = request.form.get("email")

    if phone is not None:
        update_info_phone(user_id, phone)

    if password is not None:
        hashed_password = generate_password_hash(password)
        update_info_password(user_id, hashed_password)

    if email is not None:
        update_info_email(user_id, email)

    return "Information updated successfully"
