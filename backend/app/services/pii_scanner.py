"""
PII Scanner — two-pass detection:
  1. Column name keyword matching
  2. Value sampling with compiled regex patterns
Confidence = weighted combination of both signals.
"""
from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Optional

import polars as pl

from app.models.store import store, ComplianceScan
from app.services.audit_logger import log as audit_log
from app.services.storage import get_storage

# ── Keyword lists ─────────────────────────────────────────────────────

_NAME_SIGNALS: dict[str, tuple[str, str, float]] = {
    # keyword → (pii_category, severity, base_confidence)
    "ssn":            ("national_id",     "critical", 0.90),
    "social_security":("national_id",     "critical", 0.92),
    "national_id":    ("national_id",     "critical", 0.88),
    "passport":       ("national_id",     "critical", 0.85),
    "drivers_license":("national_id",     "critical", 0.85),
    "license_number": ("national_id",     "critical", 0.80),
    "tax_id":         ("national_id",     "critical", 0.85),
    "nhs":            ("national_id",     "critical", 0.85),
    "credit_card":    ("financial",       "critical", 0.92),
    "card_number":    ("financial",       "critical", 0.90),
    "cvv":            ("financial",       "critical", 0.88),
    "iban":           ("financial",       "critical", 0.90),
    "account_number": ("financial",       "critical", 0.82),
    "bank_account":   ("financial",       "critical", 0.85),
    "routing_number": ("financial",       "critical", 0.85),
    "diagnosis":      ("health",          "critical", 0.85),
    "icd":            ("health",          "critical", 0.80),
    "condition":      ("health",          "critical", 0.72),
    "medication":     ("health",          "critical", 0.80),
    "prescription":   ("health",          "critical", 0.82),
    "medical_record": ("health",          "critical", 0.85),
    "patient_id":     ("health",          "critical", 0.80),
    "email":          ("contact",         "high",     0.92),
    "e_mail":         ("contact",         "high",     0.90),
    "phone":          ("contact",         "high",     0.88),
    "mobile":         ("contact",         "high",     0.85),
    "telephone":      ("contact",         "high",     0.85),
    "tel":            ("contact",         "high",     0.75),
    "address":        ("contact",         "high",     0.78),
    "street":         ("contact",         "high",     0.75),
    "city":           ("contact",         "high",     0.60),
    "ip_address":     ("contact",         "high",     0.88),
    "ip":             ("contact",         "high",     0.72),
    "mac_address":    ("contact",         "high",     0.85),
    "latitude":       ("geolocation",     "high",     0.85),
    "longitude":      ("geolocation",     "high",     0.85),
    "lat":            ("geolocation",     "high",     0.70),
    "lng":            ("geolocation",     "high",     0.70),
    "gps":            ("geolocation",     "high",     0.80),
    "location":       ("geolocation",     "high",     0.65),
    "dob":            ("quasi_identifier","high",     0.90),
    "date_of_birth":  ("quasi_identifier","high",     0.92),
    "birth_date":     ("quasi_identifier","high",     0.90),
    "birthdate":      ("quasi_identifier","high",     0.90),
    "age":            ("quasi_identifier","low",      0.65),
    "gender":         ("quasi_identifier","medium",   0.75),
    "sex":            ("quasi_identifier","medium",   0.65),
    "race":           ("quasi_identifier","high",     0.78),
    "ethnicity":      ("quasi_identifier","high",     0.80),
    "religion":       ("quasi_identifier","high",     0.78),
    "nationality":    ("quasi_identifier","medium",   0.72),
    "zip":            ("quasi_identifier","medium",   0.80),
    "postal":         ("quasi_identifier","medium",   0.78),
    "postcode":       ("quasi_identifier","medium",   0.80),
    "first_name":     ("name",            "medium",   0.85),
    "last_name":      ("name",            "medium",   0.85),
    "full_name":      ("name",            "medium",   0.88),
    "surname":        ("name",            "medium",   0.85),
    "given_name":     ("name",            "medium",   0.85),
    "username":       ("name",            "low",      0.70),
    "user_id":        ("identifier",      "low",      0.60),
    "customer_id":    ("identifier",      "low",      0.62),
    "device_id":      ("identifier",      "medium",   0.72),
    "fingerprint":    ("biometric",       "critical", 0.80),
    "biometric":      ("biometric",       "critical", 0.85),
    "face":           ("biometric",       "critical", 0.75),
    "voice":          ("biometric",       "critical", 0.75),
    "salary":         ("financial",       "high",     0.82),
    "income":         ("financial",       "high",     0.78),
    "wage":           ("financial",       "high",     0.78),
    "salary_band":    ("financial",       "medium",   0.75),
    "cookie":         ("behavioral",      "medium",   0.72),
    "session_id":     ("behavioral",      "medium",   0.68),
    "token":          ("behavioral",      "medium",   0.60),
}

# ── Regex patterns for value sampling ────────────────────────────────

_VALUE_PATTERNS: list[tuple[str, str, str, float]] = [
    # (pattern, pii_category, severity, confidence_boost)
    (r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b', "contact", "high", 0.95),
    (r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', "contact", "high", 0.80),
    (r'\b\d{3}-\d{2}-\d{4}\b', "national_id", "critical", 0.95),
    (r'\b4[0-9]{12}(?:[0-9]{3})?\b', "financial", "critical", 0.90),
    (r'\b5[1-5][0-9]{14}\b', "financial", "critical", 0.90),
    (r'\b3[47][0-9]{13}\b', "financial", "critical", 0.90),
    (r'\b(?:[0-9]{4}[- ]?){3}[0-9]{4}\b', "financial", "critical", 0.85),
    (r'\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b', "contact", "high", 0.92),
    (r'\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]{0,16})?\b', "financial", "critical", 0.88),
    (r'\b\d{5}(?:-\d{4})?\b', "quasi_identifier", "medium", 0.55),
    (r'\b(?:19|20)\d{2}[-/]\d{2}[-/]\d{2}\b', "quasi_identifier", "high", 0.75),
    (r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', "contact", "high", 0.78),
]

_COMPILED_PATTERNS = [(re.compile(p), cat, sev, conf) for p, cat, sev, conf in _VALUE_PATTERNS]

_SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "clean": 0}

SAMPLE_SIZE = 500


def _mask_value(v: str) -> str:
    if len(v) <= 2:
        return "***"
    if "@" in v:
        parts = v.split("@")
        return f"{parts[0][0]}***@{parts[1][0]}***.{parts[1].split('.')[-1]}"
    return v[0] + "*" * (len(v) - 2) + v[-1]


def _scan_column(col_name: str, values: list[str]) -> Optional[dict]:
    """Return a finding dict for a column, or None if no PII detected."""
    name_lower = col_name.lower()

    # Pass 1 — name matching
    name_result = None
    for keyword, (category, severity, confidence) in _NAME_SIGNALS.items():
        if keyword in name_lower:
            if name_result is None or _SEVERITY_ORDER.get(severity, 0) > _SEVERITY_ORDER.get(name_result[1], 0):
                name_result = (category, severity, confidence)

    # Pass 2 — value sampling
    value_result = None
    best_match_count = 0
    for regex, category, severity, confidence in _COMPILED_PATTERNS:
        matches = sum(1 for v in values if v and regex.search(v))
        if matches > 0:
            match_ratio = matches / max(len(values), 1)
            if match_ratio >= 0.05:
                if value_result is None or _SEVERITY_ORDER.get(severity, 0) > _SEVERITY_ORDER.get(value_result[1], 0):
                    value_result = (category, severity, confidence * min(match_ratio * 2, 1.0))
                    best_match_count = matches

    if name_result is None and value_result is None:
        return None

    # Combine signals
    if name_result and value_result:
        # Use higher severity, average confidence with boost for both matching
        sev = name_result[1] if _SEVERITY_ORDER.get(name_result[1], 0) >= _SEVERITY_ORDER.get(value_result[1], 0) else value_result[1]
        cat = name_result[0]
        conf = min((name_result[2] + value_result[2]) / 2 + 0.05, 1.0)
        detection = "name_and_value"
    elif name_result:
        sev, cat, conf = name_result[1], name_result[0], name_result[2]
        detection = "column_name"
    else:
        sev, cat, conf = value_result[1], value_result[0], value_result[2]
        detection = "value_pattern"

    sample_values = [_mask_value(str(v)) for v in values[:3] if v][:3]

    return {
        "column": col_name,
        "pii_category": cat,
        "severity": sev,
        "confidence": round(conf, 3),
        "detection_method": detection,
        "sample_values": sample_values,
        "suggested_methods": _suggest_methods(cat, sev),
    }


def _suggest_methods(category: str, severity: str) -> list[str]:
    if severity == "critical":
        return ["hash", "suppress"]
    if category in ("contact",):
        return ["mask", "hash"]
    if category in ("quasi_identifier", "name"):
        return ["generalize", "pseudonymize"]
    if category in ("financial",):
        return ["hash", "suppress"]
    if category in ("health",):
        return ["hash", "redact"]
    return ["redact", "suppress"]


def scan_dataset(dataset_id: str) -> ComplianceScan:
    scan = ComplianceScan(dataset_id=dataset_id, status="running")
    store.add_compliance_scan(scan)
    t0 = time.perf_counter()

    try:
        ds = store.get_dataset(dataset_id)
        storage = get_storage()
        if not ds or not storage.exists(ds.file_path):
            scan.status = "failed"
            scan.error_message = "Dataset file not found"
            store.update_compliance_scan(scan)
            return scan

        df = pl.read_csv(storage.local_path(ds.file_path), n_rows=SAMPLE_SIZE, ignore_errors=True)
        scan.rows_sampled = len(df)
        findings = []

        for col in df.columns:
            values = df[col].cast(pl.Utf8, strict=False).to_list()
            str_values = [str(v) for v in values if v is not None]
            result = _scan_column(col, str_values)
            if result:
                findings.append(result)

        findings.sort(key=lambda f: _SEVERITY_ORDER.get(f["severity"], 0), reverse=True)

        scan.findings = findings
        scan.pii_column_count = len(findings)
        scan.critical_count = sum(1 for f in findings if f["severity"] == "critical")
        scan.high_count = sum(1 for f in findings if f["severity"] == "high")
        scan.medium_count = sum(1 for f in findings if f["severity"] == "medium")
        scan.low_count = sum(1 for f in findings if f["severity"] == "low")

        if scan.critical_count > 0:
            scan.overall_risk = "critical"
        elif scan.high_count > 0:
            scan.overall_risk = "high"
        elif scan.medium_count > 0:
            scan.overall_risk = "medium"
        elif scan.low_count > 0:
            scan.overall_risk = "low"
        else:
            scan.overall_risk = "clean"

        scan.status = "complete"
        from datetime import datetime, timezone
        scan.scanned_at = datetime.now(timezone.utc).isoformat()

    except Exception as exc:
        scan.status = "failed"
        scan.error_message = str(exc)

    scan.duration_ms = int((time.perf_counter() - t0) * 1000)
    store.update_compliance_scan(scan)

    ds_name = store.get_dataset(dataset_id)
    audit_log(
        "compliance.pii_scan", "dataset", dataset_id,
        ds_name.name if ds_name else dataset_id,
        {
            "scan_id": scan.id,
            "overall_risk": scan.overall_risk,
            "pii_column_count": scan.pii_column_count,
            "critical_count": scan.critical_count,
        },
        duration_ms=scan.duration_ms,
    )
    return scan
