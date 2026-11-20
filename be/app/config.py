import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


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


SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", FRONTEND_ORIGIN).split(",")
    if origin.strip()
]

# Flask currently runs on the host, so PostgreSQL is reached through the
# published Compose port. If Flask is containerized later, set POSTGRES_HOST
# to the Compose service name (postgres) and POSTGRES_PORT to 5432.
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
else:
    db_user = quote_plus(os.environ["POSTGRES_USER"])
    db_password = quote_plus(os.environ["POSTGRES_PASSWORD"])
    db_name = quote_plus(os.environ["POSTGRES_DB"])
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
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "").strip()
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
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").strip().lower()
STORAGE_ROOT = os.getenv(
    "STORAGE_ROOT", str(PROJECT_ROOT / "be" / "uploads")
)
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
