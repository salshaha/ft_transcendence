import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")

db_user = quote_plus(os.environ["POSTGRES_USER"])
db_password = quote_plus(os.environ["POSTGRES_PASSWORD"])
db_name = quote_plus(os.environ["POSTGRES_DB"])
db_port = os.getenv("POSTGRES_PORT", "5432")

SQLALCHEMY_DATABASE_URI = (
    f"postgresql+psycopg2://{db_user}:{db_password}"
    f"@localhost:{db_port}/{db_name}"
)

SQLALCHEMY_TRACK_MODIFICATIONS = False
