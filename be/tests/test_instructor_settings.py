import os
import tempfile
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STORAGE_ROOT", tempfile.mkdtemp(prefix="ft-settings-test-"))

from sqlalchemy import BigInteger
from sqlalchemy.ext.compiler import compiles
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models.user import User


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(_type, _compiler, **_kwargs):
    return "INTEGER"


CSRF_TOKEN = "test-csrf-token"


class InstructorSettingsTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update(TESTING=True)
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.client = self.app.test_client()
        instructor = User(
            first_name="Ada", last_name="Instructor",
            email="ada@example.com",
            password_hash=generate_password_hash("old-password"),
            role="instructor",
        )
        db.session.add(instructor)
        db.session.commit()
        self.instructor_id = instructor.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def login(self):
        with self.client.session_transaction() as session:
            session["user_id"] = self.instructor_id
            session["_csrf_token"] = CSRF_TOKEN

    def put(self, payload):
        return self.client.put(
            "/api/update_info",
            json=payload,
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

    def test_instructor_can_update_email_with_current_password(self):
        self.login()
        response = self.put({
            "email": "ada.new@example.com",
            "current_password": "old-password",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            db.session.get(User, self.instructor_id).email, "ada.new@example.com"
        )
        self.assertEqual(
            self.client.get("/api/me").get_json()["user"]["email"],
            "ada.new@example.com",
        )

    def test_wrong_current_password_is_rejected(self):
        self.login()
        response = self.put({
            "email": "hacked@example.com",
            "current_password": "wrong-password",
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            db.session.get(User, self.instructor_id).email, "ada@example.com"
        )


if __name__ == "__main__":
    unittest.main()
