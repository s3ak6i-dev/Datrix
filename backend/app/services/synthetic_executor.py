"""
Synthetic data generation executor.

Model persistence strategy:
  - One trained model is stored per (dataset_id, method) pair.
  - On job run: if a ready model exists on disk, load it (fast).
    Otherwise train from scratch, save to disk, record in store.
  - Deleting a TrainedModel record (via API) forces a retrain next time.
  - Statistical (GaussianCopula) models persist too — fit is fast but
    keeping them avoids re-reading the source file on every job.

Fallback: if SDV is not installed, bootstrap-sample from source rows.
"""
from __future__ import annotations
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import polars as pl

from app.core.config import DATA_DIR
from app.models.store import store, Dataset, SyntheticJob, TrainedModel
from app.services.ingestion import infer_schema
from app.services.storage import get_storage

SYNTHETIC_DIR = DATA_DIR / "synthetic_outputs"
MODELS_DIR = DATA_DIR / "trained_models"

DIST_MAP = {
    "normal":     "norm",
    "log_normal": "gamma",
    "uniform":    "uniform",
    "beta":       "beta",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _model_path(dataset_id: str, method: str) -> Path:
    return MODELS_DIR / f"{dataset_id}_{method}.pkl"


# ── Override application ──────────────────────────────────────────────

def _apply_null_rate(df: pl.DataFrame, col: str, rate: float) -> pl.DataFrame:
    if rate <= 0 or col not in df.columns:
        return df
    import numpy as np
    mask = (np.random.random(len(df)) < rate).tolist()
    df = df.with_columns(pl.Series("__nm__", mask))
    df = df.with_columns(
        pl.when(pl.col("__nm__"))
        .then(pl.lit(None).cast(df[col].dtype))
        .otherwise(pl.col(col))
        .alias(col)
    )
    return df.drop("__nm__")


def _apply_class_weights(df: pl.DataFrame, col: str, weights: dict) -> pl.DataFrame:
    if col not in df.columns or not weights:
        return df
    total = sum(float(v) for v in weights.values())
    if total <= 0:
        return df
    cats = list(weights.keys())
    probs = [float(weights[c]) / total for c in cats]
    new_vals = random.choices(cats, weights=probs, k=len(df))
    try:
        return df.with_columns(pl.Series(col, new_vals).cast(df[col].dtype))
    except Exception:
        return df.with_columns(pl.Series(col, new_vals))


def _apply_overrides(df: pl.DataFrame, overrides: dict) -> pl.DataFrame:
    for col, opts in (overrides or {}).items():
        if col not in df.columns:
            continue
        dtype = df[col].dtype
        is_numeric = dtype in (
            pl.Float32, pl.Float64,
            pl.Int8, pl.Int16, pl.Int32, pl.Int64,
            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        )
        if is_numeric:
            if opts.get("min") is not None:
                df = df.with_columns(pl.col(col).clip(lower_bound=float(opts["min"])))
            if opts.get("max") is not None:
                df = df.with_columns(pl.col(col).clip(upper_bound=float(opts["max"])))
        if opts.get("class_weights"):
            df = _apply_class_weights(df, col, opts["class_weights"])
        null_rate = float(opts.get("null_rate", 0))
        if null_rate > 0:
            df = _apply_null_rate(df, col, null_rate)
    return df


# ── Fallback sampler ──────────────────────────────────────────────────

def _bootstrap_sample(df: pl.DataFrame, n: int) -> pl.DataFrame:
    indices = [random.randint(0, len(df) - 1) for _ in range(n)]
    return df[indices]


# ── Model build/load ──────────────────────────────────────────────────

def _build_synthesizer(method: str, metadata, num_dists: dict):
    from sdv.single_table import (
        GaussianCopulaSynthesizer,
        CTGANSynthesizer,
        TVAESynthesizer,
    )
    if method == "statistical":
        return GaussianCopulaSynthesizer(
            metadata,
            numerical_distributions=num_dists or None,
        )
    if method == "ctgan":
        return CTGANSynthesizer(metadata, epochs=100, verbose=False)
    return TVAESynthesizer(metadata, epochs=100)


def _load_synthesizer(method: str, path: Path):
    from sdv.single_table import (
        GaussianCopulaSynthesizer,
        CTGANSynthesizer,
        TVAESynthesizer,
    )
    cls = {
        "statistical": GaussianCopulaSynthesizer,
        "ctgan":       CTGANSynthesizer,
        "tvae":        TVAESynthesizer,
    }[method]
    return cls.load(str(path))


# ── Main executor ─────────────────────────────────────────────────────

def execute_synthetic_job(job_id: str) -> None:
    job = store.get_synthetic_job(job_id)
    if not job:
        return

    source_ds = store.get_dataset(job.source_dataset_id)
    if not source_ds:
        job.status = "failed"
        job.error_message = "Source dataset not found"
        job.completed_at = _now()
        store.update_synthetic_job(job)
        return

    try:
        job.status = "running"
        store.update_synthetic_job(job)

        df_source = pl.read_csv(
            get_storage().local_path(source_ds.file_path), infer_schema_length=10000, ignore_errors=True
        )

        try:
            from sdv.metadata import SingleTableMetadata

            pd_df = df_source.to_pandas()
            metadata = SingleTableMetadata()
            metadata.detect_from_dataframe(pd_df)

            num_dists: dict[str, str] = {}
            for col, opts in (job.column_overrides or {}).items():
                dist = opts.get("distribution", "auto")
                if dist and dist != "auto":
                    mapped = DIST_MAP.get(dist)
                    if mapped:
                        num_dists[col] = mapped

            # Check for a cached model
            existing = store.find_trained_model(job.source_dataset_id, job.method)
            cached_path = _model_path(job.source_dataset_id, job.method)

            if existing and cached_path.exists():
                # Fast path: load from disk
                synth = _load_synthesizer(job.method, cached_path)
            else:
                # Slow path: train, then persist
                tm = TrainedModel(
                    dataset_id=job.source_dataset_id,
                    method=job.method,
                    model_path=str(cached_path),
                    status="training",
                )
                store.add_trained_model(tm)

                synth = _build_synthesizer(job.method, metadata, num_dists)
                synth.fit(pd_df)

                MODELS_DIR.mkdir(parents=True, exist_ok=True)
                synth.save(str(cached_path))

                tm.status = "ready"
                store.update_trained_model(tm)

            out_pd = synth.sample(num_rows=job.row_count)
            synthetic_df = pl.from_pandas(out_pd)

        except ImportError:
            synthetic_df = _bootstrap_sample(df_source, job.row_count)

        synthetic_df = _apply_overrides(synthetic_df, job.column_overrides or {})

        SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
        out_path = SYNTHETIC_DIR / f"synthetic_{job.id}.csv"
        synthetic_df.write_csv(str(out_path))

        out_ds = Dataset(
            name=job.output_name or f"{source_ds.name} (synthetic)",
            status="ready",
            file_path=str(out_path),
            row_count=len(synthetic_df),
            column_count=len(synthetic_df.columns),
            size_bytes=out_path.stat().st_size,
            schema=infer_schema(synthetic_df),
        )
        store.add_dataset(out_ds)

        job.output_dataset_id = out_ds.id
        job.status = "complete"
        job.completed_at = _now()
        store.update_synthetic_job(job)

    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = _now()
        store.update_synthetic_job(job)
