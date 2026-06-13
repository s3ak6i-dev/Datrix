"""
Storage backend abstraction.

Backends
--------
  local  — writes to UPLOADS_DIR on the local filesystem (default, zero config)
  s3     — writes to an S3 bucket  (requires: pip install boto3 + AWS creds)

Set STORAGE_BACKEND="s3" in .env (along with AWS_S3_BUCKET / AWS_REGION) to
switch at deploy time without touching application code.

Usage
-----
    from app.services.storage import get_storage

    storage = get_storage()
    key, display_name = storage.unique_save("report.csv", csv_bytes)
    storage.delete(key)
    local_path = storage.local_path(key)   # always a real filesystem Path

Design notes
------------
- `file_path` stored in the DB is the "storage key":
    local → absolute path string  e.g. "/app/data/uploads/report.csv"
    s3    → s3-URI string         e.g. "s3://my-bucket/uploads/report.csv"
- Services that read data via polars/pandas use `storage.local_path(key)` which
  is transparent for local (identity) and downloads to a temp file for S3.
- Model files in data/al_models/ are NOT managed by this abstraction; they are
  written by the AL executor directly and cleaned up with the session.
"""
from __future__ import annotations

import tempfile
import uuid
from abc import ABC, abstractmethod
from pathlib import Path


class StorageBackend(ABC):
    """Protocol for file storage operations."""

    @abstractmethod
    def save(self, filename: str, data: bytes) -> str:
        """
        Write `data` to storage under `filename`.
        Returns the storage key (use this as `file_path` in the DB).
        Does NOT deduplicate — use `unique_save` for uploads.
        """

    @abstractmethod
    def unique_save(self, filename: str, data: bytes) -> tuple[str, str]:
        """
        Write `data` deduplicating `filename` if a collision exists.
        Returns ``(storage_key, display_name)`` where display_name is the
        final filename shown in the UI.
        """

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return True if the key exists in storage."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the object at key. Silent no-op if it doesn't exist."""

    @abstractmethod
    def local_path(self, key: str) -> Path:
        """
        Return a local filesystem Path that can be passed to polars/pandas.
        - Local backend: returns Path(key) directly.
        - S3 backend: downloads the object to a NamedTemporaryFile and returns
          that path. The caller is responsible for cleanup if needed.
        """

    @abstractmethod
    def size_bytes(self) -> int:
        """Total bytes stored across all uploads."""

    @abstractmethod
    def file_count(self) -> int:
        """Number of stored files."""

    @abstractmethod
    def list_keys(self) -> list[str]:
        """Return all storage keys (one per stored file)."""

    @abstractmethod
    def write_back(self, key: str, local_path: Path) -> None:
        """
        Sync a locally-modified file back to storage after an in-place edit.
        - Local backend: no-op (the file was edited at key == local_path).
        - S3 backend: re-uploads local_path contents to the original key.
        """


# ── Local ─────────────────────────────────────────────────────────────────────

class LocalStorageBackend(StorageBackend):
    """Stores files under a local `base_dir`."""

    def __init__(self, base_dir: Path) -> None:
        self._dir = base_dir
        self._dir.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, data: bytes) -> str:
        path = self._dir / filename
        path.write_bytes(data)
        return str(path)

    def unique_save(self, filename: str, data: bytes) -> tuple[str, str]:
        path = self._dir / filename
        stem = Path(filename).stem
        suffix = Path(filename).suffix
        counter = 1
        while path.exists():
            deduped = f"{stem}_{counter}{suffix}"
            path = self._dir / deduped
            counter += 1
        path.write_bytes(data)
        return str(path), path.name

    def exists(self, key: str) -> bool:
        return Path(key).exists()

    def delete(self, key: str) -> None:
        Path(key).unlink(missing_ok=True)

    def local_path(self, key: str) -> Path:
        return Path(key)

    def size_bytes(self) -> int:
        if not self._dir.exists():
            return 0
        return sum(f.stat().st_size for f in self._dir.rglob("*") if f.is_file())

    def file_count(self) -> int:
        if not self._dir.exists():
            return 0
        return sum(1 for f in self._dir.iterdir() if f.is_file())

    def list_keys(self) -> list[str]:
        if not self._dir.exists():
            return []
        return [str(f) for f in self._dir.iterdir() if f.is_file()]

    def write_back(self, key: str, local_path: Path) -> None:
        pass  # local_path IS the canonical file; nothing to sync


# ── S3 ────────────────────────────────────────────────────────────────────────

class S3StorageBackend(StorageBackend):
    """
    Stores files in an S3 bucket under `prefix`.

    Requires boto3 ≥ 1.35.  Install with::

        pip install "boto3>=1.35"

    Credentials are picked up from the standard boto3 chain:
    env vars (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY), ~/.aws/credentials,
    or an EC2/ECS instance role.  No credentials needed if running on AWS with
    an IAM role that has s3:GetObject / s3:PutObject / s3:DeleteObject.
    """

    def __init__(
        self,
        bucket: str,
        region: str,
        prefix: str = "uploads/",
        endpoint_url: str = "",
        access_key_id: str = "",
        secret_access_key: str = "",
    ) -> None:
        try:
            import boto3
            from botocore.exceptions import ClientError as _CE
        except ImportError:
            raise RuntimeError(
                "boto3 is not installed. Add 'boto3>=1.35' to requirements.txt "
                "and run: pip install 'boto3>=1.35'"
            )
        self._bucket = bucket
        self._prefix = prefix.rstrip("/") + "/"
        self._s3 = boto3.client(
            "s3",
            region_name=region or "auto",
            endpoint_url=endpoint_url or None,          # None = real AWS; URL = R2/B2/MinIO
            aws_access_key_id=access_key_id or None,
            aws_secret_access_key=secret_access_key or None,
        )
        self._ClientError = _CE

    # ── helpers ──────────────────────────────────────────────────────────────

    def _s3_key(self, filename: str) -> str:
        return self._prefix + filename

    def _to_uri(self, s3_key: str) -> str:
        return f"s3://{self._bucket}/{s3_key}"

    def _from_uri(self, key: str) -> str:
        prefix = f"s3://{self._bucket}/"
        return key[len(prefix):] if key.startswith(prefix) else key

    # ── interface ─────────────────────────────────────────────────────────────

    def save(self, filename: str, data: bytes) -> str:
        s3_key = self._s3_key(filename)
        self._s3.put_object(Bucket=self._bucket, Key=s3_key, Body=data)
        return self._to_uri(s3_key)

    def unique_save(self, filename: str, data: bytes) -> tuple[str, str]:
        # S3 has no filesystem collision risk; prefix with a short UUID to guarantee
        # uniqueness across concurrent uploads of identically-named files.
        uid = uuid.uuid4().hex[:8]
        stem = Path(filename).stem
        suffix = Path(filename).suffix
        unique_filename = f"{stem}_{uid}{suffix}"
        stored_key = self.save(unique_filename, data)
        return stored_key, unique_filename

    def exists(self, key: str) -> bool:
        s3_key = self._from_uri(key)
        try:
            self._s3.head_object(Bucket=self._bucket, Key=s3_key)
            return True
        except self._ClientError:
            return False

    def delete(self, key: str) -> None:
        s3_key = self._from_uri(key)
        try:
            self._s3.delete_object(Bucket=self._bucket, Key=s3_key)
        except self._ClientError:
            pass

    def local_path(self, key: str) -> Path:
        """Download from S3 to a temp file and return its path."""
        s3_key = self._from_uri(key)
        suffix = Path(s3_key).suffix or ".tmp"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            self._s3.download_fileobj(self._bucket, s3_key, tmp)
        finally:
            tmp.flush()
            tmp.close()
        return Path(tmp.name)

    def size_bytes(self) -> int:
        total = 0
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=self._prefix):
            for obj in page.get("Contents", []):
                total += obj["Size"]
        return total

    def file_count(self) -> int:
        count = 0
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=self._prefix):
            count += len(page.get("Contents", []))
        return count

    def list_keys(self) -> list[str]:
        keys: list[str] = []
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=self._prefix):
            for obj in page.get("Contents", []):
                keys.append(self._to_uri(obj["Key"]))
        return keys

    def write_back(self, key: str, local_path: Path) -> None:
        s3_key = self._from_uri(key)
        self._s3.upload_file(str(local_path), self._bucket, s3_key)


# ── Factory ───────────────────────────────────────────────────────────────────

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """
    Return the configured storage backend singleton.

    Reads ``settings.STORAGE_BACKEND`` on first call; subsequent calls return
    the cached instance.  Call ``reset_storage()`` in tests to force
    re-initialisation with a different configuration.
    """
    global _storage
    if _storage is None:
        from app.core.config import settings, UPLOADS_DIR  # late import avoids circularity

        if settings.STORAGE_BACKEND.lower() == "s3":
            _storage = S3StorageBackend(
                bucket=settings.AWS_S3_BUCKET,
                region=settings.AWS_REGION,
                prefix=settings.AWS_S3_PREFIX,
                endpoint_url=settings.AWS_ENDPOINT_URL,
                access_key_id=settings.AWS_ACCESS_KEY_ID,
                secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        else:
            _storage = LocalStorageBackend(UPLOADS_DIR)
    return _storage


def reset_storage() -> None:
    """Clear the cached backend — for use in tests only."""
    global _storage
    _storage = None
