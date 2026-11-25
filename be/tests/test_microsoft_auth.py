import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app


class MicrosoftAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_status_endpoint(self):
        response = self.client.get("/api/auth/microsoft/status")
        self.assertEqual(response.status_code, 200)
        self.assertIn("configured", response.get_json())

    def test_login_redirects_to_microsoft(self):
        with patch("app.auth.routes.is_configured", return_value=True), patch(
            "app.auth.routes.start_auth_flow",
            return_value={
                "auth_uri": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "state": "test-state",
            },
        ):
            response = self.client.get("/api/auth/microsoft/login")
        self.assertEqual(response.status_code, 302)
        self.assertIn("login.microsoftonline.com", response.headers["Location"])

    def test_callback_missing_flow_redirects_with_error(self):
        response = self.client.get("/auth/microsoft/callback?code=abc&state=def")
        self.assertEqual(response.status_code, 302)
        self.assertIn("microsoft_error", response.headers["Location"])

    def test_callback_oauth_error_redirects_with_error(self):
        response = self.client.get(
            "/auth/microsoft/callback?error=access_denied&error_description=User+cancelled"
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("User+cancelled", response.headers["Location"])

    def test_invalid_state_is_rejected(self):
        with self.client.session_transaction() as sess:
            sess["microsoft_auth_flow"] = {"state": "expected"}
        response = self.client.get("/auth/microsoft/callback?code=abc&state=wrong")
        self.assertEqual(response.status_code, 302)
        self.assertIn("microsoft_error", response.headers["Location"])


if __name__ == "__main__":
    unittest.main()
