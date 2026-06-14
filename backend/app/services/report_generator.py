"""
Compliance report generator.
Produces JSON + HTML reports for GDPR, CCPA, HIPAA, General Summary, and Custom.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from app.models.store import store, ComplianceReport
from app.core.config import DATA_DIR
from app.services.compliance_checker import compute_risk_score
from app.services.audit_logger import log as audit_log

REPORTS_DIR = DATA_DIR / "compliance_reports"
REPORTS_DIR.mkdir(exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(iso: str) -> float:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds() / 86400
    except Exception:
        return 0.0


# ── Data gatherers ────────────────────────────────────────────────────

def _gather_dataset_inventory() -> list[dict]:
    rows = []
    for ds in store.list_datasets():
        scan = store.get_latest_compliance_scan(ds.id)
        rows.append({
            "id": ds.id,
            "name": ds.name,
            "row_count": ds.row_count,
            "column_count": ds.column_count,
            "size_bytes": ds.size_bytes,
            "status": ds.status,
            "pii_risk": scan.overall_risk if scan else "unscanned",
            "pii_columns": scan.pii_column_count if scan else None,
            "critical_columns": scan.critical_count if scan else None,
            "quality_score": ds.latest_score,
            "age_days": round(_days_ago(ds.created_at), 1),
            "created_at": ds.created_at,
        })
    return rows


def _gather_pii_findings() -> list[dict]:
    rows = []
    for scan in store.list_compliance_scans():
        if scan.status != "complete":
            continue
        ds = store.get_dataset(scan.dataset_id)
        for finding in scan.findings:
            rows.append({
                "dataset_id": scan.dataset_id,
                "dataset_name": ds.name if ds else scan.dataset_id,
                "column": finding["column"],
                "pii_category": finding["pii_category"],
                "severity": finding["severity"],
                "confidence": finding["confidence"],
                "detection_method": finding["detection_method"],
                "suggested_methods": finding.get("suggested_methods", []),
            })
    return rows


def _gather_policy_status() -> list[dict]:
    rows = []
    violations = store.list_violations(resolved=False)
    viol_by_policy: dict[str, list] = {}
    for v in violations:
        viol_by_policy.setdefault(v.policy_id, []).append(v)

    for policy in store.list_compliance_policies():
        v_list = viol_by_policy.get(policy.id, [])
        rows.append({
            "id": policy.id,
            "name": policy.name,
            "type": policy.policy_type,
            "enabled": policy.enabled,
            "severity": policy.severity,
            "status": "pass" if not v_list else "fail",
            "violation_count": len(v_list),
            "violations": [{"entity": v.entity_name, "message": v.message} for v in v_list[:5]],
        })
    return rows


def _gather_lineage_summary() -> dict:
    from app.services.lineage_tracker import build_full_graph
    graph = build_full_graph()
    type_counts: dict[str, int] = {}
    for n in graph["nodes"]:
        type_counts[n["type"]] = type_counts.get(n["type"], 0) + 1
    return {
        "total_nodes": len(graph["nodes"]),
        "total_edges": len(graph["edges"]),
        "node_types": type_counts,
    }


def _gather_audit_excerpt(limit: int = 50) -> list[dict]:
    events = store.list_audit_events(category="compliance", limit=limit)
    return [
        {
            "event_type": e.event_type,
            "entity_name": e.entity_name,
            "created_at": e.created_at,
            "metadata": e.metadata,
        }
        for e in events
    ]


def _recommendations(datasets: list[dict], pii: list[dict], policies: list[dict]) -> list[str]:
    recs = []
    unscanned = [d for d in datasets if d["pii_risk"] == "unscanned"]
    if unscanned:
        recs.append(f"Scan {len(unscanned)} unscanned dataset(s) for PII exposure.")
    critical_pii = [p for p in pii if p["severity"] == "critical"]
    if critical_pii:
        ds_names = list({p["dataset_name"] for p in critical_pii})[:3]
        recs.append(f"Anonymize critical PII columns in: {', '.join(ds_names)}.")
    failing = [p for p in policies if p["status"] == "fail" and p["severity"] == "critical"]
    if failing:
        recs.append(f"Resolve {len(failing)} critical policy violation(s) immediately.")
    old = [d for d in datasets if d["age_days"] > 365]
    if old:
        recs.append(f"Review {len(old)} dataset(s) older than 1 year for retention compliance.")
    if not recs:
        recs.append("No immediate actions required. Continue regular PII scanning.")
    return recs


# ── HTML template ─────────────────────────────────────────────────────

def _render_html(data: dict, framework: str) -> str:
    risk = data["risk"]
    grade_color = {"A": "#22c55e", "B+": "#84cc16", "B": "#eab308",
                   "C": "#f97316", "D": "#ef4444", "F": "#dc2626"}.get(risk["grade"], "#94a3b8")

    datasets_rows = "".join(
        f"<tr><td>{d['name']}</td><td>{d['row_count'] or '—'}</td>"
        f"<td><span class='badge {d['pii_risk']}'>{d['pii_risk'].upper()}</span></td>"
        f"<td>{d['quality_score']:.2f if d['quality_score'] else '—'}</td>"
        f"<td>{d['age_days']} days</td></tr>"
        for d in data.get("dataset_inventory", [])
    )

    pii_rows = "".join(
        f"<tr><td>{p['dataset_name']}</td><td>{p['column']}</td>"
        f"<td><span class='badge {p['severity']}'>{p['severity'].upper()}</span></td>"
        f"<td>{p['pii_category']}</td><td>{p['confidence']:.0%}</td></tr>"
        for p in data.get("pii_findings", [])[:50]
    )

    policy_rows = "".join(
        f"<tr><td>{p['name']}</td>"
        f"<td><span class='badge {'pass' if p['status']=='pass' else 'critical'}'>{p['status'].upper()}</span></td>"
        f"<td>{p['violation_count']}</td><td>{p['severity']}</td></tr>"
        for p in data.get("policy_status", [])
    )

    recs_html = "".join(f"<li>{r}</li>" for r in data.get("recommendations", []))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Datrix Compliance Report — {framework.upper()}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 960px; margin: 40px auto; color: #1e293b; padding: 0 20px; }}
  h1 {{ font-size: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }}
  h2 {{ font-size: 1.1rem; color: #475569; margin-top: 2rem; }}
  .score {{ display: inline-block; width: 64px; height: 64px; border-radius: 50%; background: {grade_color}22; border: 3px solid {grade_color}; text-align: center; line-height: 58px; font-size: 1.4rem; font-weight: 700; color: {grade_color}; margin-right: 16px; }}
  .kpi {{ display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; margin: 4px; min-width: 120px; text-align: center; }}
  .kpi-val {{ font-size: 1.4rem; font-weight: 700; }}
  .kpi-lbl {{ font-size: 0.75rem; color: #64748b; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85rem; }}
  th {{ background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; }}
  td {{ padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }}
  .badge {{ padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }}
  .badge.critical {{ background: #fee2e2; color: #dc2626; }}
  .badge.high {{ background: #ffedd5; color: #ea580c; }}
  .badge.medium {{ background: #fef9c3; color: #ca8a04; }}
  .badge.low {{ background: #dbeafe; color: #2563eb; }}
  .badge.clean {{ background: #dcfce7; color: #16a34a; }}
  .badge.unscanned {{ background: #f1f5f9; color: #64748b; }}
  .badge.pass {{ background: #dcfce7; color: #16a34a; }}
  .badge.fail, .badge.FAIL {{ background: #fee2e2; color: #dc2626; }}
  .recs {{ background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; }}
  .recs li {{ margin: 6px 0; color: #1e40af; }}
  footer {{ margin-top: 40px; color: #94a3b8; font-size: 0.8rem; border-top: 1px solid #e2e8f0; padding-top: 12px; }}
</style>
</head>
<body>
<h1>Datrix Compliance Report — {framework.upper()}</h1>
<p>Generated: {data['generated_at']} &nbsp;|&nbsp; Framework: {framework.upper()}</p>

<h2>Executive Summary</h2>
<div>
  <span class="score">{risk['grade']}</span>
  <div class="kpi"><div class="kpi-val">{risk['score']}/100</div><div class="kpi-lbl">Risk Score</div></div>
  <div class="kpi"><div class="kpi-val">{data.get('total_datasets', 0)}</div><div class="kpi-lbl">Datasets</div></div>
  <div class="kpi"><div class="kpi-val">{data.get('total_pii_findings', 0)}</div><div class="kpi-lbl">PII Findings</div></div>
  <div class="kpi"><div class="kpi-val">{data.get('total_violations', 0)}</div><div class="kpi-lbl">Violations</div></div>
</div>

<h2>Recommendations</h2>
<div class="recs"><ul>{recs_html}</ul></div>

<h2>Dataset Inventory</h2>
<table><thead><tr><th>Name</th><th>Rows</th><th>PII Risk</th><th>Quality</th><th>Age</th></tr></thead>
<tbody>{datasets_rows}</tbody></table>

<h2>PII Findings</h2>
<table><thead><tr><th>Dataset</th><th>Column</th><th>Severity</th><th>Category</th><th>Confidence</th></tr></thead>
<tbody>{pii_rows if pii_rows else '<tr><td colspan="5" style="color:#94a3b8">No PII findings detected.</td></tr>'}</tbody></table>

<h2>Policy Compliance Status</h2>
<table><thead><tr><th>Policy</th><th>Status</th><th>Violations</th><th>Severity</th></tr></thead>
<tbody>{policy_rows if policy_rows else '<tr><td colspan="4" style="color:#94a3b8">No policies configured.</td></tr>'}</tbody></table>

<footer>Generated by Datrix &nbsp;·&nbsp; Running locally &nbsp;·&nbsp; All data stays on your machine</footer>
</body></html>"""


# ── Main entry point ──────────────────────────────────────────────────

def generate_report(framework: str, sections: list[str]) -> ComplianceReport:
    report = ComplianceReport(framework=framework, sections=sections, status="pending")
    store.add_compliance_report(report)

    try:
        risk = compute_risk_score()
        data: dict = {
            "framework": framework,
            "sections": sections,
            "generated_at": _now(),
            "risk": risk,
        }

        datasets = _gather_dataset_inventory()
        pii = _gather_pii_findings()
        policies = _gather_policy_status()

        if "dataset_inventory" in sections or framework in ("gdpr", "ccpa", "hipaa", "general"):
            data["dataset_inventory"] = datasets
        if "pii_findings" in sections or framework in ("gdpr", "ccpa", "hipaa", "general"):
            data["pii_findings"] = pii
        if "policy_status" in sections or framework in ("general",):
            data["policy_status"] = policies
        if "lineage_summary" in sections:
            data["lineage_summary"] = _gather_lineage_summary()
        if "audit_excerpt" in sections:
            data["audit_excerpt"] = _gather_audit_excerpt()
        if "recommendations" in sections or framework == "general":
            data["recommendations"] = _recommendations(datasets, pii, policies)

        data["total_datasets"] = len(datasets)
        data["total_pii_findings"] = len(pii)
        data["total_violations"] = sum(1 for p in policies if p["status"] == "fail")

        report_id = report.id
        json_path = REPORTS_DIR / f"{report_id}.json"
        html_path = REPORTS_DIR / f"{report_id}.html"

        json_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        html_path.write_text(_render_html(data, framework), encoding="utf-8")

        report.status = "complete"
        report.entity_count = len(datasets)
        report.findings_count = len(pii)
        report.violation_count = data["total_violations"]
        report.risk_score = risk["score"]
        report.file_path = str(json_path)

    except Exception as exc:
        report.status = "failed"
        report.error_message = str(exc)

    store.update_compliance_report(report)

    audit_log(
        "compliance.report_generate", "compliance_report", report.id,
        f"{framework.upper()} Report",
        {"framework": framework, "status": report.status, "sections": sections},
    )
    return report
