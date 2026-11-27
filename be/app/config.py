import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote_plus

import hvac
import requests
from dotenv import load_dotenv

BE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BE_ROOT.parent if BE_ROOT.name == "be" else BE_ROOT
load_dotenv(PROJECT_ROOT / ".env")

VAULT_AGENT_ADDR = os.getenv("VAULT_AGENT_ADDR")


def load_vault_secrets():
    if not VAULT_AGENT_ADDR:
        return {}

    client = hvac.Client(url=VAULT_AGENT_ADDR, timeout=5)
    try:
        response = client.secrets.kv.v2.read_secret_version(
            mount_point="secret",
            path="ft-transcendence/backend",
        )
    except (
        hvac.exceptions.VaultError,
        requests.exceptions.RequestException,
    ) as exc:
        raise RuntimeError(
            "Unable to read backend secrets from Vault Agent"
        ) from exc

    secret_data = response["data"]["data"]
    required_keys = {
        "SECRET_KEY",
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
    }
    allowed_keys = required_keys | {"MICROSOFT_CLIENT_SECRET", "RESEND_API_KEY"}
    if not isinstance(secret_data, dict):
        raise RuntimeError(
            "Vault backend secret data must be a key/value object"
        )
    missing_keys = required_keys.difference(secret_data)
    if missing_keys:
        raise RuntimeError(
            "Vault backend secret is missing required fields: "
            + ", ".join(sorted(missing_keys))
        )
    unexpected_keys = set(secret_data).difference(allowed_keys)
    if unexpected_keys:
        raise RuntimeError(
            "Vault backend secret contains unexpected fields: "
            + ", ".join(sorted(unexpected_keys))
        )
    if any(
        not isinstance(secret_data[key], str) or not secret_data[key]
        for key in required_keys
    ):
        raise RuntimeError(
            "Required Vault backend secret fields must be non-empty strings"
        )
    if len(secret_data["SECRET_KEY"]) < 32:
        raise RuntimeError("Vault SECRET_KEY must be at least 32 characters")

    return secret_data


VAULT_SECRETS = load_vault_secrets()


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


if VAULT_AGENT_ADDR:
    SECRET_KEY = VAULT_SECRETS["SECRET_KEY"]
else:
    SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
    if len(SECRET_KEY) < 32:
        raise RuntimeError(
            "SECRET_KEY must be configured with at least 32 characters "
            "when Vault is not enabled"
        )
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:8080")
FRONTEND_URL = (
    os.getenv("FRONTEND_URL") or FRONTEND_ORIGIN
).strip().rstrip("/")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", FRONTEND_ORIGIN).split(",")
    if origin.strip()
]

RESEND_API_KEY = VAULT_SECRETS.get(
    "RESEND_API_KEY",
    "" if VAULT_AGENT_ADDR else os.getenv("RESEND_API_KEY", ""),
).strip()
EMAIL_FROM = os.getenv("EMAIL_FROM", "").strip()
PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = max(
    5, env_int("PASSWORD_RESET_TOKEN_EXPIRY_MINUTES", 60)
)
PASSWORD_RESET_REQUEST_LIMIT = os.getenv(
    "PASSWORD_RESET_REQUEST_LIMIT", "5 per hour"
).strip()
PASSWORD_RESET_CONFIRM_LIMIT = os.getenv(
    "PASSWORD_RESET_CONFIRM_LIMIT", "10 per hour"
).strip()

# In Compose, Flask reaches PostgreSQL through the private service network.
DATABASE_URL = None if VAULT_AGENT_ADDR else os.getenv("DATABASE_URL")
if DATABASE_URL:
    if DATABASE_URL.startswith(("postgresql://", "postgres://")):
        DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL.split("://", 1)[1]
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
else:
    db_user = quote_plus(
        VAULT_SECRETS.get("POSTGRES_USER", os.environ.get("POSTGRES_USER", ""))
    )
    db_password = quote_plus(
        VAULT_SECRETS.get(
            "POSTGRES_PASSWORD", os.environ.get("POSTGRES_PASSWORD", "")
        )
    )
    db_name = quote_plus(
        VAULT_SECRETS.get("POSTGRES_DB", os.environ.get("POSTGRES_DB", ""))
    )
    if not db_user or not db_password or not db_name:
        raise RuntimeError(
            "Database credentials must be provided through Vault or local "
            "development environment variables"
        )
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql+psycopg2://{db_user}:{db_password}"
        f"@{db_host}:{db_port}/{db_name}"
    )

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
PERMANENT_SESSION_LIFETIME = timedelta(
    days=env_int("SESSION_LIFETIME_DAYS", 14)
)

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "").strip()
MICROSOFT_CLIENT_SECRET = VAULT_SECRETS.get(
    "MICROSOFT_CLIENT_SECRET",
    "" if VAULT_AGENT_ADDR else os.getenv("MICROSOFT_CLIENT_SECRET", ""),
).strip()
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "organizations").strip()
MICROSOFT_REDIRECT_URI = os.getenv(
    "MICROSOFT_REDIRECT_URI",
    "http://localhost:5000/api/auth/microsoft/callback",
).strip()
MICROSOFT_AUTHORITY = (
    f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
)
MICROSOFT_GRAPH_SCOPES = ("User.Read", "EduRoster.ReadBasic")

# Uploads are written outside the Flask static folder and streamed back only
# after authorization. See app/services/storage.py.
MAX_CONTENT_LENGTH = env_int("MAX_CONTENT_LENGTH_BYTES", 110 * 1024 * 1024)
MAX_JSON_CONTENT_LENGTH = env_int(
    "MAX_JSON_CONTENT_LENGTH_BYTES", 2 * 1024 * 1024
)
# Keep non-file request parsing and URL sizes bounded even when a client sends
# many form fields or oversized query strings.
MAX_FORM_MEMORY_SIZE = env_int("MAX_FORM_MEMORY_SIZE_BYTES", 2 * 1024 * 1024)
MAX_FORM_PARTS = env_int("MAX_FORM_PARTS", 200)
MAX_URL_LENGTH = env_int("MAX_URL_LENGTH", 8192)
RATELIMIT_STORAGE_URI = os.getenv("RATE_LIMIT_STORAGE_URI", "memory://").strip()
RATELIMIT_DEFAULT = os.getenv("API_RATE_LIMIT", "300 per hour").strip()
RATELIMIT_APPLICATION = os.getenv(
    "API_GLOBAL_RATE_LIMIT", "1200 per hour"
).strip()
RATELIMIT_HEADERS_ENABLED = True
RATELIMIT_STRATEGY = "fixed-window"
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").strip().lower()
STORAGE_ROOT = os.getenv("STORAGE_ROOT", str(BE_ROOT / "uploads"))
STORAGE_MAX_AVATAR_BYTES = env_int(
    "STORAGE_MAX_AVATAR_BYTES", 5 * 1024 * 1024
)
STORAGE_MAX_PROJECT_REQUIREMENTS_BYTES = env_int(
    "STORAGE_MAX_PROJECT_REQUIREMENTS_BYTES", 20 * 1024 * 1024
)
STORAGE_MAX_TASK_ATTACHMENT_BYTES = env_int(
    "STORAGE_MAX_TASK_ATTACHMENT_BYTES", 25 * 1024 * 1024
)
STORAGE_MAX_PROJECT_SUBMISSION_BYTES = env_int(
    "STORAGE_MAX_PROJECT_SUBMISSION_BYTES", 100 * 1024 * 1024
)


MICROSOFT_SCOPES = ["User.Read"]
