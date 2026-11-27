import unittest

from werkzeug.security import generate_password_hash


class PasswordLoginTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db
        from app.models.user import User

        cls.db = db
        cls.User = User
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.email = "login-regression@example.com"
        cls.password = "Password123!"
        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()
        user = User(
            first_name="Login",
            last_name="Regression",
            email=cls.email,
            password_hash=generate_password_hash(cls.password),
            role="student",
        )
        db.session.add(user)
        db.session.commit()
        cls.user_id = user.id

    @classmethod
    def tearDownClass(cls):
        cls.db.session.remove()
        cls.db.drop_all()
        cls.context.pop()

    def setUp(self):
        self.client = self.app.test_client()

    def csrf_token(self):
        response = self.client.get("/api/auth/csrf")
        self.assertEqual(response.status_code, 200)
        return response.get_json()["csrf_token"]

    def login(self, email, password):
        return self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
            headers={"X-CSRF-Token": self.csrf_token()},
        )

    def test_password_login_and_session_lifecycle(self):
        response = self.login(self.email, self.password)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["message"], "Login successful")
        self.assertEqual(body["user"]["id"], self.user_id)

        self.assertEqual(
            self.client.get("/api/student/profile").status_code, 200
        )

        logout = self.client.post(
            "/api/auth/logout",
            headers={"X-CSRF-Token": body["csrf_token"]},
        )
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(
            self.client.get("/api/student/profile").status_code, 401
        )

    def test_password_login_rejects_wrong_password_and_missing_user(self):
        self.assertEqual(
            self.login(self.email, "WrongPassword123!").status_code, 401
        )
        self.assertEqual(
            self.login("missing-login@example.com", self.password).status_code,
            401,
        )

    def test_password_login_normalizes_email_whitespace(self):
        response = self.login(f"  {self.email}  ", self.password)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["id"], self.user_id)
