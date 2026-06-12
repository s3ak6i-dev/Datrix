"""
Dataset API — upload, list, get, delete, trigger scan.
All heavy work (ingestion, quality scan) runs in a background thread.
"""
from __future__ import annotations
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field

from app.core.config import UPLOADS_DIR, ALLOWED_EXTENSIONS
from app.models.store import store, Dataset, QualityScan, ColumnProfile
from app.services.ingestion import read_file, infer_schema
from app.services.quality import run_quality_scan
from app.services.cleaning import preview_fix, apply_fix, save_df

router = APIRouter(prefix="/datasets", tags=["datasets"])


# ── Pydantic response models ──────────────────────────────────────────

class DatasetOut(BaseModel):
    id: str
    name: str
    row_count: Optional[int]
    column_count: Optional[int]
    size_bytes: Optional[int]
    status: str
    schema_: Optional[list] = Field(None, alias="schema", serialization_alias="schema")
    created_at: str
    updated_at: str
    latest_scan_id: Optional[str]
    latest_score: Optional[float]

    model_config = {"populate_by_name": True, "serialize_by_alias": True}

    @classmethod
    def from_ds(cls, ds: Dataset) -> "DatasetOut":
        return cls(
            id=ds.id,
            name=ds.name,
            row_count=ds.row_count,
            column_count=ds.column_count,
            size_bytes=ds.size_bytes,
            status=ds.status,
            schema_=ds.schema,
            created_at=ds.created_at,
            updated_at=ds.updated_at,
            latest_scan_id=ds.latest_scan_id,
            latest_score=ds.latest_score,
        )


class ScanOut(BaseModel):
    id: str
    dataset_id: str
    status: str
    score: Optional[dict]
    issues: list
    scan_duration_ms: Optional[int]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: str

    @classmethod
    def from_scan(cls, s: QualityScan) -> "ScanOut":
        return cls(
            id=s.id,
            dataset_id=s.dataset_id,
            status=s.status,
            score=s.score,
            issues=s.issues,
            scan_duration_ms=s.scan_duration_ms,
            started_at=s.started_at,
            completed_at=s.completed_at,
            created_at=s.created_at,
        )


class FixRequest(BaseModel):
    issue_ids: list[str]
    options: dict = {}


# ── Background tasks ──────────────────────────────────────────────────

def _ingest_and_scan(dataset_id: str):
    ds = store.get_dataset(dataset_id)
    if not ds:
        return
    try:
        # Ingest
        ds.status = "ingesting"
        store.update_dataset(ds)
        df = read_file(Path(ds.file_path))
        ds.row_count = len(df)
        ds.column_count = len(df.columns)
        ds.schema = infer_schema(df)
        ds.status = "scanning"
        store.update_dataset(ds)

        # Quality scan
        scan = QualityScan(dataset_id=dataset_id)
        scan.status = "running"
        scan.started_at = datetime.now(timezone.utc).isoformat()
        store.add_scan(scan)

        result = run_quality_scan(ds.file_path)

        scan.status = "complete"
        scan.score = result["score"]
        scan.issues = result["issues"]
        scan.scan_duration_ms = result["duration_ms"]
        scan.completed_at = datetime.now(timezone.utc).isoformat()
        store.update_scan(scan)

        # Save column profiles
        profiles = [ColumnProfile(**p) for p in result["column_profiles"]]
        store.set_column_profiles(dataset_id, profiles)

        ds.status = "ready"
        ds.latest_scan_id = scan.id
        ds.latest_score = result["score"]["overall"]
        store.update_dataset(ds)

    except Exception as e:
        ds = store.get_dataset(dataset_id)
        if ds:
            ds.status = "error"
            ds.error_message = str(e)
            store.update_dataset(ds)


def _run_scan(dataset_id: str, scan_id: str):
    ds = store.get_dataset(dataset_id)
    scan = store.get_scan(scan_id)
    if not ds or not scan:
        return
    try:
        scan.status = "running"
        scan.started_at = datetime.now(timezone.utc).isoformat()
        ds.status = "scanning"
        store.update_dataset(ds)
        store.update_scan(scan)

        result = run_quality_scan(ds.file_path)

        scan.status = "complete"
        scan.score = result["score"]
        scan.issues = result["issues"]
        scan.scan_duration_ms = result["duration_ms"]
        scan.completed_at = datetime.now(timezone.utc).isoformat()
        store.update_scan(scan)

        profiles = [ColumnProfile(**p) for p in result["column_profiles"]]
        store.set_column_profiles(dataset_id, profiles)

        ds.status = "ready"
        ds.latest_scan_id = scan.id
        ds.latest_score = result["score"]["overall"]
        store.update_dataset(ds)

    except Exception as e:
        if scan:
            scan.status = "failed"
            store.update_scan(scan)
        if ds:
            ds.status = "ready"
            store.update_dataset(ds)


# ── Routes ────────────────────────────────────────────────────────────

@router.get("", response_model=list[DatasetOut])
def list_datasets():
    return [DatasetOut.from_ds(d) for d in store.list_datasets()]


@router.post("/upload", response_model=DatasetOut, status_code=201)
async def upload_dataset(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    save_path = UPLOADS_DIR / f"{file.filename}"
    # Handle name collisions
    counter = 1
    while save_path.exists():
        stem = Path(file.filename).stem
        save_path = UPLOADS_DIR / f"{stem}_{counter}{suffix}"
        counter += 1

    content = await file.read()
    save_path.write_bytes(content)

    ds = Dataset(
        name=file.filename or save_path.name,
        size_bytes=len(content),
        file_path=str(save_path),
        status="pending",
    )
    store.add_dataset(ds)

    thread = threading.Thread(target=_ingest_and_scan, args=(ds.id,), daemon=True)
    thread.start()

    return DatasetOut.from_ds(ds)


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: str):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return DatasetOut.from_ds(ds)


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    try:
        Path(ds.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    store.delete_dataset(dataset_id)


@router.post("/{dataset_id}/scan", response_model=ScanOut, status_code=201)
def trigger_scan(dataset_id: str):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds.status not in ("ready", "error"):
        raise HTTPException(409, f"Cannot scan dataset with status '{ds.status}'")

    scan = QualityScan(dataset_id=dataset_id)
    store.add_scan(scan)

    thread = threading.Thread(target=_run_scan, args=(dataset_id, scan.id), daemon=True)
    thread.start()

    return ScanOut.from_scan(scan)


@router.get("/{dataset_id}/scans", response_model=list[ScanOut])
def list_scans(dataset_id: str):
    if not store.get_dataset(dataset_id):
        raise HTTPException(404, "Dataset not found")
    return [ScanOut.from_scan(s) for s in store.list_scans(dataset_id)]


@router.get("/{dataset_id}/scan/latest", response_model=ScanOut)
def get_latest_scan(dataset_id: str):
    scan = store.get_latest_scan(dataset_id)
    if not scan:
        raise HTTPException(404, "No scans found for this dataset")
    return ScanOut.from_scan(scan)


@router.get("/{dataset_id}/scan/{scan_id}", response_model=ScanOut)
def get_scan(dataset_id: str, scan_id: str):
    scan = store.get_scan(scan_id)
    if not scan or scan.dataset_id != dataset_id:
        raise HTTPException(404, "Scan not found")
    return ScanOut.from_scan(scan)


@router.get("/{dataset_id}/columns")
def get_columns(dataset_id: str):
    profiles = store.get_column_profiles(dataset_id)
    if not profiles:
        ds = store.get_dataset(dataset_id)
        if not ds:
            raise HTTPException(404, "Dataset not found")
        raise HTTPException(404, "Column profiles not available — run a scan first")
    return [_profile_to_dict(p) for p in profiles]


@router.get("/{dataset_id}/columns/{col_name}")
def get_column(dataset_id: str, col_name: str):
    profiles = store.get_column_profiles(dataset_id)
    for p in profiles:
        if p.name == col_name:
            return _profile_to_dict(p)
    raise HTTPException(404, f"Column '{col_name}' not found")


def _profile_to_dict(p: ColumnProfile) -> dict:
    return {
        "name": p.name,
        "dtype": p.dtype,
        "null_count": p.null_count,
        "null_pct": p.null_pct,
        "unique_count": p.unique_count,
        "quality_score": p.quality_score,
        "issues": p.issues,
        "distribution": p.distribution,
        "stats": p.stats,
    }


# ── Cleaning endpoints ────────────────────────────────────────────────

@router.post("/{dataset_id}/fix/preview")
def preview_fixes(dataset_id: str, body: FixRequest):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    scan = store.get_latest_scan(dataset_id)
    if not scan:
        raise HTTPException(404, "No scan found — run a scan first")

    results = []
    for issue_id in body.issue_ids:
        issue = next((i for i in scan.issues if i["id"] == issue_id), None)
        if not issue:
            continue
        preview = preview_fix(ds.file_path, issue)
        results.append({"issue_id": issue_id, **preview})
    return results


@router.post("/{dataset_id}/fix")
def apply_fixes(dataset_id: str, body: FixRequest):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    scan = store.get_latest_scan(dataset_id)
    if not scan:
        raise HTTPException(404, "No scan found — run a scan first")

    total_changed = 0
    for issue_id in body.issue_ids:
        issue = next((i for i in scan.issues if i["id"] == issue_id), None)
        if not issue:
            continue
        try:
            updated_df, rows_changed = apply_fix(ds.file_path, issue, body.options)
            save_df(updated_df, ds.file_path)
            total_changed += rows_changed
            # Mark issue as resolved
            for i in scan.issues:
                if i["id"] == issue_id:
                    i["status"] = "resolved"
            store.update_scan(scan)
        except Exception as e:
            raise HTTPException(500, f"Failed to apply fix for issue {issue_id}: {e}")

    return {"rows_changed": total_changed}


@router.delete("/{dataset_id}/fix/{fix_id}", status_code=204)
def rollback_fix(dataset_id: str, fix_id: str):
    raise HTTPException(501, "Rollback not yet implemented in Phase 1 in-memory mode")
