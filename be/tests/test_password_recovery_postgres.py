"""PostgreSQL integration tests for password-reset concurrency.

These tests require a live PostgreSQL instance and are skipped automatically
when one is not available.  They are NOT run by the default SQLite test suite.

To run against the Docker Compose PostgreSQL service:

    docker run --rm --network ft_transcendence_backend_database \\
      -e DATABASE_URL="postgresql+psycopg2://postgres:change_this_to_a_strong_password@team-platform-postgres:5432/ft_test" \\
      -e SECRET_KEY="test-only-session-signing-key-not-for-deployment-1234567890" \\
      -e STORAGE_ROOT=/tmp/ft_uploads \\
      -v "$(pwd):/app" -w /app/be \\
      ft_transcendence-backend python -m unittest tests.test_password_recovery_postgres -v

Prerequisites:
    1. PostgreSQL container running (docker compose up -d postgres)
    2. Empty test database: CREATE DATABASE ft_test;
    3. Backend image built: docker compose build backend
"""

import hashlib
import os
import threading
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash


def _postgres_url():
    """Return a PostgreSQL DATABASE_URL if one is configured or discoverable."""
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("postgresql"):
        return url
    # Try the Docker Compose service name (works inside the Docker network).
    candidate = (
        "postgresql+psycopg2://postgres:change_this_to_a_strong_password"
        "@team-platform-postgres:5432/ft_test"
    )
    try:
        import psycopg2

        # Parse host/port from the candidate URL.
        from urllib.parse import urlparse

        parsed = urlparse(candidate.replace("postgresql+psycopg2://", "postgresql://"))
        conn = psycopg2.connect(
            dbname=parsed.path.lstrip("/"),
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            connect_timeout=3,
        )
        conn.close()
        return candidate
    except Exception:
        return None


_POSTGRES_URL = _postgres_url()


def _skip_reason():
    if _POSTGRES_URL is None:
        return "PostgreSQL is not available (set DATABASE_URL or run inside Docker network)"
    return None


class PostgresPasswordRecoveryConcurrencyTests(unittest.TestCase):
    """PostgreSQL-specific concurrency tests for password-reset token lifecycle.

    These tests verify that ``SELECT ... FOR UPDATE`` (``with_for_update()``)
    actually serializes concurrent reset requests at the database level.
    SQLite does not enforce row-level locks, so these tests are skipped when
    PostgreSQL is unavailable.
    """

    @classmethod
    def setUpClass(cls):
        if _skip_reason():
            raise unittest.SkipTest(_skip_reason())

        # Override DATABASE_URL before importing the app so SQLAlchemy uses
        # PostgreSQL instead of the SQLite default from conftest.py.
        os.environ["DATABASE_URL"] = _POSTGRES_URL
        os.environ.setdefault(
            "SECRET_KEY", "test-only-session-signing-key-not-for-deployment"
        )
        os.environ.setdefault("STORAGE_ROOT", "/tmp/ft_uploads_pg")

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
        cls.app.config["PASSWORD_RESET_REQUEST_LIMIT"] = "1000 per hour"
        cls.app.config["PASSWORD_RESET_CONFIRM_LIMIT"] = "1000 per hour"

        cls.context = cls.app.app_context()
        cls.context.push()
        db.create_all()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "context"):
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

        self.student = self.User(
            first_name="Alice",
            last_name="Student",
            email="alice.student@example.com",
            password_hash=generate_password_hash("InitialPass123!"),
            role="student",
            student_id="S-1001",
        )
        self.db.session.add(self.student)
        self.db.session.commit()

        self.client = self.app.test_client()

    def _next_ip_environ(self):
        import itertools

        if not hasattr(self, "_ip_counter"):
            self._ip_counter = 100
        self._ip_counter += 1
        return {"REMOTE_ADDR": f"10.0.0.{self._ip_counter}"}

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

    def _extract_token_from_email_params(self, params):
        import re
        from urllib.parse import parse_qs, urlparse

        match = re.search(
            r"https://portal\.example\.edu/reset-password\?token=([A-Za-z0-9_\-%]+)",
            params["html"],
        )
        if not match:
            raise AssertionError("Reset URL not found in HTML email body")
        parsed = urlparse(match.group(0))
        return parse_qs(parsed.query)["token"][0]

    def test_concurrent_reset_requests_only_one_unused_token_remains(self):
        """Two simultaneous password-reset requests for the same user must
        result in exactly one unused, unexpired token.

        This test exercises PostgreSQL's SELECT FOR UPDATE row locking.
        On SQLite the lock is a no-op and the test may pass or fail
        depending on timing; it is only meaningful on PostgreSQL.
        """
        sent_tokens = []
        token_lock = threading.Lock()

        def fake_send(params, options=None):
            raw = self._extract_token_from_email_params(params)
            with token_lock:
                sent_tokens.append(raw)
            return {"id": f"email_{len(sent_tokens)}"}

        # Patch Resend at the module level so both threads use the mock.
        patcher = patch(
            "app.services.email_service.resend.Emails.send",
            side_effect=fake_send,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

        # Use a barrier to ensure both requests reach the service layer
        # concurrently before either acquires the row lock.
        barrier = threading.Barrier(2)
        results = []
        results_lock = threading.Lock()

        def worker(idx):
            client = self.app.test_client()
            env = self._next_ip_environ()
            csrf = self._csrf_token(client, environ_base=env)
            barrier.wait()
            resp = client.post(
                "/api/auth/forgot-password",
                json={"email": "alice.student@example.com"},
                headers={"X-CSRF-Token": csrf},
                environ_base=env,
            )
            with results_lock:
                results.append((idx, resp.status_code))

        t1 = threading.Thread(target=worker, args=(1,))
        t2 = threading.Thread(target=worker, args=(2,))
        t1.start()
        t2.start()
        t1.join(timeout=15)
        t2.join(timeout=15)

        self.assertFalse(t1.is_alive(), "Thread 1 did not complete in time")
        self.assertFalse(t2.is_alive(), "Thread 2 did not complete in time")
        self.assertEqual(len(results), 2, "Both requests must complete")
        self.assertEqual(
            sorted(r[1] for r in results), [200, 200],
            "Both requests must return 200 (anti-enumeration)",
        )

        # Verify exactly one unused, unexpired token remains.
        now = datetime.now(timezone.utc)
        all_tokens = self.PasswordResetToken.query.filter_by(
            user_id=self.student.id
        ).all()
        unused_tokens = [
            t for t in all_tokens
            if t.used_at is None and t.expires_at.replace(tzinfo=timezone.utc) > now
        ]
        self.assertEqual(
            len(unused_tokens),
            1,
            f"Expected exactly 1 unused token, got {len(unused_tokens)} "
            f"(total={len(all_tokens)})",
        )

        # Verify the latest (unused) token can reset the password.
        latest_hash = unused_tokens[0].token_hash
        # Find the raw token that corresponds to the latest token hash.
        # We need to match by hash since we don't have the raw token directly.
        # Instead, verify that exactly one of the sent tokens is still valid.
        valid_sent_tokens = []
        for raw in sent_tokens:
            import hashlib

            h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
            if h == latest_hash:
                valid_sent_tokens.append(raw)

        self.assertEqual(
            len(valid_sent_tokens),
            1,
            "Exactly one sent token must still be valid",
        )

        # Verify the valid token can reset the password.
        new_password = "PostgresConcurrentReset123!"
        confirm_resp = self._post_json(
            "/api/auth/reset-password",
            {"token": valid_sent_tokens[0], "new_password": new_password},
            environ_base=self._next_ip_environ(),
        )
        self.assertEqual(confirm_resp.status_code, 200)

        # Verify the password was actually changed.
        refreshed = self.db.session.get(self.User, self.student.id)
        self.assertTrue(check_password_hash(refreshed.password_hash, new_password))

        # Verify all tokens are now used (the one we just used + the invalidated one).
        remaining_unused = self.PasswordResetToken.query.filter_by(
            user_id=self.student.id, used_at=None
        ).count()
        self.assertEqual(remaining_unused, 0)

    def test_concurrent_reset_no_unexpected_errors(self):
        """Concurrent reset requests must not produce integrity errors or
        transaction failures."""
        barrier = threading.Barrier(2)
        errors = []
        errors_lock = threading.Lock()

        def worker(idx):
            client = self.app.test_client()
            env = self._next_ip_environ()
            csrf = self._csrf_token(client, environ_base=env)
            barrier.wait()
            try:
                resp = client.post(
                    "/api/auth/forgot-password",
                    json={"email": "alice.student@example.com"},
                    headers={"X-CSRF-Token": csrf},
                    environ_base=env,
                )
                if resp.status_code not in (200, 429):
                    with errors_lock:
                        errors.append((idx, resp.status_code, resp.get_json()))
            except Exception as exc:
                with errors_lock:
                    errors.append((idx, "exception", str(exc)))

        t1 = threading.Thread(target=worker, args=(1,))
        t2 = threading.Thread(target=worker, args=(2,))
        t1.start()
        t2.start()
        t1.join(timeout=15)
        t2.join(timeout=15)

        self.assertFalse(t1.is_alive())
        self.assertFalse(t2.is_alive())
        self.assertEqual(errors, [], f"Unexpected errors: {errors}")


if __name__ == "__main__":
    unittest.main()
