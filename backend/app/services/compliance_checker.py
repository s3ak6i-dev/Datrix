"""
Compliance checker — evaluates all enabled policies against all relevant entities.
Returns a list of PolicyViolation objects and persists them to the store.
"""
from __future__ import annotations
from datetime import datetime, timezone
from app.models.store import store, PolicyViolation, CompliancePolicy
from app.services.audit_logger import log as audit_log

_SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "clean": 0}

DEFAULT_POLICIES = [
    {"name": "No critical PII in training data", "policy_type": "no_pii_in_training",
     "parameters": {"max_pii_severity": "critical"}, "severity": "critical"},
    {"name": "PII scan required within 30 days", "policy_type": "pii_scan_required",
     "parameters": {"max_days": 30}, "severity": "warning"},
    {"name": "Minimum quality score 60", "policy_type": "min_quality_score",
     "parameters": {"threshold": 0.60}, "severity": "warning"},
    {"name": "Dataset retention max 365 days", "policy_type": "max_retention_days",
     "parameters": {"max_days": 365}, "severity": "info"},
    {"name": "Minimum 50 rows for training", "policy_type": "min_row_count_for_training",
     "parameters": {"min_rows": 50}, "severity": "warning"},
    {"name": "No unscanned datasets in pipelines", "policy_type": "no_unscanned_in_pipeline",
     "parameters": {}, "severity": "warning"},
    {"name": "Model accuracy floor 70%", "policy_type": "model_accuracy_floor",
     "parameters": {"threshold": 0.70}, "severity": "warning"},
    {"name": "Benchmark must have winner before use", "policy_type": "benchmark_winner_required",
     "parameters": {}, "severity": "info"},
]


def ensure_default_policies() -> None:
    existing_types = {p.policy_type for p in store.list_compliance_policies()}
    for spec in DEFAULT_POLICIES:
        if spec["policy_type"] not in existing_types:
            from app.models.store import CompliancePolicy
            store.add_compliance_policy(CompliancePolicy(
                name=spec["name"],
                policy_type=spec["policy_type"],
                parameters=spec["parameters"],
                severity=spec["severity"],
                enabled=True,
            ))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(iso: str) -> float:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds() / 86400
    except Exception:
        return 0.0


def _evaluate_policy(policy: CompliancePolicy) -> list[PolicyViolation]:
    violations: list[PolicyViolation] = []
    pt = policy.policy_type
    params = policy.parameters

    def violation(entity_type, entity_id, entity_name, message) -> PolicyViolation:
        return PolicyViolation(
            policy_id=policy.id,
            policy_name=policy.name,
            policy_type=pt,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            message=message,
            severity=policy.severity,
        )

    if pt == "no_pii_in_training":
        max_sev = params.get("max_pii_severity", "critical")
        for ds in store.list_datasets():
            scan = store.get_latest_compliance_scan(ds.id)
            if scan and scan.status == "complete":
                if _SEVERITY_ORDER.get(scan.overall_risk, 0) >= _SEVERITY_ORDER.get(max_sev, 0):
                    violations.append(violation(
                        "dataset", ds.id, ds.name,
                        f"Dataset has {scan.overall_risk} PII risk ({scan.pii_column_count} PII columns). Max allowed: {max_sev}."
                    ))

    elif pt == "pii_scan_required":
        max_days = params.get("max_days", 30)
        for ds in store.list_datasets():
            scan = store.get_latest_compliance_scan(ds.id)
            if scan is None:
                violations.append(violation("dataset", ds.id, ds.name, "Dataset has never been scanned for PII."))
            elif scan.scanned_at and _days_ago(scan.scanned_at) > max_days:
                age = int(_days_ago(scan.scanned_at))
                violations.append(violation("dataset", ds.id, ds.name, f"PII scan is {age} days old (max: {max_days} days)."))

    elif pt == "min_quality_score":
        threshold = params.get("threshold", 0.60)
        for ds in store.list_datasets():
            if ds.latest_score is not None and ds.latest_score < threshold:
                violations.append(violation(
                    "dataset", ds.id, ds.name,
                    f"Quality score {ds.latest_score:.2f} is below threshold {threshold:.2f}."
                ))

    elif pt == "max_retention_days":
        max_days = params.get("max_days", 365)
        for ds in store.list_datasets():
            age = _days_ago(ds.created_at)
            if age > max_days:
                violations.append(violation("dataset", ds.id, ds.name, f"Dataset is {int(age)} days old (max: {max_days} days)."))

    elif pt == "min_row_count_for_training":
        min_rows = params.get("min_rows", 50)
        for ds in store.list_datasets():
            if ds.row_count is not None and ds.row_count < min_rows:
                violations.append(violation(
                    "dataset", ds.id, ds.name,
                    f"Dataset has only {ds.row_count} rows (minimum: {min_rows})."
                ))

    elif pt == "no_unscanned_in_pipeline":
        for p in store.list_pipelines():
            if p.dataset_id:
                scan = store.get_latest_compliance_scan(p.dataset_id)
                ds = store.get_dataset(p.dataset_id)
                if scan is None and ds:
                    violations.append(violation(
                        "pipeline", p.id, p.name,
                        f"Source dataset '{ds.name}' has not been scanned for PII."
                    ))

    elif pt == "model_accuracy_floor":
        threshold = params.get("threshold", 0.70)
        for s in store.list_al_sessions():
            if s.status == "complete" and s.rounds:
                last_acc = s.rounds[-1].get("metrics", {}).get("accuracy")
                if last_acc is not None and last_acc < threshold:
                    violations.append(violation(
                        "al_session", s.id, s.name or s.id,
                        f"Model accuracy {last_acc:.2%} is below floor {threshold:.2%}."
                    ))

    elif pt == "benchmark_winner_required":
        for j in store.list_benchmark_jobs():
            if j.status == "complete" and j.winner_candidate_id is None:
                violations.append(violation(
                    "benchmark_job", j.id, j.name or j.id,
                    "Benchmark completed but no winner was determined."
                ))

    return violations


def evaluate_all_policies() -> list[PolicyViolation]:
    all_violations: list[PolicyViolation] = []
    for policy in store.list_compliance_policies():
        if not policy.enabled:
            continue
        store.clear_violations_for_policy(policy.id)
        violations = _evaluate_policy(policy)
        if violations:
            store.upsert_violations(violations)
        all_violations.extend(violations)

    audit_log(
        "compliance.policy_evaluate", "", "", "",
        {"policies_evaluated": len(store.list_compliance_policies()),
         "violations_found": len(all_violations)},
    )
    return all_violations


def compute_risk_score() -> dict:
    """Returns a 0-100 risk score + breakdown dict."""
    datasets = store.list_datasets()
    total_ds = len(datasets)
    if total_ds == 0:
        return {"score": 100, "grade": "A", "breakdown": {}}

    # Component 1: PII exposure (40 pts)
    pii_pts = 40
    critical_ds = sum(1 for ds in datasets
                      if (s := store.get_latest_compliance_scan(ds.id)) and s.overall_risk == "critical")
    high_ds = sum(1 for ds in datasets
                  if (s := store.get_latest_compliance_scan(ds.id)) and s.overall_risk == "high")
    pii_deduction = min(40, (critical_ds * 15 + high_ds * 7))
    pii_score = pii_pts - pii_deduction

    # Component 2: Policy violations (30 pts)
    violations = store.list_violations(resolved=False)
    critical_v = sum(1 for v in violations if v.severity == "critical")
    warning_v = sum(1 for v in violations if v.severity == "warning")
    policy_deduction = min(30, critical_v * 10 + warning_v * 4)
    policy_score = 30 - policy_deduction

    # Component 3: Scan coverage (20 pts)
    scanned = sum(1 for ds in datasets if store.get_latest_compliance_scan(ds.id))
    coverage = scanned / total_ds if total_ds > 0 else 0
    coverage_score = int(20 * coverage)

    # Component 4: Data freshness (10 pts)
    stale = sum(1 for ds in datasets if _days_ago(ds.created_at) > 365)
    freshness_score = max(0, 10 - stale * 3)

    total = pii_score + policy_score + coverage_score + freshness_score

    if total >= 90: grade = "A"
    elif total >= 80: grade = "B+"
    elif total >= 70: grade = "B"
    elif total >= 60: grade = "C"
    elif total >= 50: grade = "D"
    else: grade = "F"

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "pii_exposure": {"score": pii_score, "max": 40, "pct": round((1 - pii_score/40)*100) if pii_score < 40 else 0},
            "policy_failures": {"score": policy_score, "max": 30, "pct": round((1 - policy_score/30)*100) if policy_score < 30 else 0},
            "scan_coverage": {"score": coverage_score, "max": 20, "pct": round((1 - coverage_score/20)*100) if coverage_score < 20 else 0},
            "data_freshness": {"score": freshness_score, "max": 10, "pct": round((1 - freshness_score/10)*100) if freshness_score < 10 else 0},
        },
    }
