"""
Compliance API — 19 routes.
"""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.models.store import store, CompliancePolicy, AnonymizationJob
from app.services.audit_logger import log as audit_log
from app.services.compliance_checker import evaluate_all_policies, compute_risk_score
from app.services.lineage_tracker import build_full_graph, build_dataset_graph
from app.services.pii_scanner import scan_dataset
from app.services.anonymizer import run_anonymization_job
from app.services.report_generator import generate_report, REPORTS_DIR

router = APIRouter(prefix="/compliance", tags=["compliance"])

# ── Schemas ───────────────────────────────────────────────────────────

class PolicyCreate(BaseModel):
    name: str
    policy_type: str
    parameters: dict = {}
    severity: str = "warning"
    enabled: bool = True


class PolicyPatch(BaseModel):
    name: Optional[str] = None
    parameters: Optional[dict] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None


class AnonymizeRequest(BaseModel):
    source_dataset_id: str
    output_name: str
    column_configs: list  # [{column, method, params}]


class ReportRequest(BaseModel):
    framework: str = "general"   # gdpr | ccpa | hipaa | general | custom
    sections: list[str] = ["dataset_inventory", "pii_findings", "policy_status",
                            "lineage_summary", "audit_excerpt", "recommendations"]


VALID_POLICY_TYPES = {
    "no_pii_in_training", "pii_scan_required", "min_quality_score",
    "max_retention_days", "min_row_count_for_training",
    "no_unscanned_in_pipeline", "model_accuracy_floor", "benchmark_winner_required",
}
VALID_SEVERITIES = {"info", "warning", "critical"}
VALID_FRAMEWORKS = {"gdpr", "ccpa", "hipaa", "general", "custom"}

# ── Dashboard ─────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard():
    risk = compute_risk_score()
    violations = store.list_violations(resolved=False)
    datasets = store.list_datasets()

    scans_by_ds = {ds.id: store.get_latest_compliance_scan(ds.id) for ds in datasets}
    unscanned = [ds for ds in datasets if scans_by_ds[ds.id] is None]
    critical_pii = [ds for ds in datasets
                    if scans_by_ds[ds.id] and scans_by_ds[ds.id].overall_risk == "critical"]
    high_pii = [ds for ds in datasets
                if scans_by_ds[ds.id] and scans_by_ds[ds.id].overall_risk == "high"]

    from datetime import datetime, timezone, timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_events = store.count_audit_events(since_iso=week_ago)

    dataset_coverage = [
        {
            "id": ds.id, "name": ds.name,
            "pii_risk": scans_by_ds[ds.id].overall_risk if scans_by_ds[ds.id] else "unscanned",
            "pii_column_count": scans_by_ds[ds.id].pii_column_count if scans_by_ds[ds.id] else 0,
            "critical_count": scans_by_ds[ds.id].critical_count if scans_by_ds[ds.id] else 0,
        }
        for ds in datasets
    ]

    return {
        "risk": risk,
        "stats": {
            "violations": len(violations),
            "unscanned_datasets": len(unscanned),
            "pii_columns": sum(s.pii_column_count for s in scans_by_ds.values() if s),
            "audit_events_7d": recent_events,
            "critical_pii_datasets": len(critical_pii),
            "high_pii_datasets": len(high_pii),
        },
        "recent_violations": [
            {
                "id": v.id, "policy_name": v.policy_name, "entity_type": v.entity_type,
                "entity_id": v.entity_id, "entity_name": v.entity_name,
                "severity": v.severity, "message": v.message, "detected_at": v.detected_at,
            }
            for v in violations[:10]
        ],
        "dataset_coverage": dataset_coverage,
    }

# ── PII Scans ─────────────────────────────────────────────────────────

@router.post("/scans/{dataset_id}", status_code=202)
def trigger_scan(dataset_id: str):
    ds = store.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")

    def _run():
        scan_dataset(dataset_id)

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    return {"dataset_id": dataset_id, "status": "scanning", "message": "PII scan started"}


@router.get("/scans/{dataset_id}")
def get_scan(dataset_id: str):
    scan = store.get_latest_compliance_scan(dataset_id)
    if not scan:
        raise HTTPException(404, "No scan found for this dataset")
    return scan


@router.get("/scans")
def list_scans():
    datasets = store.list_datasets()
    result = []
    for ds in datasets:
        scan = store.get_latest_compliance_scan(ds.id)
        result.append({
            "dataset_id": ds.id,
            "dataset_name": ds.name,
            "scan": {
                "id": scan.id, "status": scan.status, "overall_risk": scan.overall_risk,
                "pii_column_count": scan.pii_column_count, "critical_count": scan.critical_count,
                "scanned_at": scan.scanned_at, "duration_ms": scan.duration_ms,
            } if scan else None,
        })
    return result


@router.post("/scans")
def scan_all_datasets():
    datasets = store.list_datasets()

    def _run_all():
        for ds in datasets:
            scan_dataset(ds.id)

    t = threading.Thread(target=_run_all, daemon=True)
    t.start()
    return {"message": f"Started scanning {len(datasets)} datasets", "count": len(datasets)}

# ── Lineage ───────────────────────────────────────────────────────────

@router.get("/lineage")
def get_full_lineage():
    return build_full_graph()


@router.get("/lineage/{dataset_id}")
def get_dataset_lineage(dataset_id: str):
    if not store.get_dataset(dataset_id):
        raise HTTPException(404, "Dataset not found")
    return build_dataset_graph(dataset_id)

# ── Policies ──────────────────────────────────────────────────────────

@router.get("/policies")
def list_policies():
    policies = store.list_compliance_policies()
    violations = store.list_violations(resolved=False)
    viol_counts = {}
    for v in violations:
        viol_counts[v.policy_id] = viol_counts.get(v.policy_id, 0) + 1

    return [
        {
            "id": p.id, "name": p.name, "policy_type": p.policy_type,
            "parameters": p.parameters, "severity": p.severity,
            "enabled": p.enabled, "created_at": p.created_at,
            "violation_count": viol_counts.get(p.id, 0),
        }
        for p in policies
    ]


@router.post("/policies", status_code=201)
def create_policy(body: PolicyCreate):
    if body.policy_type not in VALID_POLICY_TYPES:
        raise HTTPException(400, f"policy_type must be one of {VALID_POLICY_TYPES}")
    if body.severity not in VALID_SEVERITIES:
        raise HTTPException(400, f"severity must be one of {VALID_SEVERITIES}")
    if not body.name.strip():
        raise HTTPException(400, "name is required")

    policy = CompliancePolicy(
        name=body.name.strip(),
        policy_type=body.policy_type,
        parameters=body.parameters,
        severity=body.severity,
        enabled=body.enabled,
    )
    store.add_compliance_policy(policy)
    audit_log("compliance.policy_create", "compliance_policy", policy.id, policy.name)
    return policy


@router.patch("/policies/{policy_id}")
def update_policy(policy_id: str, body: PolicyPatch):
    p = store.get_compliance_policy(policy_id)
    if not p:
        raise HTTPException(404, "Policy not found")
    if body.name is not None: p.name = body.name.strip()
    if body.parameters is not None: p.parameters = body.parameters
    if body.severity is not None:
        if body.severity not in VALID_SEVERITIES:
            raise HTTPException(400, f"severity must be one of {VALID_SEVERITIES}")
        p.severity = body.severity
    if body.enabled is not None: p.enabled = body.enabled
    store.update_compliance_policy(p)
    return p


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(policy_id: str):
    if not store.get_compliance_policy(policy_id):
        raise HTTPException(404, "Policy not found")
    audit_log("compliance.policy_delete", "compliance_policy", policy_id, "")
    store.delete_compliance_policy(policy_id)


@router.post("/policies/evaluate")
def evaluate_policies():
    violations = evaluate_all_policies()
    return {
        "policies_evaluated": len(store.list_compliance_policies()),
        "violations_found": len(violations),
        "violations": [
            {
                "id": v.id, "policy_name": v.policy_name, "entity_type": v.entity_type,
                "entity_name": v.entity_name, "severity": v.severity, "message": v.message,
            }
            for v in violations
        ],
    }

# ── Violations ────────────────────────────────────────────────────────

@router.get("/violations")
def list_violations(resolved: bool = Query(False)):
    violations = store.list_violations(resolved=resolved)
    return [
        {
            "id": v.id, "policy_id": v.policy_id, "policy_name": v.policy_name,
            "policy_type": v.policy_type, "entity_type": v.entity_type,
            "entity_id": v.entity_id, "entity_name": v.entity_name,
            "message": v.message, "severity": v.severity, "resolved": v.resolved,
            "detected_at": v.detected_at, "resolved_at": v.resolved_at,
        }
        for v in violations
    ]


@router.patch("/violations/{violation_id}/resolve")
def resolve_violation(violation_id: str):
    v = store.resolve_violation(violation_id)
    if not v:
        raise HTTPException(404, "Violation not found")
    return v

# ── Anonymization ─────────────────────────────────────────────────────

@router.post("/anonymize", status_code=202)
def create_anonymize_job(body: AnonymizeRequest):
    ds = store.get_dataset(body.source_dataset_id)
    if not ds:
        raise HTTPException(404, "Source dataset not found")
    if not body.output_name.strip():
        raise HTTPException(400, "output_name is required")
    if not body.column_configs:
        raise HTTPException(400, "column_configs cannot be empty")

    job = AnonymizationJob(
        source_dataset_id=body.source_dataset_id,
        output_name=body.output_name.strip(),
        column_configs=body.column_configs,
        status="pending",
    )
    store.add_anonymization_job(job)

    def _run():
        run_anonymization_job(job.id)

    threading.Thread(target=_run, daemon=True).start()
    return {"job_id": job.id, "status": "pending"}


@router.get("/anonymize")
def list_anonymize_jobs():
    return store.list_anonymization_jobs()


@router.get("/anonymize/{job_id}")
def get_anonymize_job(job_id: str):
    job = store.get_anonymization_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

# ── Audit log ─────────────────────────────────────────────────────────

@router.get("/audit")
def get_audit_log(
    category: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    entity_name: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    events = store.list_audit_events(
        category=category, event_type=event_type,
        entity_name=entity_name, limit=limit, offset=offset,
    )
    total = store.count_audit_events()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": [
            {
                "id": e.id, "event_type": e.event_type, "category": e.category,
                "entity_type": e.entity_type, "entity_id": e.entity_id,
                "entity_name": e.entity_name, "metadata": e.metadata,
                "duration_ms": e.duration_ms, "created_at": e.created_at,
            }
            for e in events
        ],
    }


@router.get("/audit/export")
def export_audit_log():
    import csv, io
    from fastapi.responses import StreamingResponse
    events = store.list_audit_events(limit=10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "event_type", "category", "entity_type", "entity_id",
                "entity_name", "duration_ms", "created_at", "metadata"])
    for e in events:
        import json
        w.writerow([e.id, e.event_type, e.category, e.entity_type, e.entity_id,
                    e.entity_name, e.duration_ms, e.created_at, json.dumps(e.metadata)])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )

# ── Reports ───────────────────────────────────────────────────────────

@router.get("/reports")
def list_reports():
    return store.list_compliance_reports()


@router.post("/reports", status_code=202)
def create_report(body: ReportRequest):
    if body.framework not in VALID_FRAMEWORKS:
        raise HTTPException(400, f"framework must be one of {VALID_FRAMEWORKS}")

    def _run():
        generate_report(body.framework, body.sections)

    report_stub = generate_report.__module__  # warm import
    threading.Thread(
        target=generate_report,
        args=(body.framework, body.sections),
        daemon=True,
    ).start()

    # Return immediately with a pending record
    from app.models.store import ComplianceReport
    pending = ComplianceReport(framework=body.framework, sections=body.sections, status="pending")
    store.add_compliance_report(pending)
    threading.Thread(target=lambda: (
        store.delete_compliance_report(pending.id) or None,
        generate_report(body.framework, body.sections)
    ), daemon=True).start()

    return {"message": f"Generating {body.framework.upper()} report", "framework": body.framework}


@router.post("/reports/generate")
def generate_report_sync(body: ReportRequest):
    """Synchronous report generation (blocks until done)."""
    if body.framework not in VALID_FRAMEWORKS:
        raise HTTPException(400, f"framework must be one of {VALID_FRAMEWORKS}")
    report = generate_report(body.framework, body.sections)
    return report


@router.get("/reports/{report_id}")
def get_report(report_id: str):
    r = store.get_compliance_report(report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    return r


@router.get("/reports/{report_id}/download")
def download_report(report_id: str, format: str = Query("html")):
    r = store.get_compliance_report(report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != "complete":
        raise HTTPException(400, "Report is not complete yet")

    if format == "json":
        path = Path(r.file_path)
    else:
        path = REPORTS_DIR / f"{report_id}.html"

    if not path.exists():
        raise HTTPException(404, "Report file not found")

    media = "application/json" if format == "json" else "text/html"
    return FileResponse(str(path), media_type=media,
                        filename=f"compliance_{r.framework}_{report_id[:8]}.{format}")


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: str):
    if not store.get_compliance_report(report_id):
        raise HTTPException(404, "Report not found")
    store.delete_compliance_report(report_id)
