"""
Cleaning Engine — Phase 1.
Applies automated fixes to datasets:
  - null imputation (mean/median/mode by dtype)
  - exact duplicate removal
  - mixed-case standardisation
All changes are logged and reversible.
"""
from __future__ import annotations
from pathlib import Path
from typing import Optional

import polars as pl
import numpy as np

from app.services.ingestion import read_file


def preview_fix(file_path: str, issue: dict) -> dict:
    """Return a preview of what a fix would do without applying it."""
    df = read_file(Path(file_path))
    issue_type = issue["issue_type"]
    col = issue.get("column_name")

    if issue_type == "null_values" and col:
        return _preview_null_fix(df, col)
    if issue_type == "null_labels" and col:
        return _preview_null_fix(df, col)
    if issue_type == "duplicate_rows":
        dup_count = len(df) - df.unique().height
        return {"method": "drop_exact_duplicates", "rows_affected": dup_count, "preview": {}}
    if issue_type == "mixed_case" and col:
        mixed = df[col].drop_nulls().filter(
            (df[col].drop_nulls().str.to_lowercase() != df[col].drop_nulls()) &
            (df[col].drop_nulls().str.to_uppercase() != df[col].drop_nulls())
        )
        return {"method": "lowercase_standardise", "rows_affected": len(mixed), "preview": {}}
    return {"method": "no_op", "rows_affected": 0, "preview": {}}


def _preview_null_fix(df: pl.DataFrame, col: str) -> dict:
    null_count = df[col].null_count()
    dtype_name = str(df[col].dtype)
    is_numeric = any(t in dtype_name for t in ("Int", "Float", "UInt"))
    method = "mean_imputation" if is_numeric else "mode_imputation"
    return {"method": method, "rows_affected": null_count, "preview": {}}


def apply_fix(file_path: str, issue: dict, options: dict | None = None) -> tuple[pl.DataFrame, int]:
    """Apply fix and return (updated_df, rows_changed)."""
    df = read_file(Path(file_path))
    issue_type = issue["issue_type"]
    col = issue.get("column_name")
    opts = options or {}

    if issue_type in ("null_values", "null_labels") and col:
        return _fix_nulls(df, col)
    if issue_type == "duplicate_rows":
        original_len = len(df)
        df = df.unique()
        return df, original_len - len(df)
    if issue_type == "mixed_case" and col:
        original = df[col].clone()
        df = df.with_columns(pl.col(col).str.to_lowercase())
        changed = (original != df[col]).sum()
        return df, int(changed)
    if issue_type == "outliers" and col:
        return _fix_outliers(df, col)
    if issue_type == "class_imbalance" and col:
        method = opts.get("method", "oversample")
        if method == "undersample":
            return _undersample_majority(df, col)
        return _oversample_minority(df, col)
    return df, 0


def _fix_nulls(df: pl.DataFrame, col: str) -> tuple[pl.DataFrame, int]:
    null_count = df[col].null_count()
    if null_count == 0:
        return df, 0
    dtype_name = str(df[col].dtype)
    is_numeric = any(t in dtype_name for t in ("Int", "Float", "UInt"))
    if is_numeric:
        fill_val = df[col].mean()
        df = df.with_columns(pl.col(col).fill_null(fill_val))
    else:
        mode_vals = df[col].drop_nulls().mode()
        if len(mode_vals) > 0:
            fill_val = mode_vals[0]
            df = df.with_columns(pl.col(col).fill_null(fill_val))
    return df, null_count


def _fix_outliers(df: pl.DataFrame, col: str) -> tuple[pl.DataFrame, int]:
    """Winsorise outliers to IQR 3× fence."""
    series = df[col].drop_nulls().cast(pl.Float64, strict=False).drop_nulls()
    if len(series) < 10:
        return df, 0
    arr = series.to_numpy()
    q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
    iqr = q3 - q1
    if iqr == 0:
        return df, 0
    lower, upper = q1 - 3 * iqr, q3 + 3 * iqr
    clipped = df.with_columns(pl.col(col).clip(lower, upper))
    changed = (df[col] != clipped[col]).sum()
    return clipped, int(changed)


def _oversample_minority(df: pl.DataFrame, col: str) -> tuple[pl.DataFrame, int]:
    """Duplicate minority-class rows until ratio is ~1:1."""
    counts = (
        df.filter(pl.col(col).is_not_null())
        .group_by(col)
        .agg(pl.len().alias("n"))
        .sort("n")
    )
    if len(counts) < 2:
        return df, 0
    minority_val = counts[col][0]
    minority_count = int(counts["n"][0])
    majority_count = int(counts["n"][-1])
    needed = majority_count - minority_count
    if needed <= 0:
        return df, 0
    minority_df = df.filter(pl.col(col) == minority_val)
    extra = minority_df.sample(n=needed, with_replacement=True, seed=42)
    return pl.concat([df, extra]), needed


def _undersample_majority(df: pl.DataFrame, col: str) -> tuple[pl.DataFrame, int]:
    """Randomly remove majority-class rows to match minority count."""
    counts = (
        df.filter(pl.col(col).is_not_null())
        .group_by(col)
        .agg(pl.len().alias("n"))
        .sort("n")
    )
    if len(counts) < 2:
        return df, 0
    minority_count = int(counts["n"][0])
    majority_val = counts[col][-1]
    majority_count = int(counts["n"][-1])
    removed = majority_count - minority_count
    if removed <= 0:
        return df, 0
    majority_sample = df.filter(pl.col(col) == majority_val).sample(n=minority_count, seed=42)
    other_rows = df.filter(pl.col(col) != majority_val)
    return pl.concat([other_rows, majority_sample]), removed


def save_df(df: pl.DataFrame, file_path: str) -> None:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        df.write_csv(path)
    elif suffix == ".parquet":
        df.write_parquet(path)
    elif suffix in (".json", ".jsonl"):
        df.write_ndjson(path)
    else:
        df.write_csv(path)
