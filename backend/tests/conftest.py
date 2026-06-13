"""
Pytest configuration for Datrix smoke tests.

Uses an in-process SQLite database so no Neon/Postgres instance is needed.
The DATABASE_URL env var must be set before any app module is imported —
this module is evaluated first by pytest, so the override takes effect
before app.main (and app.db.engine) are loaded.

_run_migrations() in main.py calls alembic as a subprocess. We patch
subprocess.run to return success immediately so the test suite doesn't
spend 15 seconds waiting for retries.
"""
import os
import pathlib
from unittest.mock import MagicMock, patch

# ── Point app at a local SQLite file before any app import ────────────────────
_TEST_DB = str(pathlib.Path(__file__).parent / "test_datrix.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

# Remove stale DB from previous run so tests always start clean
pathlib.Path(_TEST_DB).unlink(missing_ok=True)

# ── Import app after env is set ───────────────────────────────────────────────
# subprocess.run is patched so _run_migrations() (called at module level in
# main.py) exits immediately with success rather than retrying for 15 s.
_mock_proc = MagicMock()
_mock_proc.returncode = 0

with patch("subprocess.run", return_value=_mock_proc):
    from app.main import app as datrix_app  # noqa: E402 — intentional late import

# app.db.models is already registered as a side-effect of importing app.main
from app.db.engine import create_tables  # noqa: E402

# Create every table in the SQLite test DB
create_tables()

import pytest
from fastapi.testclient import TestClient


# ── Shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client() -> TestClient:
    """Single TestClient for the whole session — triggers lifespan once."""
    with TestClient(datrix_app) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(client: TestClient) -> dict[str, str]:
    """Register + login once; return {'access': ..., 'refresh': ...}."""
    client.post("/auth/register", json={
        "email": "smoketest@datrix.io",
        "password": "Smoke1234!",
    })
    resp = client.post("/auth/login", json={
        "email": "smoketest@datrix.io",
        "password": "Smoke1234!",
    })
    data = resp.json()
    return {
        "access":  data["access_token"],
        "refresh": data["refresh_token"],
    }


@pytest.fixture(scope="session")
def auth(tokens: dict[str, str]) -> dict[str, str]:
    """Authorization header dict for use in authenticated requests."""
    return {"Authorization": f"Bearer {tokens['access']}"}
