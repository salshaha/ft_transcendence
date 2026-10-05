# user_service.py

import sqlalchemy

# the sqlite3 connection must disappear and be replaced with sqlalchemy connection
# since we decided from the beginning to use PostgreSQL instead of SQLite

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
