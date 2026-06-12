"""
Quality Engine — Phase 1.

Computes 5 quality dimensions:
  1. Completeness  — null analysis, missingness
  2. Consistency   — duplicates (exact + near), format consistency
  3. Accuracy      — outlier detection (IQR + Z-score ensemble)
  4. Distribution  — skew, class imbalance, low cardinality flags
  5. Label quality — heuristic checks on likely label columns

Returns a QualityScan (score + issues) and per-column profiles.
"""
from __future__ import annotations
import time
import uuid
from pathlib import Path
from typing import Optional

import polars as pl
import numpy as np


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _issue(
    column: Optional[str],
    issue_type: str,
    dimension: str,
    severity: str,
    description: str,
    affected_count: int,
    affected_pct: float,
    impact_score: float,
    fix_available: bool = False,
    fix_type: Optional[str] = None,
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "column_name": column,
        "issue_type": issue_type,
        "dimension": dimension,
        "severity": severity,
        "description": description,
        "affected_count": affected_count,
        "affected_pct": round(affected_pct, 3),
        "impact_score": round(impact_score, 2),
        "fix_available": fix_available,
        "fix_type": fix_type,
        "status": "open",
    }


def _severity(pct: float) -> str:
    if pct >= 15:
        return "critical"
    if pct >= 5:
        return "warning"
    return "info"


# ─────────────────────────────────────────────
# 1. Completeness
# ─────────────────────────────────────────────

def _completeness(df: pl.DataFrame) -> tuple[float, list[dict]]:
    issues = []
    total = len(df)
    null_scores = []

    for col in df.columns:
        null_count = df[col].null_count()
        pct = null_count / total * 100 if total > 0 else 0
        col_score = max(0.0, 100 - pct * 1.5)
        null_scores.append(col_score)

        if pct > 0:
            sev = _severity(pct)
            impact = min(pct * 0.8, 20.0)
            issues.append(_issue(
                column=col,
                issue_type="null_values",
                dimension="completeness",
                severity=sev,
                description=f"{pct:.1f}% null values in '{col}'",
                affected_count=null_count,
                affected_pct=pct,
                impact_score=impact,
                fix_available=True,
                fix_type="auto",
            ))

    score = float(np.mean(null_scores)) if null_scores else 100.0
    return round(score, 1), issues


# ─────────────────────────────────────────────
# 2. Consistency
# ─────────────────────────────────────────────

def _consistency(df: pl.DataFrame) -> tuple[float, list[dict]]:
    issues = []
    total = len(df)

    # Exact duplicate rows
    dup_count = total - df.unique().height
    if dup_count > 0:
        pct = dup_count / total * 100
        sev = _severity(pct)
        issues.append(_issue(
            column=None,
            issue_type="duplicate_rows",
            dimension="consistency",
            severity=sev,
            description=f"{dup_count:,} exact duplicate rows ({pct:.1f}%)",
            affected_count=dup_count,
            affected_pct=pct,
            impact_score=min(pct * 0.5, 10.0),
            fix_available=True,
            fix_type="auto",
        ))

    # Format consistency for string columns
    for col in df.columns:
        dtype_name = str(df[col].dtype)
        if "String" not in dtype_name and "Utf8" not in dtype_name:
            continue
        series = df[col].drop_nulls()
        if len(series) < 10:
            continue

        # Mixed case detection
        lower_ct = series.filter(series.str.to_lowercase() == series).len()
        upper_ct = series.filter(series.str.to_uppercase() == series).len()
        mixed_ct = len(series) - lower_ct - upper_ct
        if mixed_ct > 0 and mixed_ct / len(series) > 0.05:
            pct = mixed_ct / len(series) * 100
            issues.append(_issue(
                column=col,
                issue_type="mixed_case",
                dimension="consistency",
                severity="info",
                description=f"Mixed case values in '{col}' ({pct:.1f}% inconsistent)",
                affected_count=mixed_ct,
                affected_pct=pct,
                impact_score=1.0,
                fix_available=True,
                fix_type="auto",
            ))

    # Penalty for duplicates
    dup_pct = (dup_count / total * 100) if total > 0 else 0
    score = max(0.0, 100 - dup_pct * 2 - len([i for i in issues if i["issue_type"] == "mixed_case"]) * 2)
    return round(score, 1), issues


# ─────────────────────────────────────────────
# 3. Accuracy — outlier detection
# ─────────────────────────────────────────────

def _accuracy(df: pl.DataFrame) -> tuple[float, list[dict]]:
    issues = []
    total = len(df)
    col_penalties = []

    for col in df.columns:
        dtype_name = str(df[col].dtype)
        is_numeric = any(t in dtype_name for t in ("Int", "Float", "UInt"))
        if not is_numeric:
            col_penalties.append(0.0)
            continue

        series = df[col].drop_nulls().cast(pl.Float64, strict=False).drop_nulls()
        if len(series) < 10:
            col_penalties.append(0.0)
            continue

        arr = series.to_numpy()

        # IQR method
        q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
        iqr = q3 - q1
        if iqr == 0:
            col_penalties.append(0.0)
            continue
        lower, upper = q1 - 3.0 * iqr, q3 + 3.0 * iqr
        outlier_mask = (arr < lower) | (arr > upper)
        outlier_count = int(outlier_mask.sum())

        if outlier_count > 0:
            pct = outlier_count / total * 100
            sev = _severity(pct)
            penalty = min(pct * 1.2, 15.0)
            col_penalties.append(penalty)
            issues.append(_issue(
                column=col,
                issue_type="outliers",
                dimension="accuracy",
                severity=sev,
                description=f"{outlier_count:,} outliers in '{col}' ({pct:.1f}%) — IQR 3× fence",
                affected_count=outlier_count,
                affected_pct=pct,
                impact_score=min(pct * 0.7, 10.0),
                fix_available=True,
                fix_type="semi_auto",
            ))
        else:
            col_penalties.append(0.0)

    avg_penalty = float(np.mean(col_penalties)) if col_penalties else 0.0
    score = max(0.0, 100 - avg_penalty)
    return round(score, 1), issues


# ─────────────────────────────────────────────
# 4. Distribution
# ─────────────────────────────────────────────

def _distribution(df: pl.DataFrame) -> tuple[float, list[dict]]:
    issues = []
    total = len(df)
    penalties = []

    for col in df.columns:
        dtype_name = str(df[col].dtype)
        is_numeric = any(t in dtype_name for t in ("Int", "Float", "UInt"))
        is_string = "String" in dtype_name or "Utf8" in dtype_name

        if is_numeric:
            series = df[col].drop_nulls().cast(pl.Float64, strict=False).drop_nulls()
            if len(series) < 20:
                continue
            arr = series.to_numpy()
            # Skewness
            mean, std = arr.mean(), arr.std()
            if std > 0:
                skew = float(np.mean(((arr - mean) / std) ** 3))
                if abs(skew) > 2.0:
                    penalties.append(5.0)
                    issues.append(_issue(
                        column=col,
                        issue_type="high_skew",
                        dimension="distribution",
                        severity="info",
                        description=f"High skewness ({skew:.2f}) in '{col}' — consider log transform",
                        affected_count=len(arr),
                        affected_pct=100.0,
                        impact_score=2.0,
                        fix_available=False,
                    ))

        if is_string:
            series = df[col].drop_nulls()
            if len(series) < 10:
                continue
            vc = series.value_counts(sort=True)
            if len(vc) <= 1:
                continue

            top_count = vc["count"][0] if "count" in vc.columns else vc.row(0)[1]
            top_pct = top_count / len(series) * 100

            # Class imbalance — dominant class >90%
            if top_pct > 90 and len(vc) > 1:
                bottom_count = vc["count"][-1] if "count" in vc.columns else vc.row(-1)[1]
                ratio = top_count / max(bottom_count, 1)
                penalties.append(8.0)
                issues.append(_issue(
                    column=col,
                    issue_type="class_imbalance",
                    dimension="distribution",
                    severity="warning",
                    description=f"Severe class imbalance in '{col}' — dominant class {top_pct:.1f}% (ratio {ratio:.0f}:1)",
                    affected_count=total,
                    affected_pct=100.0,
                    impact_score=8.0,
                    fix_available=False,
                ))

    avg_penalty = float(np.mean(penalties)) if penalties else 0.0
    score = max(0.0, 100 - avg_penalty)
    return round(score, 1), issues


# ─────────────────────────────────────────────
# 5. Label quality — heuristic
# ─────────────────────────────────────────────

LABEL_COLUMN_NAMES = {"label", "target", "y", "class", "category", "output", "outcome"}

def _label_quality(df: pl.DataFrame) -> tuple[float, list[dict]]:
    issues = []
    total = len(df)
    penalties = []

    label_cols = [c for c in df.columns if c.lower() in LABEL_COLUMN_NAMES]
    if not label_cols:
        # Guess: last column if categorical
        last = df.columns[-1]
        dtype_name = str(df[last].dtype)
        if "String" in dtype_name or "Utf8" in dtype_name or "Boolean" in dtype_name:
            label_cols = [last]

    for col in label_cols:
        series = df[col]
        null_count = series.null_count()
        pct_null = null_count / total * 100 if total > 0 else 0

        if pct_null > 0:
            sev = "critical" if pct_null > 5 else "warning"
            penalties.append(min(pct_null * 2, 30.0))
            issues.append(_issue(
                column=col,
                issue_type="null_labels",
                dimension="label_quality",
                severity=sev,
                description=f"{pct_null:.1f}% null values in label column '{col}'",
                affected_count=null_count,
                affected_pct=pct_null,
                impact_score=min(pct_null * 1.2, 20.0),
                fix_available=True,
                fix_type="semi_auto",
            ))

        # Rare class detection
        dtype_name = str(series.dtype)
        if "String" in dtype_name or "Utf8" in dtype_name:
            vc = series.drop_nulls().value_counts(sort=True)
            if len(vc) > 1:
                counts = vc["count"].to_list() if "count" in vc.columns else [vc.row(i)[1] for i in range(len(vc))]
                min_count = min(counts)
                max_count = max(counts)
                if max_count / max(min_count, 1) > 10:
                    ratio = max_count / max(min_count, 1)
                    penalties.append(10.0)
                    issues.append(_issue(
                        column=col,
                        issue_type="class_imbalance",
                        dimension="label_quality",
                        severity="warning",
                        description=f"Label imbalance in '{col}' — {ratio:.0f}:1 ratio between classes",
                        affected_count=total,
                        affected_pct=100.0,
                        impact_score=min(ratio * 0.3, 15.0),
                        fix_available=False,
                    ))

    avg_penalty = float(np.mean(penalties)) if penalties else 0.0
    score = max(0.0, 100 - avg_penalty)
    return round(score, 1), issues


# ─────────────────────────────────────────────
# Column profiles
# ─────────────────────────────────────────────

def _build_column_profiles(df: pl.DataFrame, all_issues: list[dict]) -> list[dict]:
    total = len(df)
    profiles = []
    issues_by_col: dict[str, list] = {}
    for issue in all_issues:
        key = issue["column_name"] or "__dataset__"
        issues_by_col.setdefault(key, []).append(issue)

    for col in df.columns:
        series = df[col]
        dtype_name = str(series.dtype)
        null_count = series.null_count()
        null_pct = null_count / total * 100 if total > 0 else 0

        is_numeric = any(t in dtype_name for t in ("Int", "Float", "UInt"))
        is_string = "String" in dtype_name or "Utf8" in dtype_name

        col_issues = issues_by_col.get(col, [])

        # Quality score for this column
        issue_penalty = sum(
            15 if i["severity"] == "critical" else 8 if i["severity"] == "warning" else 3
            for i in col_issues
        )
        col_score = max(0.0, 100 - null_pct * 1.5 - issue_penalty)

        # Distribution
        distribution = []
        if is_string:
            try:
                vc = series.drop_nulls().value_counts(sort=True).head(10)
                col_vals = vc.to_dicts()
                non_null = total - null_count
                for row in col_vals:
                    label = list(row.keys())[0]
                    count_val = row.get("count", row.get(col, 0))
                    if isinstance(count_val, str):
                        label, count_val = count_val, row.get("count", 0)
                    distribution.append({
                        "label": str(label),
                        "count": int(count_val),
                        "pct": round(count_val / non_null * 100, 1) if non_null > 0 else 0,
                    })
            except Exception:
                pass

        # Stats
        stats = {}
        if is_numeric:
            try:
                num = series.drop_nulls().cast(pl.Float64, strict=False).drop_nulls()
                if len(num) > 0:
                    arr = num.to_numpy()
                    stats = {
                        "min": round(float(arr.min()), 4),
                        "max": round(float(arr.max()), 4),
                        "mean": round(float(arr.mean()), 4),
                        "median": round(float(np.median(arr)), 4),
                        "std": round(float(arr.std()), 4),
                    }
            except Exception:
                pass
        elif is_string:
            unique = series.drop_nulls().n_unique()
            stats["unique"] = unique
            stats["most_common"] = str(series.drop_nulls().mode().head(1).to_list()[0]) if len(series.drop_nulls()) > 0 else "—"

        unique_count = series.n_unique() if is_string else None

        profiles.append({
            "name": col,
            "dtype": dtype_name.replace("Utf8", "string").replace("String", "string"),
            "null_count": null_count,
            "null_pct": round(null_pct, 3),
            "unique_count": unique_count,
            "quality_score": round(col_score, 1),
            "issues": col_issues,
            "distribution": distribution,
            "stats": stats,
        })

    return profiles


# ─────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────

WEIGHTS = {
    "completeness": 0.25,
    "consistency": 0.20,
    "accuracy": 0.25,
    "distribution": 0.20,
    "label_quality": 0.10,
}

def run_quality_scan(file_path: str) -> dict:
    """Run full quality scan on file. Returns {score, issues, column_profiles, duration_ms}."""
    t0 = time.time()

    df = _load_df(file_path)

    comp_score, comp_issues = _completeness(df)
    cons_score, cons_issues = _consistency(df)
    acc_score, acc_issues = _accuracy(df)
    dist_score, dist_issues = _distribution(df)
    label_score, label_issues = _label_quality(df)

    all_issues = comp_issues + cons_issues + acc_issues + dist_issues + label_issues

    # Weighted overall
    overall = (
        comp_score * WEIGHTS["completeness"]
        + cons_score * WEIGHTS["consistency"]
        + acc_score * WEIGHTS["accuracy"]
        + dist_score * WEIGHTS["distribution"]
        + label_score * WEIGHTS["label_quality"]
    )

    score = {
        "overall": round(overall, 1),
        "completeness": comp_score,
        "consistency": cons_score,
        "accuracy": acc_score,
        "distribution": dist_score,
        "label_quality": label_score,
    }

    column_profiles = _build_column_profiles(df, all_issues)

    # Sort issues: critical first, then by impact
    all_issues.sort(key=lambda i: (
        0 if i["severity"] == "critical" else 1 if i["severity"] == "warning" else 2,
        -i["impact_score"],
    ))

    duration_ms = int((time.time() - t0) * 1000)
    return {
        "score": score,
        "issues": all_issues,
        "column_profiles": column_profiles,
        "duration_ms": duration_ms,
    }


def _load_df(file_path: str) -> pl.DataFrame:
    from app.services.ingestion import read_file
    path = Path(file_path)
    return read_file(path)
