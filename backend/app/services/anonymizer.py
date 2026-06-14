"""
Anonymizer service — applies per-column transforms and writes a new dataset.

Methods:
  keep        — unchanged
  suppress    — column dropped entirely
  redact      — every value → "[REDACTED]"
  mask        — partial reveal (email: j***@e***.com, others: first+***+last)
  hash        — SHA-256 hex
  generalize  — numeric bucketing or top-N categorical grouping
  pseudonymize— consistent fake replacement (same input → same fake output)
"""
from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any

import polars as pl

from app.models.store import store, Dataset
from app.core.config import UPLOADS_DIR
from app.services.audit_logger import log as audit_log
from app.services.storage import get_storage

# ── Transform functions ───────────────────────────────────────────────

def _redact(v: Any) -> str:
    return "[REDACTED]"


def _mask(v: Any) -> str:
    s = str(v)
    if "@" in s:
        local, domain = s.rsplit("@", 1)
        parts = domain.rsplit(".", 1)
        domain_masked = parts[0][0] + "*" * max(1, len(parts[0]) - 1)
        suffix = f".{parts[1]}" if len(parts) > 1 else ""
        return f"{s[0]}{'*' * max(1, len(local) - 1)}@{domain_masked}{suffix}"
    if len(s) <= 2:
        return "*" * len(s)
    return s[0] + "*" * (len(s) - 2) + s[-1]


def _hash_value(v: Any) -> str:
    return hashlib.sha256(str(v).encode()).hexdigest()[:16]


def _generalize_numeric(v: Any, bucket_size: int) -> str:
    try:
        n = float(v)
        low = int(n // bucket_size) * bucket_size
        return f"{low}–{low + bucket_size - 1}"
    except (TypeError, ValueError):
        return str(v)


def _generalize_categorical(v: Any, keep_values: set) -> str:
    s = str(v)
    return s if s in keep_values else "Other"


def _pseudonymize(v: Any, mapping: dict) -> str:
    key = str(v)
    if key not in mapping:
        mapping[key] = f"ID-{len(mapping) + 1:05d}"
    return mapping[key]


# ── Column transform dispatcher ───────────────────────────────────────

def _transform_series(series: pl.Series, method: str, params: dict) -> pl.Series:
    if method == "keep":
        return series
    if method == "suppress":
        return None  # caller drops the column
    if method == "redact":
        return series.map_elements(lambda v: "[REDACTED]" if v is not None else None, return_dtype=pl.Utf8)
    if method == "mask":
        return series.cast(pl.Utf8, strict=False).map_elements(
            lambda v: _mask(v) if v is not None else None, return_dtype=pl.Utf8
        )
    if method == "hash":
        return series.cast(pl.Utf8, strict=False).map_elements(
            lambda v: _hash_value(v) if v is not None else None, return_dtype=pl.Utf8
        )
    if method == "generalize":
        bucket_size = int(params.get("bucket_size", 10))
        top_n = int(params.get("top_n", 5))
        # Decide numeric vs categorical
        try:
            series.cast(pl.Float64)
            return series.cast(pl.Float64, strict=False).map_elements(
                lambda v: _generalize_numeric(v, bucket_size) if v is not None else None,
                return_dtype=pl.Utf8,
            )
        except Exception:
            str_series = series.cast(pl.Utf8, strict=False)
            counts = str_series.drop_nulls().value_counts().sort("count", descending=True)
            keep_vals = set(counts.head(top_n)[""].to_list() if "" in counts.columns else
                            counts.head(top_n)[str_series.name].to_list())
            return str_series.map_elements(
                lambda v: _generalize_categorical(v, keep_vals) if v is not None else None,
                return_dtype=pl.Utf8,
            )
    if method == "pseudonymize":
        mapping: dict = {}
        return series.cast(pl.Utf8, strict=False).map_elements(
            lambda v: _pseudonymize(v, mapping) if v is not None else None,
            return_dtype=pl.Utf8,
        )
    return series


# ── Main runner ───────────────────────────────────────────────────────

def run_anonymization_job(job_id: str) -> None:
    job = store.get_anonymization_job(job_id)
    if not job:
        return

    job.status = "running"
    store.update_anonymization_job(job)
    t0 = time.perf_counter()

    try:
        src_ds = store.get_dataset(job.source_dataset_id)
        storage = get_storage()
        if not src_ds or not storage.exists(src_ds.file_path):
            raise FileNotFoundError("Source dataset file not found")

        df = pl.read_csv(storage.local_path(src_ds.file_path), ignore_errors=True)
        job.row_count = len(df)

        col_config_map = {c["column"]: c for c in job.column_configs}
        cols_transformed = 0
        cols_to_drop = []
        new_cols: dict[str, pl.Series] = {}

        for col in df.columns:
            config = col_config_map.get(col, {"method": "keep", "params": {}})
            method = config.get("method", "keep")
            params = config.get("params", {})

            if method == "suppress":
                cols_to_drop.append(col)
                cols_transformed += 1
                continue

            transformed = _transform_series(df[col], method, params)
            if transformed is not None and method != "keep":
                new_cols[col] = transformed.rename(col)
                cols_transformed += 1

        for col, series in new_cols.items():
            df = df.with_columns(series)
        if cols_to_drop:
            df = df.drop(cols_to_drop)

        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in job.output_name)
        out_path = UPLOADS_DIR / f"{safe}_{uuid.uuid4().hex[:6]}.csv"
        df.write_csv(str(out_path))

        new_ds = Dataset(
            name=job.output_name,
            row_count=len(df),
            column_count=len(df.columns),
            size_bytes=out_path.stat().st_size,
            status="ready",
            file_path=str(out_path),
            schema=[{"name": c, "dtype": str(t), "nullable": True}
                    for c, t in zip(df.columns, df.dtypes)],
        )
        store.add_dataset(new_ds)

        job.output_dataset_id = new_ds.id
        job.rows_processed = len(df)
        job.columns_transformed = cols_transformed
        job.status = "complete"
        from datetime import datetime, timezone
        job.completed_at = datetime.now(timezone.utc).isoformat()

    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)

    job_ds = store.get_dataset(job.source_dataset_id)
    store.update_anonymization_job(job)

    audit_log(
        "compliance.anonymize", "dataset", job.source_dataset_id,
        job_ds.name if job_ds else job.source_dataset_id,
        {
            "job_id": job.id,
            "output_name": job.output_name,
            "status": job.status,
            "columns_transformed": job.columns_transformed,
            "rows_processed": job.rows_processed,
        },
        duration_ms=int((time.perf_counter() - t0) * 1000),
    )
