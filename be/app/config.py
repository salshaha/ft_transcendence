import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

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
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
