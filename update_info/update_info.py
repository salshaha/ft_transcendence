from flask import Flask, request, session
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

app = Flask(__name__)
app.secret_key = "your-secret-key"


@app.route("/update_info", methods=['PUT'])
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




def update_info_phone(user_id, phone_number):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET phone = ? WHERE id = ?",
        (phone_number, user_id)
    )
    conn.commit()
    conn.close()




def update_info_email(user_id, email):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET email = ? WHERE id = ?",
        (email, user_id)
    )
    conn.commit()
    conn.close()




def update_info_password(user_id, password):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        (password, user_id)
    )
    conn.commit()
    conn.close()