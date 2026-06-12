"""
Pipeline Execution Engine — Phase 2.
Executes a sequence of transformation steps on a Polars DataFrame.
Each step type maps to a pure Polars operation.
"""
from __future__ import annotations
from pathlib import Path

import polars as pl

from app.services.ingestion import read_file


# ── Public API ────────────────────────────────────────────────────────

def run_pipeline(steps: list[dict], file_path: str, dry_run: bool) -> tuple[pl.DataFrame, list[dict]]:
    """Load file, execute all steps, return (result_df, step_results)."""
    df = read_file(Path(file_path))
    if dry_run:
        df = df.head(1000)
    return execute_steps(df, steps)


def execute_steps(df: pl.DataFrame, steps: list[dict]) -> tuple[pl.DataFrame, list[dict]]:
    """Execute steps in order, collecting per-step row/col counts and a 3-row preview."""
    results = []
    for step in steps:
        rows_in = len(df)
        cols_in = len(df.columns)
        df = _execute_step(df, step)
        results.append({
            "step_id": step["id"],
            "rows_in": rows_in,
            "rows_out": len(df),
            "cols_in": cols_in,
            "cols_out": len(df.columns),
            "preview": df.head(3).to_dicts(),
        })
    return df, results


def save_output(df: pl.DataFrame, path: Path, fmt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "parquet":
        df.write_parquet(path)
    elif fmt in ("json", "jsonl"):
        df.write_ndjson(path)
    else:
        df.write_csv(path)


# ── Step dispatcher ───────────────────────────────────────────────────

def _execute_step(df: pl.DataFrame, step: dict) -> pl.DataFrame:
    t = step.get("type", "")
    c = step.get("config", {})

    if t == "filter":
        return _filter(df, c)
    if t == "select_columns":
        return _select_columns(df, c)
    if t == "drop_columns":
        return _drop_columns(df, c)
    if t == "rename_column":
        return _rename_column(df, c)
    if t == "fill_nulls":
        return _fill_nulls(df, c)
    if t == "deduplicate":
        return _deduplicate(df, c)
    if t == "lowercase":
        return _lowercase(df, c)
    if t == "normalize":
        return _normalize(df, c)
    if t == "encode_categorical":
        return _encode_categorical(df, c)
    if t == "sort":
        return _sort(df, c)
    return df


# ── Individual step implementations ──────────────────────────────────

def _filter(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col, op, val = c.get("column"), c.get("operator"), c.get("value", "")
    if not col or not op or col not in df.columns:
        return df
    if op == "not_null":
        return df.filter(pl.col(col).is_not_null())
    if op == "is_null":
        return df.filter(pl.col(col).is_null())
    if op == "contains":
        return df.filter(pl.col(col).cast(pl.String).str.contains(str(val)))
    # Numeric comparisons — cast to float, fall back to string equality
    try:
        num = float(val)
        expr = pl.col(col).cast(pl.Float64, strict=False)
        ops = {">": expr > num, "<": expr < num, ">=": expr >= num,
               "<=": expr <= num, "==": expr == num, "!=": expr != num}
        return df.filter(ops[op])
    except (ValueError, KeyError):
        str_expr = pl.col(col).cast(pl.String)
        if op == "==":
            return df.filter(str_expr == str(val))
        if op == "!=":
            return df.filter(str_expr != str(val))
    return df


def _select_columns(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    cols = [col for col in c.get("columns", []) if col in df.columns]
    return df.select(cols) if cols else df


def _drop_columns(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    cols = [col for col in c.get("columns", []) if col in df.columns]
    return df.drop(cols) if cols else df


def _rename_column(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    from_col, to_col = c.get("from"), c.get("to")
    if from_col and to_col and from_col in df.columns and to_col not in df.columns:
        return df.rename({from_col: to_col})
    return df


def _fill_nulls(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col, strategy = c.get("column"), c.get("strategy", "drop_rows")
    if not col or col not in df.columns:
        return df
    if strategy == "drop_rows":
        return df.filter(pl.col(col).is_not_null())
    if strategy == "mean":
        return df.with_columns(pl.col(col).fill_null(pl.col(col).mean()))
    if strategy == "mode":
        modes = df[col].drop_nulls().mode()
        if len(modes):
            return df.with_columns(pl.col(col).fill_null(modes[0]))
    if strategy == "value":
        fill = c.get("value", "")
        return df.with_columns(pl.col(col).fill_null(fill))
    return df


def _deduplicate(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    cols = [col for col in c.get("columns", []) if col in df.columns] or None
    return df.unique(subset=cols)


def _lowercase(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col = c.get("column")
    if col and col in df.columns:
        return df.with_columns(pl.col(col).cast(pl.String).str.to_lowercase())
    return df


def _normalize(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col = c.get("column")
    if not col or col not in df.columns:
        return df
    lo, hi = df[col].min(), df[col].max()
    if lo is None or hi is None or lo == hi:
        return df
    return df.with_columns(((pl.col(col) - lo) / (hi - lo)).alias(col))


def _encode_categorical(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col = c.get("column")
    if not col or col not in df.columns:
        return df
    cats = sorted([x for x in df[col].unique().to_list() if x is not None])
    mapping = {v: i for i, v in enumerate(cats)}
    return df.with_columns(pl.col(col).replace(mapping).cast(pl.Int32).alias(col))


def _sort(df: pl.DataFrame, c: dict) -> pl.DataFrame:
    col = c.get("column")
    if col and col in df.columns:
        return df.sort(col, descending=bool(c.get("descending", False)))
    return df
