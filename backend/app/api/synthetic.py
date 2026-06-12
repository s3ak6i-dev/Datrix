"""
Synthetic data generation API.
POST /synthetic/jobs  — create and start a job
GET  /synthetic/jobs  — list all jobs
GET  /synthetic/jobs/{job_id} — get job status
"""
from __future__ import annotations
import threading
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from app.core.limiter import limiter
from pydantic import BaseModel

from pathlib import Path

from app.models.store import store, SyntheticJob, TrainedModel
from app.services.synthetic_executor import execute_synthetic_job

router = APIRouter(prefix="/synthetic", tags=["synthetic"])


# ── Pydantic models ───────────────────────────────────────────────────

class JobOut(BaseModel):
    id: str
    source_dataset_id: str
    output_dataset_id: Optional[str]
    output_name: str
    method: str
    row_count: int
    column_overrides: Optional[dict]
    status: str
    error_message: Optional[str]
    created_at: str
    completed_at: Optional[str]

    @classmethod
    def from_job(cls, j: SyntheticJob) -> "JobOut":
        return cls(
            id=j.id, source_dataset_id=j.source_dataset_id,
            output_dataset_id=j.output_dataset_id, output_name=j.output_name,
            method=j.method, row_count=j.row_count,
            column_overrides=j.column_overrides, status=j.status,
            error_message=j.error_message,
            created_at=j.created_at, completed_at=j.completed_at,
        )


class ModelOut(BaseModel):
    id: str
    dataset_id: str
    method: str
    status: str
    error_message: Optional[str]
    created_at: str

    @classmethod
    def from_model(cls, m: TrainedModel) -> "ModelOut":
        return cls(
            id=m.id, dataset_id=m.dataset_id, method=m.method,
            status=m.status, error_message=m.error_message, created_at=m.created_at,
        )


class CreateJobRequest(BaseModel):
    source_dataset_id: str
    output_name: str = ""
    method: str = "statistical"
    row_count: int = 1000
    column_overrides: Optional[dict] = None


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=JobOut, status_code=201)
@limiter.limit("5/minute")
def create_job(request: Request, body: CreateJobRequest):
    if not store.get_dataset(body.source_dataset_id):
        raise HTTPException(404, "Source dataset not found")
    if body.method not in ("statistical", "ctgan", "tvae"):
        raise HTTPException(400, "method must be one of: statistical, ctgan, tvae")
    if body.row_count < 1 or body.row_count > 1_000_000:
        raise HTTPException(400, "row_count must be between 1 and 1,000,000")

    job = SyntheticJob(
        source_dataset_id=body.source_dataset_id,
        output_name=body.output_name,
        method=body.method,
        row_count=body.row_count,
        column_overrides=body.column_overrides,
    )
    store.add_synthetic_job(job)
    threading.Thread(target=execute_synthetic_job, args=(job.id,), daemon=True).start()
    return JobOut.from_job(job)


@router.get("/jobs", response_model=list[JobOut])
def list_jobs():
    return [JobOut.from_job(j) for j in store.list_synthetic_jobs()]


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str):
    j = store.get_synthetic_job(job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return JobOut.from_job(j)


# ── Trained model routes ──────────────────────────────────────────────

@router.get("/models", response_model=list[ModelOut])
def list_models():
    return [ModelOut.from_model(m) for m in store.list_trained_models()]


@router.delete("/models/{model_id}", status_code=204)
def delete_model(model_id: str):
    m = store.get_trained_model(model_id)
    if not m:
        raise HTTPException(404, "Model not found")
    # Remove pkl file from disk
    path = Path(m.model_path)
    if path.exists():
        path.unlink()
    store.delete_trained_model(model_id)


@router.get("/models/status", response_model=list[ModelOut])
def models_for_dataset(dataset_id: str, method: str):
    """Check if a ready model exists for a given dataset + method."""
    m = store.find_trained_model(dataset_id, method)
    return [ModelOut.from_model(m)] if m else []
