import os
import tempfile

TEST_TEMP_DIR = tempfile.mkdtemp(prefix="ft-transcendence-tests-")

os.environ.setdefault(
    "DATABASE_URL", f"sqlite:///{os.path.join(TEST_TEMP_DIR, 'test.db')}"
)
os.environ.setdefault("STORAGE_ROOT", os.path.join(TEST_TEMP_DIR, "uploads"))
