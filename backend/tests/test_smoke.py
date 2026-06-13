"""
Smoke tests — verify every critical route returns the right status code
and shape. Not exhaustive unit tests; purpose is to catch broken imports,
missing dependencies, schema mismatches, and wiring regressions in CI.
"""
import io
import pytest
from fastapi.testclient import TestClient


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "environment" in body


# ── Auth: register ────────────────────────────────────────────────────────────

def test_register_success(client: TestClient):
    r = client.post("/auth/register", json={
        "email": "newuser@datrix.io",
        "password": "NewPass123!",
    })
    assert r.status_code == 201
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body


def test_register_duplicate_email(client: TestClient):
    payload = {"email": "dup@datrix.io", "password": "Dup1234!"}
    client.post("/auth/register", json=payload)
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 400


def test_register_invalid_payload(client: TestClient):
    # Missing password
    r = client.post("/auth/register", json={"email": "bad@datrix.io"})
    assert r.status_code == 422


# ── Auth: login ───────────────────────────────────────────────────────────────

def test_login_success(client: TestClient, tokens: dict):
    # tokens fixture already logged in; just verify shape
    assert tokens["access"]
    assert tokens["refresh"]


def test_login_wrong_password(client: TestClient):
    r = client.post("/auth/login", json={
        "email": "smoketest@datrix.io",
        "password": "WrongPass!",
    })
    assert r.status_code == 401


def test_login_unknown_email(client: TestClient):
    r = client.post("/auth/login", json={
        "email": "nobody@datrix.io",
        "password": "Whatever1!",
    })
    assert r.status_code == 401


# ── Auth: me / refresh / logout ───────────────────────────────────────────────

def test_me_authenticated(client: TestClient, auth: dict):
    r = client.get("/auth/me", headers=auth)
    assert r.status_code == 200
    assert r.json()["email"] == "smoketest@datrix.io"


def test_me_unauthenticated(client: TestClient):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_refresh_token(client: TestClient, tokens: dict):
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh"]})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body


def test_logout(client: TestClient, tokens: dict):
    # Register a separate user so we don't invalidate the shared session token
    reg = client.post("/auth/register", json={
        "email": "logout@datrix.io",
        "password": "Logout123!",
    })
    rt = reg.json()["refresh_token"]
    r = client.post("/auth/logout", json={"refresh_token": rt})
    assert r.status_code == 204


# ── Protected routes: auth guard ─────────────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/datasets",
    "/pipelines",
    "/synthetic/jobs",
    "/benchmark/jobs",
    "/marketplace/assets",
    "/settings",
    "/compliance/policies",
    "/al/sessions",
])
def test_protected_routes_reject_unauthenticated(client: TestClient, path: str):
    r = client.get(path)
    assert r.status_code == 401


# ── Datasets ──────────────────────────────────────────────────────────────────

def test_datasets_list(client: TestClient, auth: dict):
    r = client.get("/datasets", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_dataset_upload_csv(client: TestClient, auth: dict):
    csv_content = b"col_a,col_b,col_c\n1,foo,0.1\n2,bar,0.2\n3,baz,0.3\n"
    r = client.post(
        "/datasets/upload",
        headers=auth,
        files={"file": ("test_upload.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"].startswith("test_upload")
    assert "id" in body


def test_dataset_get_by_id(client: TestClient, auth: dict):
    # Upload a fresh dataset, then fetch it by ID
    csv_content = b"x,y\n10,20\n30,40\n"
    up = client.post(
        "/datasets/upload",
        headers=auth,
        files={"file": ("fetch_me.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert up.status_code == 201
    ds_id = up.json()["id"]

    r = client.get(f"/datasets/{ds_id}", headers=auth)
    assert r.status_code == 200
    assert r.json()["id"] == ds_id


def test_dataset_not_found(client: TestClient, auth: dict):
    r = client.get("/datasets/nonexistent-id", headers=auth)
    assert r.status_code == 404


# ── Pipelines ─────────────────────────────────────────────────────────────────

def test_pipelines_list(client: TestClient, auth: dict):
    r = client.get("/pipelines", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_pipeline_create_and_get(client: TestClient, auth: dict):
    r = client.post("/pipelines", headers=auth, json={
        "name": "Smoke Test Pipeline",
        "description": "Created by smoke tests",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Smoke Test Pipeline"
    pipe_id = body["id"]

    r2 = client.get(f"/pipelines/{pipe_id}", headers=auth)
    assert r2.status_code == 200
    assert r2.json()["id"] == pipe_id


# ── Synthetic ─────────────────────────────────────────────────────────────────

def test_synthetic_jobs_list(client: TestClient, auth: dict):
    r = client.get("/synthetic/jobs", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── Benchmark ─────────────────────────────────────────────────────────────────

def test_benchmark_jobs_list(client: TestClient, auth: dict):
    r = client.get("/benchmark/jobs", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── Marketplace ───────────────────────────────────────────────────────────────

def test_marketplace_assets_list(client: TestClient, auth: dict):
    r = client.get("/marketplace/assets", headers=auth)
    assert r.status_code == 200
    assets = r.json()
    assert isinstance(assets, list)
    # Seeded assets should be present after lifespan startup
    assert len(assets) >= 1


def test_marketplace_assets_search(client: TestClient, auth: dict):
    r = client.get("/marketplace/assets?search=iris", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_marketplace_asset_not_found(client: TestClient, auth: dict):
    r = client.get("/marketplace/assets/does-not-exist", headers=auth)
    assert r.status_code == 404


# ── Settings ──────────────────────────────────────────────────────────────────

def test_settings_get(client: TestClient, auth: dict):
    r = client.get("/settings", headers=auth)
    assert r.status_code == 200
    body = r.json()
    # Settings response is nested: {"settings": {...}, "stats": {...}}
    assert "settings" in body
    assert "app_name" in body["settings"]


def test_settings_patch(client: TestClient, auth: dict):
    r = client.patch("/settings", headers=auth, json={"app_name": "Datrix Test"})
    assert r.status_code == 200
    body = r.json()
    settings = body.get("settings", body)  # handle both flat and nested response
    assert settings.get("app_name") == "Datrix Test"

    # Reset
    client.patch("/settings", headers=auth, json={"app_name": "Datrix"})


# ── Compliance ────────────────────────────────────────────────────────────────

def test_compliance_policies_list(client: TestClient, auth: dict):
    r = client.get("/compliance/policies", headers=auth)
    assert r.status_code == 200
    policies = r.json()
    assert isinstance(policies, list)
    # 8 default policies seeded at startup
    assert len(policies) >= 8


def test_compliance_audit_log(client: TestClient, auth: dict):
    r = client.get("/compliance/audit", headers=auth)
    assert r.status_code == 200
    body = r.json()
    # Response is either a list or {"events": [...], ...}
    events = body if isinstance(body, list) else body.get("events", [])
    assert isinstance(events, list)


# ── Active Learning ───────────────────────────────────────────────────────────

def test_al_sessions_list(client: TestClient, auth: dict):
    r = client.get("/al/sessions", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
