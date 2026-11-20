"""File storage abstraction used by avatars, PDFs, attachments and submissions."""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from flask import current_app

CHUNK_SIZE = 1024 * 1024


class StorageError(Exception):
    """Base error for storage operations."""


class StorageValidationError(StorageError):
    """Raised when an upload does not satisfy the category rules."""


@dataclass(frozen=True)
class FileRule:
    extensions: frozenset[str]
    mime_types: frozenset[str]
    limit_config_key: str


@dataclass(frozen=True)
class StoredFile:
    key: str
    original_name: str
    content_type: str
    size: int
    sha256: str


PDF_EXTENSIONS = frozenset({"pdf"})
IMAGE_EXTENSIONS = frozenset({"png", "jpg", "jpeg", "gif", "webp"})
ARCHIVE_EXTENSIONS = frozenset({"zip"})
DOCUMENT_EXTENSIONS = frozenset({"doc", "docx", "xls", "xlsx", "ppt", "pptx"})
TEXT_EXTENSIONS = frozenset({"txt", "md", "csv"})

FILE_RULES = {
    "avatar": FileRule(
        extensions=IMAGE_EXTENSIONS,
        mime_types=frozenset(
            {"image/png", "image/jpeg", "image/gif", "image/webp"}
        ),
        limit_config_key="STORAGE_MAX_AVATAR_BYTES",
    ),
    "project_requirements": FileRule(
        extensions=PDF_EXTENSIONS,
        mime_types=frozenset({"application/pdf"}),
        limit_config_key="STORAGE_MAX_PROJECT_REQUIREMENTS_BYTES",
    ),
    "task_attachment": FileRule(
        extensions=(
            PDF_EXTENSIONS
            | IMAGE_EXTENSIONS
            | ARCHIVE_EXTENSIONS
            | DOCUMENT_EXTENSIONS
            | TEXT_EXTENSIONS
        ),
        mime_types=frozenset(
            {
                "application/pdf",
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "application/zip",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "text/plain",
                "text/markdown",
                "text/csv",
            }
        ),
        limit_config_key="STORAGE_MAX_TASK_ATTACHMENT_BYTES",
    ),
    "project_submission": FileRule(
        extensions=(
            PDF_EXTENSIONS
            | IMAGE_EXTENSIONS
            | ARCHIVE_EXTENSIONS
            | DOCUMENT_EXTENSIONS
            | TEXT_EXTENSIONS
        ),
        mime_types=frozenset(
            {
                "application/pdf",
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "application/zip",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "text/plain",
                "text/markdown",
                "text/csv",
            }
        ),
        limit_config_key="STORAGE_MAX_PROJECT_SUBMISSION_BYTES",
    ),
}

GENERIC_MIME_TYPES = frozenset({"", "application/octet-stream"})
OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _signature_matches(extension, head):
    if extension == "pdf":
        return head.lstrip().startswith(b"%PDF-")
    if extension == "png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if extension in {"jpg", "jpeg"}:
        return head.startswith(b"\xff\xd8\xff")
    if extension == "gif":
        return head.startswith((b"GIF87a", b"GIF89a"))
    if extension == "webp":
        return len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"WEBP"
    if extension in {"zip", "docx", "xlsx", "pptx"}:
        return head.startswith(b"PK\x03\x04")
    if extension in {"doc", "xls", "ppt"}:
        return head.startswith(OLE_SIGNATURE)
    return True


def validate_upload(file_storage, category, max_bytes=None):
    """Validate an upload against its category and return its extension."""
    rule = FILE_RULES.get(category)
    if rule is None:
        raise StorageValidationError(f"Unknown upload category: {category}")

    filename = getattr(file_storage, "filename", None)
    if not isinstance(filename, str) or not filename.strip():
        raise StorageValidationError("A file is required")

    safe_name = Path(filename.replace("\\", "/")).name
    extension = Path(safe_name).suffix.lower().lstrip(".")
    if extension not in rule.extensions:
        allowed = ", ".join(sorted(rule.extensions))
        raise StorageValidationError(
            f"Unsupported file type for {category}. Allowed: {allowed}"
        )

    content_type = (
        getattr(file_storage, "mimetype", None)
        or getattr(file_storage, "content_type", None)
        or ""
    ).lower()
    if content_type not in rule.mime_types and content_type not in GENERIC_MIME_TYPES:
        raise StorageValidationError(
            f"Unsupported content type for {category}: {content_type}"
        )

    stream = file_storage.stream
    position = stream.tell() if hasattr(stream, "tell") else 0
    head = stream.read(32) if hasattr(stream, "read") else b""
    if hasattr(stream, "seek"):
        stream.seek(position)
    if not _signature_matches(extension, head):
        raise StorageValidationError(
            "The file contents do not match the declared file type"
        )

    if max_bytes is not None:
        content_length = getattr(file_storage, "content_length", None)
        if content_length is not None and content_length > max_bytes:
            raise StorageValidationError(
                f"File exceeds the {max_bytes // (1024 * 1024)} MB limit"
            )

    return extension


class StorageBackend(ABC):
    """Minimal interface implemented by local disk and future S3 backends."""

    @abstractmethod
    def save(self, source: BinaryIO, key: str, *, max_bytes: int) -> tuple[int, str]:
        """Persist a stream under key and return (size, sha256)."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Return a readable binary stream for key."""

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete key, returning True when something was removed."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return whether key exists."""


class LocalStorageBackend(StorageBackend):
    """Store files on local disk outside the Flask static directory."""

    def __init__(self, root):
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key):
        if not isinstance(key, str) or not key or "\\" in key:
            raise StorageError("Invalid storage key")
        path = (self.root / key).resolve()
        if path != self.root and self.root not in path.parents:
            raise StorageError("Invalid storage key")
        return path

    def save(self, source, key, *, max_bytes):
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        temp_name = None

        try:
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=path.parent, delete=False
            ) as temp_file:
                temp_name = temp_file.name
                while True:
                    chunk = source.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        raise StorageValidationError(
                            f"File exceeds the {max_bytes // (1024 * 1024)} MB limit"
                        )
                    digest.update(chunk)
                    temp_file.write(chunk)
                temp_file.flush()
                os.fsync(temp_file.fileno())
            os.replace(temp_name, path)
            temp_name = None
        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)

        return size, digest.hexdigest()

    def open(self, key):
        return self._path(key).open("rb")

    def delete(self, key):
        path = self._path(key)
        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False

    def exists(self, key):
        return self._path(key).is_file()


class StorageService:
    """Category-aware facade. Every upload feature must use this service."""

    def __init__(self, backend):
        self.backend = backend

    def save_upload(self, file_storage, category, owner_id):
        if category not in FILE_RULES:
            raise StorageValidationError(f"Unknown upload category: {category}")

        rule = FILE_RULES[category]
        max_bytes = int(current_app.config[rule.limit_config_key])
        extension = validate_upload(
            file_storage, category, max_bytes=max_bytes
        )

        owner = re.sub(r"[^A-Za-z0-9_-]", "_", str(owner_id))
        key = f"{category}/{owner}/{uuid.uuid4().hex}.{extension}"
        size, checksum = self.backend.save(
            file_storage.stream, key, max_bytes=max_bytes
        )

        return StoredFile(
            key=key,
            original_name=Path(
                file_storage.filename.replace("\\", "/")
            ).name,
            content_type=file_storage.mimetype or "application/octet-stream",
            size=size,
            sha256=checksum,
        )

    def open(self, key):
        return self.backend.open(key)

    def delete(self, key):
        return self.backend.delete(key)

    def exists(self, key):
        return self.backend.exists(key)


def init_storage(app):
    backend_name = app.config.get("STORAGE_BACKEND", "local")
    if backend_name != "local":
        raise RuntimeError(
            f"Unsupported STORAGE_BACKEND={backend_name!r}. "
            "This phase uses the local disk backend."
        )
    app.extensions["storage"] = StorageService(
        LocalStorageBackend(app.config["STORAGE_ROOT"])
    )
