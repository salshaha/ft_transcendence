import hashlib
import logging
import os
import re
import threading
import unittest
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from resend.exceptions import ApplicationError, ResendError
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash


class PasswordRecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import create_app
        from app.extensions import db
        from app.models.password_reset import PasswordResetToken
        from app.models.user import User

        cls.db = db
        cls.User = User
        cls.PasswordResetToken = PasswordResetToken
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.app.config["RESEND_API_KEY"] = "re_test_mock_key_never_logged"
        cls.app.config["EMAIL_FROM"] = "Team-Platform <onboarding@resend.dev>"
        cls.app.config["FRONTEND_URL"] = "https://portal.example.edu"
        cls.app.config["PASSWORD_RESET_TOKEN_EXPIRY_MINUTES"] = 60
        cls.app.config["PASSWORD_RESET_REQUEST_LIMIT"] = "5 per hour"
        cls.app.config["PASSWORD_RESET_CONFIRM_LIMIT"] = "10 per hour"

        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()

    @classmethod
    def tearDownClass(cls):
        cls.db.session.remove()
        cls.db.drop_all()
        cls.context.pop()

    def setUp(self):
        self.db.session.query(self.PasswordResetToken).delete()
        self.db.session.query(self.User).delete()
        self.db.session.commit()

        self.app.config["RESEND_API_KEY"] = "re_test_mock_key_never_logged"
        self.app.config["EMAIL_FROM"] = "Team-Platform <onboarding@resend.dev>"
        self.app.config["FRONTEND_URL"] = "https://portal.example.edu"
        self.app.config["PASSWORD_RESET_TOKEN_EXPIRY_MINUTES"] = 60

        self.student = self.User(
            first_name="Alice",
            last_name="Student",
            email="alice.student@example.com",
            password_hash=generate_password_hash("InitialPass123!"),
            role="student",
            student_id="S-1001",
        )
        self.instructor = self.User(
            first_name="Ivana",
            last_name="Instructor",
            email="ivana.instructor@example.com",
            password_hash=generate_password_hash("InstructorPass123!"),
            role="instructor",
        )
        self.admin = self.User(
            first_name="Ada",
            last_name="Admin",
            email="ada.admin@example.com",
            password_hash=generate_password_hash("AdminPass123!"),
            role="admin",
        )
        self.microsoft_only = self.User(
            first_name="Mona",
            last_name="Microsoft",
            email="mona.sso@example.com",
            password_hash=None,
            microsoft_id="tenant-1:obj-1",
            role="student",
            student_id="MS-1",
        )
        self.db.session.add_all(
            [self.student, self.instructor, self.admin, self.microsoft_only]
        )
        self.db.session.commit()

        self.client = self.app.test_client()

    _ip_counter = 10

    def _next_ip_environ(self):
        PasswordRecoveryTests._ip_counter += 1
        return {"REMOTE_ADDR": f"10.0.0.{PasswordRecoveryTests._ip_counter}"}

    def _csrf_token(self, client=None, environ_base=None):
        c = client or self.client
        resp = c.get("/api/auth/csrf", environ_base=environ_base or {})
        self.assertEqual(resp.status_code, 200)
        return resp.get_json()["csrf_token"]

    def _post_json(self, path, payload, *, client=None, environ_base=None):
        c = client or self.client
        env = environ_base or self._next_ip_environ()
        token = self._csrf_token(c, environ_base=env)
        return c.post(
            path,
            json=payload,
            headers={"X-CSRF-Token": token},
            environ_base=env,
        )

    @staticmethod
    def _extract_token_from_email_params(params):
        match = re.search(
            r"https://portal\.example\.edu/reset-password\?token=([A-Za-z0-9_\-%]+)",
            params["html"],
        )
        if not match:
            raise AssertionError("Reset URL not found in HTML email body")
        parsed = urlparse(match.group(0))
        return parse_qs(parsed.query)["token"][0]

    def test_forgot_password_existing_email_sends_resend_email_and_stores_hash_only(self):
        captured = {}

        def fake_send(params, options=None):
            captured["params"] = params
            captured["options"] = options
            return {"id": "email_123"}

        with patch("app.services.email_service.resend.Emails.send", side_effect=fake_send):
            resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": "  ALICE.STUDENT@example.com  "},
                environ_base=self._next_ip_environ(),
            )

        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(
            body["message"],
            "If an account with that email exists, a password reset link has been sent.",
        )
        self.assertNotIn("reset_token", body)

        params = captured["params"]
        self.assertEqual(params["from"], "Team-Platform <onboarding@resend.dev>")
        self.assertEqual(params["to"], ["alice.student@example.com"])
        self.assertEqual(params["subject"], "Reset your Team-Platform password")
        self.assertIn("Hi Alice,", params["html"])
        self.assertIn("1 hour", params["html"])
        self.assertIn("ignore this email", params["html"].lower())
        self.assertIn("Team-Platform", params["html"])
        self.assertIn("https://portal.example.edu/reset-password?token=", params["text"])

        raw_token = self._extract_token_from_email_params(params)
        self.assertGreaterEqual(len(raw_token), 32)
        expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        stored_tokens = self.PasswordResetToken.query.filter_by(
            user_id=self.student.id
        ).all()
        self.assertEqual(len(stored_tokens), 1)
        self.assertEqual(stored_tokens[0].token_hash, expected_hash)
        self.assertNotEqual(stored_tokens[0].token_hash, raw_token)
        self.assertIsNone(stored_tokens[0].used_at)
        expires_at = stored_tokens[0].expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        delta = expires_at - datetime.now(timezone.utc)
        self.assertGreater(delta, timedelta(minutes=55))
        self.assertLessEqual(delta, timedelta(minutes=61))

    def test_forgot_password_prevents_email_enumeration(self):
        with patch("app.services.email_service.resend.Emails.send") as mock_send:
            mock_send.return_value = {"id": "email_existing"}
            existing_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )
            self.assertEqual(mock_send.call_count, 1)

            missing_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": "nonexistent@example.com"},
                environ_base=self._next_ip_environ(),
            )
            sso_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.microsoft_only.email},
                environ_base=self._next_ip_environ(),
            )
            self.assertEqual(mock_send.call_count, 1)

        self.assertEqual(existing_resp.status_code, 200)
        self.assertEqual(missing_resp.status_code, 200)
        self.assertEqual(sso_resp.status_code, 200)
        self.assertEqual(existing_resp.get_json(), missing_resp.get_json())
        self.assertEqual(existing_resp.get_json(), sso_resp.get_json())
        self.assertEqual(
            self.PasswordResetToken.query.filter_by(
                user_id=self.microsoft_only.id
            ).count(),
            0,
        )

    def test_forgot_password_validates_malformed_email(self):
        with patch("app.services.email_service.resend.Emails.send") as mock_send:
            resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": "not-an-email"},
                environ_base=self._next_ip_environ(),
            )
            empty_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": "   "},
                environ_base=self._next_ip_environ(),
            )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(empty_resp.status_code, 400)
        mock_send.assert_not_called()

    def test_new_forgot_password_request_invalidates_previous_outstanding_tokens(self):
        sent_tokens = []

        def fake_send(params, options=None):
            sent_tokens.append(self._extract_token_from_email_params(params))
            return {"id": f"email_{len(sent_tokens)}"}

        with patch("app.services.email_service.resend.Emails.send", side_effect=fake_send):
            first = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )
            second = self._post_json(
                "/api/auth/password-reset/request",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(len(sent_tokens), 2)
        first_token, second_token = sent_tokens
        self.assertNotEqual(first_token, second_token)

        first_validate = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": first_token},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(first_validate.status_code, 400)

        first_confirm = self._post_json(
            "/api/auth/reset-password",
            {"token": first_token, "new_password": "NewPassword123!"},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(first_confirm.status_code, 400)

        second_validate = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": second_token},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(second_validate.status_code, 200)
        self.assertTrue(second_validate.get_json()["valid"])

    def test_resend_failure_invalidates_token_hides_account_existence_and_logs_safely(self):
        resend_exc = ApplicationError(
            message="Secret Resend internal detail with key re_test_mock_key_never_logged",
            error_type="invalid Bearer re_test_mock_key_never_logged",
            code=500,
        )

        with self.assertLogs(self.app.logger, level="ERROR") as logs:
            with patch(
                "app.services.email_service.resend.Emails.send",
                side_effect=resend_exc,
            ):
                existing_resp = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": self.student.email},
                    environ_base=self._next_ip_environ(),
                )
                missing_resp = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": "unknown-during-outage@example.com"},
                    environ_base=self._next_ip_environ(),
                )

        # Public responses must be identical to prevent account enumeration.
        self.assertEqual(existing_resp.status_code, 200)
        self.assertEqual(missing_resp.status_code, 200)
        self.assertEqual(existing_resp.get_json(), missing_resp.get_json())

        # Newly created token must be invalidated after delivery failure.
        tokens = self.PasswordResetToken.query.filter_by(user_id=self.student.id).all()
        self.assertEqual(len(tokens), 1)
        self.assertIsNotNone(tokens[0].used_at)

        # Internal monitoring still captures safe structured operational error logs.
        combined_logs = "\n".join(logs.output)
        self.assertIn("error_category=provider_error", combined_logs)
        self.assertIn("provider_error_type=unknown", combined_logs)
        self.assertIn("error_category=email_delivery_failed", combined_logs)
        self.assertIn("token_invalidated=True", combined_logs)
        self.assertNotIn("Secret Resend internal detail", combined_logs)
        self.assertNotIn("re_test_mock_key_never_logged", combined_logs)

    def test_token_is_committed_before_resend_send_and_no_transaction_is_held_open(self):
        observed = {}

        def fake_send(params, options=None):
            raw_token = self._extract_token_from_email_params(params)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            # Query via a separate engine connection to verify durable commit
            # happened BEFORE the Resend network request.
            with self.db.engine.connect() as conn:
                row = conn.execute(
                    self.db.text(
                        "SELECT used_at FROM password_reset_tokens WHERE token_hash = :h"
                    ),
                    {"h": token_hash},
                ).fetchone()
            observed["committed_before_send"] = row is not None and row[0] is None
            observed["in_session_transaction"] = self.db.session().in_transaction()
            observed["raw_token"] = raw_token
            return {"id": "email_tx_order"}

        with patch("app.services.email_service.resend.Emails.send", side_effect=fake_send):
            resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )

        self.assertEqual(resp.status_code, 200)
        self.assertIs(observed.get("committed_before_send"), True)
        self.assertIs(observed.get("in_session_transaction"), False)
        val_resp = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": observed["raw_token"]},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(val_resp.status_code, 200)

    def test_database_commit_failure_returns_500_and_never_sends_email(self):
        with self.assertLogs(self.app.logger, level="ERROR") as logs:
            with patch.object(
                self.db.session,
                "commit",
                side_effect=SQLAlchemyError("simulated commit failure"),
            ):
                with patch("app.services.email_service.resend.Emails.send") as mock_send:
                    resp = self._post_json(
                        "/api/auth/forgot-password",
                        {"email": self.student.email},
                        environ_base=self._next_ip_environ(),
                    )

        self.assertEqual(resp.status_code, 500)
        self.assertEqual(
            resp.get_json(),
            {"message": "Unable to process password reset request"},
        )
        mock_send.assert_not_called()
        self.assertEqual(
            self.PasswordResetToken.query.filter_by(user_id=self.student.id).count(),
            0,
        )
        combined_logs = "\n".join(logs.output)
        self.assertIn("error_category=database_error", combined_logs)

    def test_previous_token_remains_valid_after_failed_replacement_commit(self):
        """A commit failure during a replacement request must not invalidate
        a previously issued, still-valid reset token."""
        raw_old = "previous-valid-token-value-1234567890"
        old_token = self.PasswordResetToken(
            user_id=self.student.id,
            token_hash=hashlib.sha256(raw_old.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        self.db.session.add(old_token)
        self.db.session.commit()

        # Confirm the old token is valid before the failed replacement attempt.
        val_before = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": raw_old},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(val_before.status_code, 200)
        self.assertTrue(val_before.get_json()["valid"])

        with patch.object(
            self.db.session,
            "commit",
            side_effect=SQLAlchemyError("simulated replacement commit failure"),
        ):
            with patch("app.services.email_service.resend.Emails.send") as mock_send:
                resp = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": self.student.email},
                    environ_base=self._next_ip_environ(),
                )

        self.assertEqual(resp.status_code, 500)
        mock_send.assert_not_called()

        # The previously issued token must remain valid.
        val_after = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": raw_old},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(val_after.status_code, 200)
        self.assertTrue(val_after.get_json()["valid"])

        # No new token should have been persisted.
        self.assertEqual(
            self.PasswordResetToken.query.filter_by(user_id=self.student.id).count(),
            1,
        )

    def test_unexpected_exception_with_secret_and_reset_url_is_never_logged(self):
        captured_token = {}

        def exploding_send(params, options=None):
            raw_token = self._extract_token_from_email_params(params)
            captured_token["value"] = raw_token
            reset_url = f"https://portal.example.edu/reset-password?token={raw_token}"
            raise RuntimeError(
                f"Network failure calling {reset_url} with Bearer re_test_mock_key_never_logged"
            )

        with self.assertLogs(self.app.logger, level="ERROR") as logs:
            with patch(
                "app.services.email_service.resend.Emails.send",
                side_effect=exploding_send,
            ):
                resp = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": self.student.email},
                    environ_base=self._next_ip_environ(),
                )

        self.assertEqual(resp.status_code, 200)
        combined_logs = "\n".join(logs.output)
        self.assertIn("error_category=unexpected_provider_exception", combined_logs)
        self.assertIn("exception_class=RuntimeError", combined_logs)
        self.assertNotIn("re_test_mock_key_never_logged", combined_logs)
        self.assertNotIn(captured_token["value"], combined_logs)
        self.assertNotIn("https://portal.example.edu/reset-password", combined_logs)

        # Verify the invalidated token cannot be used to reset the password.
        confirm_resp = self._post_json(
            "/api/auth/reset-password",
            {
                "token": captured_token["value"],
                "new_password": "ShouldNotWorkPassword123!",
            },
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(confirm_resp.status_code, 400)

    def test_missing_resend_configuration_fails_uniformly_without_enumeration(self):
        self.app.config["RESEND_API_KEY"] = ""
        with self.assertLogs(self.app.logger, level="ERROR") as logs:
            existing_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )
            missing_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": "unknown@example.com"},
                environ_base=self._next_ip_environ(),
            )
        self.assertEqual(existing_resp.status_code, 503)
        self.assertEqual(missing_resp.status_code, 503)
        self.assertEqual(existing_resp.get_json(), missing_resp.get_json())
        self.assertIn(
            "error_category=email_configuration_missing",
            "\n".join(logs.output),
        )

    def test_reset_password_full_flow_invalidates_token_and_existing_sessions(self):
        # User is already signed in on another client session before reset.
        other_client = self.app.test_client()
        other_login = self._post_json(
            "/api/auth/login",
            {"email": self.student.email, "password": "InitialPass123!"},
            client=other_client,
        )
        self.assertEqual(other_login.status_code, 200)
        self.assertEqual(other_client.get("/api/student/profile").status_code, 200)

        captured = {}
        with patch(
            "app.services.email_service.resend.Emails.send",
            side_effect=lambda params, options=None: captured.update(params) or {"id": "e1"},
        ):
            req_resp = self._post_json(
                "/api/auth/forgot-password",
                {"email": self.student.email},
                environ_base=self._next_ip_environ(),
            )
        self.assertEqual(req_resp.status_code, 200)
        raw_token = self._extract_token_from_email_params(captured)

        # Weak password does not consume token.
        weak_resp = self._post_json(
            "/api/auth/reset-password",
            {"token": raw_token, "new_password": "short"},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(weak_resp.status_code, 400)

        # Password mismatch does not consume token.
        mismatch_resp = self._post_json(
            "/api/auth/reset-password",
            {
                "token": raw_token,
                "new_password": "ValidNewPassword123!",
                "confirm_password": "DifferentPassword123!",
            },
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(mismatch_resp.status_code, 400)

        # Successful reset with matching confirm_password.
        new_password = "BrandNewSecurePassword!2026"
        reset_resp = self._post_json(
            "/api/auth/reset-password",
            {
                "token": raw_token,
                "new_password": new_password,
                "confirm_password": new_password,
            },
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(reset_resp.status_code, 200)
        self.assertEqual(reset_resp.get_json()["message"], "Password reset successfully")

        # Token cannot be reused.
        reuse_resp = self._post_json(
            "/api/auth/password-reset/confirm",
            {"token": raw_token, "new_password": "AnotherPassword123!"},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(reuse_resp.status_code, 400)

        # Validate endpoint also rejects consumed token.
        val_after = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": raw_token},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(val_after.status_code, 400)

        # Password hash updated cleanly using Werkzeug.
        refreshed = self.db.session.get(self.User, self.student.id)
        self.assertTrue(check_password_hash(refreshed.password_hash, new_password))
        self.assertGreater(refreshed.session_version, 1)

        # Pre-existing session on other_client is invalidated.
        self.assertEqual(other_client.get("/api/student/profile").status_code, 401)

        # Old password fails, new password succeeds.
        old_login = self._post_json(
            "/api/auth/login",
            {"email": self.student.email, "password": "InitialPass123!"},
        )
        self.assertEqual(old_login.status_code, 401)

        new_login = self._post_json(
            "/api/auth/login",
            {"email": self.student.email, "password": new_password},
        )
        self.assertEqual(new_login.status_code, 200)
        self.assertEqual(self.client.get("/api/student/profile").status_code, 200)

    def test_expired_and_invalid_tokens_are_rejected(self):
        raw_token = "expired-test-token-value-1234567890"
        expired = self.PasswordResetToken(
            user_id=self.student.id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        self.db.session.add(expired)
        self.db.session.commit()

        val_expired = self._post_json(
            "/api/auth/reset-password/validate",
            {"token": raw_token},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(val_expired.status_code, 400)

        confirm_expired = self._post_json(
            "/api/auth/reset-password",
            {"token": raw_token, "new_password": "ValidPassword123!"},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(confirm_expired.status_code, 400)

        confirm_invalid = self._post_json(
            "/api/auth/reset-password",
            {"token": "nonexistent-random-token", "new_password": "ValidPassword123!"},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(confirm_invalid.status_code, 400)

        refreshed = self.db.session.get(self.User, self.student.id)
        self.assertTrue(check_password_hash(refreshed.password_hash, "InitialPass123!"))

    def test_concurrent_reset_attempts_only_allow_one_success(self):
        raw_token = "concurrent-reset-token-1234567890"
        record = self.PasswordResetToken(
            user_id=self.student.id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        self.db.session.add(record)
        self.db.session.commit()

        barrier = threading.Barrier(2)
        results = []
        lock = threading.Lock()

        def worker(idx):
            client = self.app.test_client()
            csrf_resp = client.get("/api/auth/csrf")
            csrf = csrf_resp.get_json()["csrf_token"]
            barrier.wait()
            resp = client.post(
                "/api/auth/reset-password",
                json={
                    "token": raw_token,
                    "new_password": f"ConcurrentPass{idx}!123",
                },
                headers={"X-CSRF-Token": csrf},
            )
            with lock:
                results.append(resp.status_code)

        t1 = threading.Thread(target=worker, args=(1,))
        t2 = threading.Thread(target=worker, args=(2,))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        self.assertEqual(sorted(results), [200, 400])

    def test_forgot_password_rate_limiting(self):
        rate_limit_env = {"REMOTE_ADDR": "192.0.2.250"}
        with patch(
            "app.services.email_service.resend.Emails.send",
            return_value={"id": "rate_id"},
        ):
            statuses = []
            for _ in range(6):
                resp = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": "nonexistent-rate@example.com"},
                    environ_base=rate_limit_env,
                )
                statuses.append(resp.status_code)

        self.assertEqual(statuses[:5], [200, 200, 200, 200, 200])
        self.assertEqual(statuses[5], 429)

    def test_no_secrets_tokens_or_passwords_in_logs(self):
        captured = {}
        root_logger = logging.getLogger()
        stream_records = []

        class MemoryHandler(logging.Handler):
            def emit(self, record):
                stream_records.append(self.format(record))

        handler = MemoryHandler()
        root_logger.addHandler(handler)
        try:
            with patch(
                "app.services.email_service.resend.Emails.send",
                side_effect=lambda params, options=None: captured.update(params) or {"id": "log_e1"},
            ):
                self._post_json(
                    "/api/auth/forgot-password",
                    {"email": self.student.email},
                    environ_base=self._next_ip_environ(),
                )
            raw_token = self._extract_token_from_email_params(captured)
            new_password = "SuperSecretLogCheckPassword!99"
            self._post_json(
                "/api/auth/reset-password",
                {"token": raw_token, "new_password": new_password},
                environ_base=self._next_ip_environ(),
            )
        finally:
            root_logger.removeHandler(handler)

        joined = "\n".join(stream_records)
        self.assertNotIn("re_test_mock_key_never_logged", joined)
        self.assertNotIn(raw_token, joined)
        self.assertNotIn(new_password, joined)

    def test_role_access_and_auth_regression_across_student_instructor_admin(self):
        # Student registration & login/logout regression.
        reg_client = self.app.test_client()
        reg_resp = self._post_json(
            "/api/auth/register",
            {
                "first_name": "Sam",
                "last_name": "Learner",
                "email": "sam.learner@example.com",
                "password": "SamPassword123!",
                "student_id": "S-9090",
            },
            client=reg_client,
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(reg_resp.status_code, 201)

        # Password reset works for instructor and admin as well, and preserves RBAC.
        for user, new_pw, allowed_path, forbidden_path in [
            (
                self.student,
                "StudentReset123!",
                "/api/student/profile",
                "/api/admin/dashboard",
            ),
            (
                self.instructor,
                "InstructorReset123!",
                "/api/instructor/dashboard",
                "/api/admin/dashboard",
            ),
            (
                self.admin,
                "AdminReset123!",
                "/api/admin/dashboard",
                "/api/student/profile",
            ),
        ]:
            captured = {}
            with patch(
                "app.services.email_service.resend.Emails.send",
                side_effect=lambda params, options=None: captured.update(params) or {"id": "role_e"},
            ):
                req = self._post_json(
                    "/api/auth/forgot-password",
                    {"email": user.email},
                    environ_base=self._next_ip_environ(),
                )
            self.assertEqual(req.status_code, 200)
            token = self._extract_token_from_email_params(captured)

            conf = self._post_json(
                "/api/auth/reset-password",
                {"token": token, "new_password": new_pw},
                environ_base=self._next_ip_environ(),
            )
            self.assertEqual(conf.status_code, 200)

            role_client = self.app.test_client()
            login_resp = self._post_json(
                "/api/auth/login",
                {"email": user.email, "password": new_pw},
                client=role_client,
            )
            self.assertEqual(login_resp.status_code, 200)
            self.assertEqual(role_client.get(allowed_path).status_code, 200)
            self.assertEqual(role_client.get(forbidden_path).status_code, 403)

            logout_resp = role_client.post(
                "/api/auth/logout",
                headers={"X-CSRF-Token": login_resp.get_json()["csrf_token"]},
            )
            self.assertEqual(logout_resp.status_code, 200)
            self.assertEqual(role_client.get(allowed_path).status_code, 401)


if __name__ == "__main__":
    unittest.main()
