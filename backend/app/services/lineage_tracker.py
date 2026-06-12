"""
Lineage tracker — builds a directed acyclic graph from existing store data.
No extra data collection needed; everything is derived from store relationships.

Node types: dataset | pipeline | pipeline_run | synthetic_job | al_session | benchmark_job | marketplace_asset
Edge: { source_id, target_id, label }
"""
from __future__ import annotations
from app.models.store import store

_TYPE_COLORS = {
    "dataset":          "#3b82f6",
    "pipeline":         "#a855f7",
    "pipeline_run":     "#7c3aed",
    "synthetic_job":    "#14b8a6",
    "al_session":       "#22c55e",
    "benchmark_job":    "#f97316",
    "marketplace_asset":"#ec4899",
}


def _ds_node(ds) -> dict:
    scan = store.get_latest_compliance_scan(ds.id)
    return {
        "id": ds.id, "type": "dataset", "label": ds.name,
        "color": _TYPE_COLORS["dataset"],
        "meta": {
            "row_count": ds.row_count, "status": ds.status,
            "size_bytes": ds.size_bytes,
            "pii_risk": scan.overall_risk if scan else "unscanned",
            "created_at": ds.created_at,
        },
    }


def build_full_graph() -> dict:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(n: dict):
        nodes[n["id"]] = n

    def add_edge(src: str, tgt: str, label: str):
        if src in nodes and tgt in nodes:
            edges.append({"id": f"{src}->{tgt}", "source": src, "target": tgt, "label": label})

    # ── Dataset nodes ──────────────────────────────────────────────────
    for ds in store.list_datasets():
        add_node(_ds_node(ds))

    # ── Pipeline nodes + edges ─────────────────────────────────────────
    for p in store.list_pipelines():
        add_node({
            "id": p.id, "type": "pipeline", "label": p.name,
            "color": _TYPE_COLORS["pipeline"],
            "meta": {"step_count": len(p.steps), "status": p.status, "created_at": p.created_at},
        })
        if p.dataset_id and p.dataset_id in nodes:
            add_edge(p.dataset_id, p.id, "source of")

    # Pipeline runs — may produce output datasets
    for r in store.pipeline_runs.values():
        run_id = f"prun_{r.id}"
        add_node({
            "id": run_id, "type": "pipeline_run", "label": f"Run ({r.status})",
            "color": _TYPE_COLORS["pipeline_run"],
            "meta": {"status": r.status, "rows_in": r.rows_in, "rows_out": r.rows_out, "created_at": r.created_at},
        })
        if r.pipeline_id in nodes:
            add_edge(r.pipeline_id, run_id, "executed as")
        if r.output_path:
            # find the output dataset by file_path
            for ds in store.list_datasets():
                if ds.file_path == r.output_path and ds.id in nodes:
                    add_edge(run_id, ds.id, "produces")
                    break

    # ── Synthetic job nodes ────────────────────────────────────────────
    for j in store.list_synthetic_jobs():
        add_node({
            "id": j.id, "type": "synthetic_job", "label": f"Synthetic ({j.method})",
            "color": _TYPE_COLORS["synthetic_job"],
            "meta": {"method": j.method, "row_count": j.row_count, "status": j.status, "created_at": j.created_at},
        })
        if j.source_dataset_id and j.source_dataset_id in nodes:
            add_edge(j.source_dataset_id, j.id, "source of")
        if j.output_dataset_id and j.output_dataset_id in nodes:
            add_edge(j.id, j.output_dataset_id, "generates")

    # ── AL session nodes ───────────────────────────────────────────────
    for s in store.list_al_sessions():
        add_node({
            "id": s.id, "type": "al_session", "label": s.name or f"AL: {s.model_type}",
            "color": _TYPE_COLORS["al_session"],
            "meta": {
                "model_type": s.model_type, "task_type": s.task_type,
                "status": s.status, "rounds": len(s.rounds), "created_at": s.created_at,
                "accuracy": s.rounds[-1].get("metrics", {}).get("accuracy") if s.rounds else None,
            },
        })
        if s.dataset_id and s.dataset_id in nodes:
            add_edge(s.dataset_id, s.id, "trains on")

    # ── Benchmark job nodes ────────────────────────────────────────────
    for j in store.list_benchmark_jobs():
        add_node({
            "id": j.id, "type": "benchmark_job", "label": j.name or "Benchmark",
            "color": _TYPE_COLORS["benchmark_job"],
            "meta": {
                "candidate_count": len(j.candidates), "status": j.status,
                "task_type": j.task_type, "created_at": j.created_at,
            },
        })
        if j.dataset_id and j.dataset_id in nodes:
            add_edge(j.dataset_id, j.id, "evaluated on")

    # ── Marketplace asset installs ─────────────────────────────────────
    for inst in store.list_marketplace_installs():
        asset = store.get_marketplace_asset(inst.asset_id)
        if asset:
            asset_node_id = f"mp_{asset.id}"
            if asset_node_id not in nodes:
                add_node({
                    "id": asset_node_id, "type": "marketplace_asset",
                    "label": asset.title,
                    "color": _TYPE_COLORS["marketplace_asset"],
                    "meta": {"asset_type": asset.asset_type, "author": asset.author_name},
                })
            if inst.resulting_id in nodes:
                add_edge(asset_node_id, inst.resulting_id, "installed as")

    return {"nodes": list(nodes.values()), "edges": edges}


def build_dataset_graph(dataset_id: str) -> dict:
    """Return the subgraph reachable from a given dataset (upstream + downstream)."""
    full = build_full_graph()
    all_nodes = {n["id"]: n for n in full["nodes"]}
    all_edges = full["edges"]

    if dataset_id not in all_nodes:
        return {"nodes": [], "edges": [], "impact": []}

    # BFS in both directions
    related: set[str] = {dataset_id}
    queue = [dataset_id]
    while queue:
        nid = queue.pop()
        for e in all_edges:
            neighbor = None
            if e["source"] == nid and e["target"] not in related:
                neighbor = e["target"]
            elif e["target"] == nid and e["source"] not in related:
                neighbor = e["source"]
            if neighbor:
                related.add(neighbor)
                queue.append(neighbor)

    nodes = [all_nodes[n] for n in related if n in all_nodes]
    edges = [e for e in all_edges if e["source"] in related and e["target"] in related]

    # Impact analysis — downstream only
    downstream: set[str] = set()
    queue = [dataset_id]
    visited = {dataset_id}
    while queue:
        nid = queue.pop()
        for e in all_edges:
            if e["source"] == nid and e["target"] not in visited:
                visited.add(e["target"])
                downstream.add(e["target"])
                queue.append(e["target"])

    impact = [
        {"id": nid, "type": all_nodes[nid]["type"], "label": all_nodes[nid]["label"]}
        for nid in downstream if nid in all_nodes
    ]

    return {"nodes": nodes, "edges": edges, "impact": impact}
