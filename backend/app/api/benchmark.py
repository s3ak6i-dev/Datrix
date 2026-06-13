"""
Benchmark API.
POST   /benchmark/jobs            — create + queue job
GET    /benchmark/jobs            — list all jobs
GET    /benchmark/jobs/{id}       — get job (poll while running)
DELETE /benchmark/jobs/{id}       — delete
GET    /benchmark/jobs/{id}/export — download CSV report
"""
from __future__ import annotations

import csv
import io
import threading
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.core.limiter import limiter
from pydantic import BaseModel, Field

from app.models.store import store, BenchmarkJob
from app.services.benchmark_executor import run_benchmark

router = APIRouter(prefix="/benchmark", tags=["benchmark"])

VALID_MODELS    = {"logistic_regression", "random_forest", "xgboost", "svm", "mlp"}
VALID_PRESETS   = {"default", "tuned", "grid_search"}
VALID_PROTOCOLS = {"kfold_5", "kfold_10", "holdout_80", "holdout_90"}
VALID_TASKS     = {"classification", "regression"}


# ── Pydantic schemas ──────────────────────────────────────────────────

class CandidateIn(BaseModel):
    label: str = Field("", max_length=200)
    model_type: str = "random_forest"
    preset: str = "default"
    dataset_id: Optional[str] = None
    al_session_id: Optional[str] = None
    exclude_columns: list[str] = Field([], max_length=100)


class CreateJobRequest(BaseModel):
    name: str = Field("", max_length=200)
    dataset_id: str = Field(..., max_length=100)
    target_column: str = Field(..., min_length=1, max_length=200)
    task_type: str = "classification"
    eval_protocol: str = "kfold_5"
    candidates: list[CandidateIn] = Field(..., min_length=1, max_length=20)


class CandidateOut(BaseModel):
    id: str
    label: str
    model_type: str
    preset: str
    dataset_id: Optional[str]
    al_session_id: Optional[str]
    exclude_columns: list

class CandidateResultOut(BaseModel):
    candidate_id: str
    status: str
    metrics: dict
    confusion_matrix: Optional[list]
    feature_importances: list
    learning_curve: list
    training_time_ms: int
    error_message: Optional[str]
    label_classes: list


class JobOut(BaseModel):
    id: str
    name: str
    dataset_id: str
    target_column: str
    task_type: str
    eval_protocol: str
    candidates: list[CandidateOut]
    status: str
    results: list[CandidateResultOut]
    winner_candidate_id: Optional[str]
    error_message: Optional[str]
    created_at: str
    completed_at: Optional[str]

    @classmethod
    def from_job(cls, j: BenchmarkJob) -> "JobOut":
        candidates = [
            CandidateOut(
                id=c['id'], label=c.get('label', ''),
                model_type=c.get('model_type', 'random_forest'),
                preset=c.get('preset', 'default'),
                dataset_id=c.get('dataset_id'),
                al_session_id=c.get('al_session_id'),
                exclude_columns=c.get('exclude_columns', []),
            )
            for c in j.candidates
        ]
        results = [
            CandidateResultOut(
                candidate_id=r.get('candidate_id', ''),
                status=r.get('status', 'pending'),
                metrics=r.get('metrics', {}),
                confusion_matrix=r.get('confusion_matrix'),
                feature_importances=r.get('feature_importances', []),
                learning_curve=r.get('learning_curve', []),
                training_time_ms=r.get('training_time_ms', 0),
                error_message=r.get('error_message'),
                label_classes=r.get('label_classes', []),
            )
            for r in j.results
        ]
        return cls(
            id=j.id, name=j.name, dataset_id=j.dataset_id,
            target_column=j.target_column, task_type=j.task_type,
            eval_protocol=j.eval_protocol, candidates=candidates,
            status=j.status, results=results,
            winner_candidate_id=j.winner_candidate_id,
            error_message=j.error_message,
            created_at=j.created_at, completed_at=j.completed_at,
        )


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=JobOut, status_code=201)
@limiter.limit("5/minute")
def create_job(request: Request, body: CreateJobRequest):
    if not store.get_dataset(body.dataset_id):
        raise HTTPException(404, "Dataset not found")
    if body.task_type not in VALID_TASKS:
        raise HTTPException(400, f"task_type must be one of {VALID_TASKS}")
    if body.eval_protocol not in VALID_PROTOCOLS:
        raise HTTPException(400, f"eval_protocol must be one of {VALID_PROTOCOLS}")
    for c in body.candidates:
        if c.model_type not in VALID_MODELS:
            raise HTTPException(400, f"Invalid model_type: {c.model_type}")
        if c.preset not in VALID_PRESETS:
            raise HTTPException(400, f"Invalid preset: {c.preset}")
        if c.dataset_id and not store.get_dataset(c.dataset_id):
            raise HTTPException(404, f"Override dataset not found: {c.dataset_id}")
        if c.al_session_id and not store.get_al_session(c.al_session_id):
            raise HTTPException(404, f"AL session not found: {c.al_session_id}")

    # Auto-generate labels if blank
    MODEL_LABELS = {
        'logistic_regression': 'Logistic Regression',
        'random_forest': 'Random Forest',
        'xgboost': 'XGBoost',
        'svm': 'SVM',
        'mlp': 'Neural Net (MLP)',
    }
    PRESET_LABELS = {'default': '', 'tuned': ' (Tuned)', 'grid_search': ' (Grid Search)'}

    candidates = []
    seen_labels: dict[str, int] = {}
    for c in body.candidates:
        label = c.label.strip()
        if not label:
            base = MODEL_LABELS.get(c.model_type, c.model_type) + PRESET_LABELS.get(c.preset, '')
            n = seen_labels.get(base, 0)
            seen_labels[base] = n + 1
            label = base if n == 0 else f"{base} #{n + 1}"

        ds_label = ''
        if c.dataset_id and c.dataset_id != body.dataset_id:
            ds = store.get_dataset(c.dataset_id)
            ds_label = f' [{ds.name}]' if ds else ''
        elif c.al_session_id:
            sess = store.get_al_session(c.al_session_id)
            ds_label = f' [AL: {sess.name or sess.id[:8]}]' if sess else ''
        if ds_label:
            label += ds_label

        candidates.append({
            'id': str(uuid.uuid4()),
            'label': label,
            'model_type': c.model_type,
            'preset': c.preset,
            'dataset_id': c.dataset_id,
            'al_session_id': c.al_session_id,
            'exclude_columns': c.exclude_columns,
        })

    ds = store.get_dataset(body.dataset_id)
    job_name = body.name or f"{ds.name} — {body.target_column} benchmark"

    job = BenchmarkJob(
        name=job_name,
        dataset_id=body.dataset_id,
        target_column=body.target_column,
        task_type=body.task_type,
        eval_protocol=body.eval_protocol,
        candidates=candidates,
    )
    store.add_benchmark_job(job)

    threading.Thread(target=run_benchmark, args=(job.id,), daemon=True).start()
    return JobOut.from_job(store.get_benchmark_job(job.id))


@router.get("/jobs", response_model=list[JobOut])
def list_jobs():
    return [JobOut.from_job(j) for j in store.list_benchmark_jobs()]


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str):
    j = store.get_benchmark_job(job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return JobOut.from_job(j)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    if not store.get_benchmark_job(job_id):
        raise HTTPException(404, "Job not found")
    store.delete_benchmark_job(job_id)


@router.get("/jobs/{job_id}/export")
def export_report(job_id: str):
    j = store.get_benchmark_job(job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    if j.status != 'complete':
        raise HTTPException(400, "Job is not complete yet")

    cand_map = {c['id']: c for c in j.candidates}

    rows = []
    for r in j.results:
        cid = r.get('candidate_id', '')
        c   = cand_map.get(cid, {})
        m   = r.get('metrics', {})
        row = {
            'candidate_label': c.get('label', cid),
            'model_type':      c.get('model_type', ''),
            'preset':          c.get('preset', ''),
            'status':          r.get('status', ''),
            'training_time_ms': r.get('training_time_ms', 0),
            'is_winner':       'yes' if cid == j.winner_candidate_id else '',
        }
        row.update(m)
        rows.append(row)

    if not rows:
        raise HTTPException(400, "No results to export")

    fieldnames = list(rows[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)

    safe = "".join(c if c.isalnum() or c in '-_' else '_' for c in (j.name or job_id))
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename={safe}_benchmark.csv'},
    )
