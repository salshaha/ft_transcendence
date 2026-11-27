import os
import tempfile

TEST_TEMP_DIR = tempfile.mkdtemp(prefix="ft-transcendence-tests-")

if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(TEST_TEMP_DIR, 'test.db')}"
if not os.environ.get("STORAGE_ROOT"):
    os.environ["STORAGE_ROOT"] = os.path.join(TEST_TEMP_DIR, "uploads")

if not os.environ["DATABASE_URL"].startswith("sqlite:"):
    raise RuntimeError("Refusing to run tests against a non-SQLite database")
