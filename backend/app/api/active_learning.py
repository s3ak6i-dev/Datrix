"""
Active learning API.
POST /al/sessions                      — create session + get initial batch
GET  /al/sessions                      — list all sessions
GET  /al/sessions/{id}                 — get session detail
GET  /al/sessions/{id}/batch           — get current batch rows (with confidence scores)
POST /al/sessions/{id}/labels          — submit labels and trigger training
POST /al/sessions/{id}/stop            — mark complete
PATCH /al/sessions/{id}/model-name     — rename the exported model
GET  /al/sessions/{id}/export          — download trained model .pkl
POST /al/sessions/{id}/predict         — run model on full dataset → new dataset
GET  /al/sessions/{id}/export-labels   — download labeled rows as CSV
DELETE /al/sessions/{id}               — delete session
"""
from __future__ import annotations

import io
import csv
import threading
from pathlib import Path
from typing import Optional, Any

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from app.core.limiter import limiter
from pydantic import BaseModel, Field

from app.models.store import store, ALSession, Dataset
from app.services.active_learning_executor import get_initial_batch, train_and_get_next_batch
from app.core.config import DATA_DIR, UPLOADS_DIR

router = APIRouter(prefix="/al", tags=["active-learning"])


# ── Pydantic schemas ──────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    name: str = Field("", max_length=200)
    dataset_id: str = Field(..., max_length=100)
    target_column: str = Field(..., min_length=1, max_length=200)
    task_type: str = "classification"
    model_type: str = "random_forest"
    sampling_strategy: str = "entropy"
    batch_size: int = 20
    label_classes: list[str] = Field([], max_length=100)
    exclude_columns: list[str] = Field([], max_length=100)
    target_accuracy: Optional[float] = Field(None, gt=0.0, le=1.0)
    max_rounds: int = Field(10, ge=1, le=100)
    model_name: str = Field("", max_length=200)


class SubmitLabelsRequest(BaseModel):
    labels: dict[str, Any]


class RenameModelRequest(BaseModel):
    model_name: str = Field(..., min_length=1, max_length=200)


class SessionOut(BaseModel):
    id: str
    name: str
    dataset_id: str
    target_column: str
    task_type: str
    model_type: str
    sampling_strategy: str
    batch_size: int
    label_classes: list
    exclude_columns: list
    target_accuracy: Optional[float]
    max_rounds: int
    model_name: str
    status: str
    current_round: int
    labeled_count: int
    next_batch: list
    rounds: list
    model_path: Optional[str]
    created_at: str
    updated_at: str

    @classmethod
    def from_session(cls, s: ALSession) -> "SessionOut":
        return cls(
            id=s.id, name=s.name, dataset_id=s.dataset_id,
            target_column=s.target_column, task_type=s.task_type,
            model_type=s.model_type, sampling_strategy=s.sampling_strategy,
            batch_size=s.batch_size, label_classes=s.label_classes,
            exclude_columns=s.exclude_columns, target_accuracy=s.target_accuracy,
            max_rounds=s.max_rounds, model_name=getattr(s, 'model_name', ''),
            status=s.status, current_round=s.current_round,
            labeled_count=len(s.labels), next_batch=s.next_batch,
            rounds=s.rounds, model_path=s.model_path,
            created_at=s.created_at, updated_at=s.updated_at,
        )


class BatchRow(BaseModel):
    row_index: int
    data: dict[str, Any]
    confidence: Optional[float] = None


class BatchOut(BaseModel):
    session_id: str
    round: int
    batch: list[BatchRow]
    total_labeled: int
    status: str


class PredictOut(BaseModel):
    dataset_id: str
    dataset_name: str
    row_count: int


# ── Helpers ───────────────────────────────────────────────────────────

def _load_model(model_path: str):
    import joblib
    return joblib.load(model_path)


def _clean_row(row_data: dict) -> dict:
    clean = {}
    for k, v in row_data.items():
        if hasattr(v, "item"):
            clean[k] = v.item()
        elif v != v:
            clean[k] = None
        else:
            clean[k] = v
    return clean


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionOut, status_code=201)
@limiter.limit("5/minute")
def create_session(request: Request, body: CreateSessionRequest):
    ds = store.get_dataset(body.dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if body.task_type not in ("classification", "regression"):
        raise HTTPException(400, "task_type must be classification or regression")
    if body.model_type not in ("logistic_regression", "random_forest", "xgboost", "svm", "mlp"):
        raise HTTPException(400, "Invalid model_type")
    if body.sampling_strategy not in ("random", "least_confidence", "margin", "entropy", "coreset", "committee"):
        raise HTTPException(400, "Invalid sampling_strategy")
    if body.batch_size not in (20, 30, 50, 100):
        raise HTTPException(400, "batch_size must be 20, 30, 50, or 100")

    label_classes = body.label_classes
    if body.task_type == "classification" and not label_classes:
        try:
            import polars as pl
            df = pl.read_csv(ds.file_path)
            if body.target_column in df.columns:
                unique_vals = df[body.target_column].drop_nulls().unique().to_list()
                if len(unique_vals) <= 30:
                    label_classes = sorted([str(v) for v in unique_vals])
        except Exception:
            pass

    model_name = body.model_name or body.name or f"{ds.name}_{body.target_column}_model"

    session = ALSession(
        name=body.name,
        dataset_id=body.dataset_id,
        target_column=body.target_column,
        task_type=body.task_type,
        model_type=body.model_type,
        sampling_strategy=body.sampling_strategy,
        batch_size=body.batch_size,
        label_classes=label_classes,
        exclude_columns=body.exclude_columns,
        target_accuracy=body.target_accuracy,
        max_rounds=body.max_rounds,
        model_name=model_name,
    )
    store.add_al_session(session)
    get_initial_batch(session.id)
    session = store.get_al_session(session.id)
    return SessionOut.from_session(session)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions():
    return [SessionOut.from_session(s) for s in store.list_al_sessions()]


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: str):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return SessionOut.from_session(s)


@router.get("/sessions/{session_id}/batch", response_model=BatchOut)
def get_batch(session_id: str):
    import polars as pl
    import numpy as np

    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    ds = store.get_dataset(s.dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    df = pl.read_csv(ds.file_path)

    rows = []
    for idx in s.next_batch:
        if 0 <= idx < len(df):
            rows.append(BatchRow(row_index=idx, data=_clean_row(df.row(idx, named=True))))

    # Confidence scores from trained model
    if s.model_path and Path(s.model_path).exists() and rows:
        try:
            artifact = _load_model(s.model_path)
            pipeline = artifact["pipeline"]
            feature_cols = artifact["feature_cols"]
            exclude = set(s.exclude_columns) | {s.target_column}
            valid_cols = [c for c in feature_cols if c in df.columns and c not in exclude]
            indices = [r.row_index for r in rows]
            X = df[indices].select(valid_cols).to_pandas()
            if hasattr(pipeline, "predict_proba"):
                probs = pipeline.predict_proba(X)
                confs = np.max(probs, axis=1).tolist()
                for i, row in enumerate(rows):
                    row.confidence = round(confs[i], 4)
        except Exception:
            pass

    return BatchOut(
        session_id=s.id,
        round=s.current_round,
        batch=rows,
        total_labeled=len(s.labels),
        status=s.status,
    )


@router.post("/sessions/{session_id}/labels", response_model=SessionOut)
def submit_labels(session_id: str, body: SubmitLabelsRequest):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if s.status == "training":
        raise HTTPException(409, "Training in progress — wait for it to complete")
    if s.status == "complete":
        raise HTTPException(409, "Session is complete")

    for k, v in body.labels.items():
        s.labels[str(k)] = v

    store.update_al_session(s)
    s.status = "training"
    store.update_al_session(s)
    threading.Thread(target=train_and_get_next_batch, args=(session_id,), daemon=True).start()

    s = store.get_al_session(session_id)
    return SessionOut.from_session(s)


@router.post("/sessions/{session_id}/stop", response_model=SessionOut)
def stop_session(session_id: str):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    s.status = "complete"
    store.update_al_session(s)
    return SessionOut.from_session(s)


@router.patch("/sessions/{session_id}/model-name", response_model=SessionOut)
def rename_model(session_id: str, body: RenameModelRequest):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if not body.model_name.strip():
        raise HTTPException(400, "model_name cannot be empty")
    s.model_name = body.model_name.strip()
    store.update_al_session(s)
    return SessionOut.from_session(s)


@router.get("/sessions/{session_id}/export")
def export_model(session_id: str):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if not s.model_path:
        raise HTTPException(400, "No trained model yet")
    path = Path(s.model_path)
    if not path.exists():
        raise HTTPException(404, "Model file not found on disk")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (s.model_name or s.name or session_id))
    return FileResponse(path=str(path), media_type="application/octet-stream", filename=f"{safe_name}.pkl")


@router.post("/sessions/{session_id}/predict", response_model=PredictOut)
def predict_full_dataset(session_id: str):
    import polars as pl
    from datetime import datetime, timezone

    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if not s.model_path or not Path(s.model_path).exists():
        raise HTTPException(400, "No trained model available — complete at least one round first")

    ds = store.get_dataset(s.dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    df = pl.read_csv(ds.file_path)

    artifact = _load_model(s.model_path)
    pipeline = artifact["pipeline"]
    feature_cols = artifact["feature_cols"]
    le = artifact.get("label_encoder")

    exclude = set(s.exclude_columns) | {s.target_column}
    valid_cols = [c for c in feature_cols if c in df.columns and c not in exclude]

    X_all = df.select(valid_cols).to_pandas()

    raw_preds = pipeline.predict(X_all)
    if le is not None:
        preds = le.inverse_transform(raw_preds)
    else:
        preds = raw_preds

    # Confidence scores
    confidences = None
    if hasattr(pipeline, "predict_proba"):
        try:
            import numpy as np
            probs = pipeline.predict_proba(X_all)
            confidences = (np.max(probs, axis=1) * 100).round(1).tolist()
        except Exception:
            pass

    # Build output dataframe
    out_df = df.with_columns(pl.Series("predicted_label", [str(p) for p in preds]))
    if confidences:
        out_df = out_df.with_columns(pl.Series("prediction_confidence_pct", confidences))

    # Save as new CSV
    src_name = ds.name.replace(".csv", "")
    model_label = s.model_name or s.name or "model"
    out_name = f"{src_name}_predicted_{model_label}.csv"
    out_path = UPLOADS_DIR / out_name
    out_df.write_csv(str(out_path))

    new_ds = Dataset(
        name=out_name,
        row_count=len(out_df),
        column_count=len(out_df.columns),
        size_bytes=out_path.stat().st_size,
        status="ready",
        file_path=str(out_path),
        schema=[{"name": c, "dtype": str(t), "nullable": True} for c, t in zip(out_df.columns, out_df.dtypes)],
    )
    store.add_dataset(new_ds)

    return PredictOut(dataset_id=new_ds.id, dataset_name=out_name, row_count=len(out_df))


@router.get("/sessions/{session_id}/export-labels")
def export_labels(session_id: str):
    import polars as pl

    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if not s.labels:
        raise HTTPException(400, "No labels yet")

    ds = store.get_dataset(s.dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    df = pl.read_csv(ds.file_path)

    labeled_indices = sorted([int(k) for k in s.labels.keys()])
    rows = []
    for idx in labeled_indices:
        if 0 <= idx < len(df):
            row = _clean_row(df.row(idx, named=True))
            row["assigned_label"] = s.labels[str(idx)]
            rows.append(row)

    if not rows:
        raise HTTPException(400, "No valid labeled rows found")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (s.name or session_id))
    filename = f"{safe_name}_labels.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str):
    s = store.get_al_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    store.delete_al_session(session_id)
