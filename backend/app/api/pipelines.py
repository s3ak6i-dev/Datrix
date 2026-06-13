"""
Pipelines API — Phase 2.
CRUD for pipelines + async run execution (dry and full).
"""
from __future__ import annotations
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.config import DATA_DIR
from app.models.store import store, Pipeline, PipelineRun
from app.services.pipeline_executor import run_pipeline, save_output
from app.services.storage import get_storage

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

PIPELINE_OUTPUTS_DIR = DATA_DIR / "pipeline_outputs"


# ── Pydantic models ───────────────────────────────────────────────────

class PipelineOut(BaseModel):
    id: str
    name: str
    description: str
    dataset_id: Optional[str]
    steps: list
    status: str
    node_positions: Optional[dict]
    created_at: str
    updated_at: str

    @classmethod
    def from_pipeline(cls, p: Pipeline) -> "PipelineOut":
        return cls(
            id=p.id, name=p.name, description=p.description,
            dataset_id=p.dataset_id, steps=p.steps, status=p.status,
            node_positions=p.node_positions,
            created_at=p.created_at, updated_at=p.updated_at,
        )


class RunOut(BaseModel):
    id: str
    pipeline_id: str
    dataset_id: str
    status: str
    is_dry_run: bool
    step_results: list
    output_path: Optional[str]
    output_format: str
    rows_in: Optional[int]
    rows_out: Optional[int]
    cols_in: Optional[int]
    cols_out: Optional[int]
    error_message: Optional[str]
    output_preview: Optional[list]
    created_at: str
    completed_at: Optional[str]

    @classmethod
    def from_run(cls, r: PipelineRun) -> "RunOut":
        return cls(
            id=r.id, pipeline_id=r.pipeline_id, dataset_id=r.dataset_id,
            status=r.status, is_dry_run=r.is_dry_run, step_results=r.step_results,
            output_path=r.output_path, output_format=r.output_format,
            rows_in=r.rows_in, rows_out=r.rows_out,
            cols_in=r.cols_in, cols_out=r.cols_out,
            error_message=r.error_message, output_preview=r.output_preview,
            created_at=r.created_at, completed_at=r.completed_at,
        )


class CreatePipelineRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    dataset_id: Optional[str] = None


class UpdatePipelineRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    dataset_id: Optional[str] = None
    steps: Optional[list] = None
    node_positions: Optional[dict] = None


class RunRequest(BaseModel):
    dry_run: bool = True
    output_format: str = Field("csv", max_length=20)


# ── Background execution ──────────────────────────────────────────────

def _execute_run(run_id: str) -> None:
    run = store.get_pipeline_run(run_id)
    if not run:
        return
    p = store.get_pipeline(run.pipeline_id)
    ds = store.get_dataset(run.dataset_id)
    if not p or not ds:
        run.status = "failed"
        run.error_message = "Pipeline or dataset not found"
        run.completed_at = datetime.now(timezone.utc).isoformat()
        store.update_pipeline_run(run)
        return

    try:
        run.status = "running"
        store.update_pipeline_run(run)

        result_df, step_results = run_pipeline(p.steps, str(get_storage().local_path(ds.file_path)), run.is_dry_run)

        run.step_results = step_results
        run.rows_in = step_results[0]["rows_in"] if step_results else 0
        run.rows_out = step_results[-1]["rows_out"] if step_results else run.rows_in
        run.cols_in = step_results[0]["cols_in"] if step_results else 0
        run.cols_out = step_results[-1]["cols_out"] if step_results else run.cols_in

        if run.is_dry_run:
            run.output_preview = result_df.head(10).to_dicts()
        else:
            ext = run.output_format
            out_path = PIPELINE_OUTPUTS_DIR / f"run_{run.id}.{ext}"
            save_output(result_df, out_path, ext)
            run.output_path = str(out_path)

        run.status = "complete"
        run.completed_at = datetime.now(timezone.utc).isoformat()
        store.update_pipeline_run(run)

    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        run.completed_at = datetime.now(timezone.utc).isoformat()
        store.update_pipeline_run(run)


# ── Routes ────────────────────────────────────────────────────────────

@router.get("", response_model=list[PipelineOut])
def list_pipelines():
    return [PipelineOut.from_pipeline(p) for p in store.list_pipelines()]


@router.post("", response_model=PipelineOut, status_code=201)
def create_pipeline(body: CreatePipelineRequest):
    p = Pipeline(name=body.name, description=body.description, dataset_id=body.dataset_id)
    store.add_pipeline(p)
    return PipelineOut.from_pipeline(p)


@router.get("/{pipeline_id}", response_model=PipelineOut)
def get_pipeline(pipeline_id: str):
    p = store.get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(404, "Pipeline not found")
    return PipelineOut.from_pipeline(p)


@router.put("/{pipeline_id}", response_model=PipelineOut)
def update_pipeline(pipeline_id: str, body: UpdatePipelineRequest):
    p = store.get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(404, "Pipeline not found")
    if body.name is not None:
        p.name = body.name
    if body.description is not None:
        p.description = body.description
    if body.dataset_id is not None:
        p.dataset_id = body.dataset_id
    if body.steps is not None:
        p.steps = body.steps
    if body.node_positions is not None:
        p.node_positions = body.node_positions
    store.update_pipeline(p)
    return PipelineOut.from_pipeline(p)


@router.delete("/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: str):
    if not store.get_pipeline(pipeline_id):
        raise HTTPException(404, "Pipeline not found")
    store.delete_pipeline(pipeline_id)


@router.post("/{pipeline_id}/run", response_model=RunOut, status_code=201)
def run_pipeline_endpoint(pipeline_id: str, body: RunRequest):
    p = store.get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(404, "Pipeline not found")
    if not p.dataset_id:
        raise HTTPException(400, "Pipeline has no source dataset — set one before running")
    if not store.get_dataset(p.dataset_id):
        raise HTTPException(404, "Source dataset not found")

    run = PipelineRun(
        pipeline_id=pipeline_id,
        dataset_id=p.dataset_id,
        is_dry_run=body.dry_run,
        output_format=body.output_format,
    )
    store.add_pipeline_run(run)
    threading.Thread(target=_execute_run, args=(run.id,), daemon=True).start()
    return RunOut.from_run(run)


@router.get("/{pipeline_id}/runs", response_model=list[RunOut])
def list_runs(pipeline_id: str):
    if not store.get_pipeline(pipeline_id):
        raise HTTPException(404, "Pipeline not found")
    return [RunOut.from_run(r) for r in store.list_pipeline_runs(pipeline_id)]


@router.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: str):
    r = store.get_pipeline_run(run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    return RunOut.from_run(r)


@router.get("/runs/{run_id}/download")
def download_run_output(run_id: str):
    r = store.get_pipeline_run(run_id)
    if not r or not r.output_path:
        raise HTTPException(404, "Output not available")
    path = Path(r.output_path)
    if not path.exists():
        raise HTTPException(404, "Output file not found")
    ext = r.output_format
    media = "text/csv" if ext == "csv" else "application/octet-stream"
    return FileResponse(str(path), filename=f"pipeline_output_{run_id[:8]}.{ext}", media_type=media)
