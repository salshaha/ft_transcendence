import os
import subprocess
import sys
import unittest
from pathlib import Path


class ConfigurationSecurityTests(unittest.TestCase):
    def test_missing_or_short_secret_key_fails_closed(self):
        base_env = os.environ.copy()
        for name in (
            "SECRET_KEY",
            "VAULT_AGENT_ADDR",
            "DATABASE_URL",
            "POSTGRES_DB",
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
        ):
            base_env.pop(name, None)
        base_env["PYTHON_DOTENV_DISABLED"] = "1"

        for secret_key in (None, "too-short"):
            with self.subTest(secret_key_is_missing=secret_key is None):
                test_env = base_env.copy()
                if secret_key is not None:
                    test_env["SECRET_KEY"] = secret_key

                result = subprocess.run(
                    [sys.executable, "-c", "import app.config"],
                    cwd=Path(__file__).resolve().parents[1],
                    env=test_env,
                    capture_output=True,
                    text=True,
                    check=False,
                )

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("SECRET_KEY must be configured", result.stderr)


if __name__ == "__main__":
    unittest.main()
