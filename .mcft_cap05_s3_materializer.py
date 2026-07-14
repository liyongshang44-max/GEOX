# .mcft_cap05_s3_materializer.py
# Purpose: materialize the bounded MCFT-CAP-05 S3 candidate into current governance SSOT files before the temporary script deletes itself.
# Boundary: deterministic repository-file transformation only; no database, Runtime, network, route, web or capability-completion claim.

from __future__ import annotations

import json
from pathlib import Path

BASELINE = "651878f63a704f78503acb8565087d7f980ada5a"
BRANCH = "agent/mcft-cap-05-s3-persistence-idempotency-recovery-v1"
S2 = "MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1"
S3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1"
S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1"
BOUNDARY = [
    "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
    "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
    "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S3-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S3_PERSISTENCE_RECOVERY.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
]


def read_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: str, value: dict) -> None:
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def require_one(items: list[dict], key: str, value: str) -> dict:
    matches = [item for item in items if item.get(key) == value]
    if len(matches) != 1:
        raise SystemExit(f"expected exactly one {key}={value}, found {len(matches)}")
    return matches[0]


matrix_path = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
matrix = read_json(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S2 merged-main effective; S3 PostgreSQL persistence, idempotency and canonical-recovery candidate",
}
cap05 = require_one(matrix["capability_lines"], "capability_line_id", "MCFT-CAP-05")
cap05["status"] = "IN_PROGRESS"
cap05["implementation_status"] = "S3_IMPLEMENTATION_CANDIDATE"
cap05["active_delivery_slice_id"] = S3
cap05["runtime_source_authorized"] = True
cap05["latest_effective_slice_id"] = S2
cap05["latest_effective_main_commit"] = BASELINE
cap05["next_authorized_slice_ids"] = []
cap05["successor_authorized"] = False
s2_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S2)
s2_matrix["status"] = "MERGED_EFFECTIVE"
s2_matrix["merge_commit"] = BASELINE
s2_matrix["merged_main_gate_workflow"] = 29309185464
s2_matrix["effectiveness_condition_satisfied"] = True
s3_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S3)
s3_matrix.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "migration_count": 1,
    "canonical_store": "public.facts",
    "postgresql_acceptance_workflow": 29309606079,
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S3_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S3_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(matrix_path, matrix)


delivery_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
delivery = read_json(delivery_path)
delivery["status"] = "S3_IMPLEMENTATION_CANDIDATE"
delivery["baseline_main_commit"] = BASELINE
delivery["branch"] = BRANCH
delivery["active_delivery_slice_id"] = S3
delivery["runtime_source_authorized"] = True
s2_delivery = require_one(delivery["slices"], "delivery_slice_id", S2)
s2_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "effectiveness_condition_satisfied": True,
    "exact_head": "ce2ec8b627b628977e7a31e0a1bcb630fffb5dfd",
    "materialization_workflow": 29309046407,
    "exact_head_workflow": 29309103415,
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": 29309185464,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s3_delivery = require_one(delivery["slices"], "delivery_slice_id", S3)
s3_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "G_H_C_POSTGRESQL_PERSISTENCE_PRIMITIVES_ESTABLISHED",
        "CAP05_IDEMPOTENCY_AND_CONFLICT_GUARDS_ESTABLISHED",
        "CAP05_REBUILDABLE_PROJECTIONS_ESTABLISHED",
        "APPROVED_PLAN_BINDING_PROJECTION_ESTABLISHED",
        "FACTS_BASED_CANONICAL_RECOVERY_ESTABLISHED",
    ],
    "preserved_nonclaims": [
        "NO_HUMAN_DECISION_RUNTIME_FLOW",
        "NO_APPROVAL_AUTHORITY",
        "NO_ACTION_FEEDBACK_NORMALIZATION_WORKFLOW",
        "NO_RECEIPT_CONSUMING_STATE_TICK",
        "NO_FORECAST_EXECUTION",
        "NO_RESIDUAL_MATCHING_ORCHESTRATION",
        "NO_ROUTE",
        "NO_WEB",
        "NO_RECOMMENDATION",
        "NO_AO_ACT_CHANGE",
        "NO_CALIBRATION_CANDIDATE",
        "NO_MODEL_ACTIVATION",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "exact_changed_file_boundary": BOUNDARY,
    "migration_count": 1,
    "postgresql_acceptance_workflow": 29309606079,
    "effectiveness_condition": "S3_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S3_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(delivery_path, delivery)


authorization_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
authorization = read_json(authorization_path)
authorization["implementation_status"] = "S3_IMPLEMENTATION_CANDIDATE"
authorization["baseline_main_commit"] = BASELINE
authorization["branch"] = BRANCH
authorization["active_delivery_slice_id"] = S3
authorization["repository_write_scope"] = "S3_PERSISTENCE_IDEMPOTENCY_RECOVERY"
authorization["s2_effectiveness"] = {
    "pr_number": 2441,
    "exact_head": "ce2ec8b627b628977e7a31e0a1bcb630fffb5dfd",
    "materialization_workflow": 29309046407,
    "exact_head_workflow": 29309103415,
    "merge_commit": BASELINE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": 2443,
    "merged_main_gate_workflow": 29309185464,
    "merged_main_gate": "PASS",
    "effective": True,
}
authorization["s3_candidate"] = {
    "delivery_slice_id": S3,
    "migration_count": 1,
    "canonical_store": "public.facts",
    "postgresql_acceptance_workflow": 29309606079,
    "effectiveness_condition_satisfied": False,
}
authorization["preserved_nonclaims"] = [
    "NO_HUMAN_DECISION_RUNTIME_FLOW",
    "NO_APPROVAL_AUTHORITY",
    "NO_ACTION_FEEDBACK_NORMALIZATION_WORKFLOW",
    "NO_RECEIPT_CONSUMING_STATE_TICK",
    "NO_FORECAST_EXECUTION",
    "NO_RESIDUAL_MATCHING_ORCHESTRATION",
    "NO_ROUTE",
    "NO_WEB",
    "NO_AO_ACT_CHANGE",
    "NO_RECOMMENDATION",
    "NO_CALIBRATION_CANDIDATE",
    "NO_MODEL_ACTIVATION",
    "NO_CONTINUOUS_RUNTIME",
    "NO_LIVE_FIELD_CLAIM",
    "NO_CAP_06_AUTHORIZATION",
    "NO_MCFT_GATE_A_CLOSURE",
    "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]
authorization["exact_changed_file_boundary"] = BOUNDARY
authorization["next_authorized_slice_id_after_effectiveness"] = S4
authorization["successor_authorized"] = False
write_json(authorization_path, authorization)


status_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S3-STATUS.json"
status = read_json(status_path)
status["next_delivery_slice_id"] = S4
status["exact_changed_file_boundary"] = BOUNDARY
write_json(status_path, status)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
if "S3 PostgreSQL acceptance workflow:" not in task:
    marker = "# 27. S3 — Persistence and Recovery"
    if marker not in task:
        raise SystemExit("S3 task marker missing")
    block = f'''{marker}\n\nS3 implementation candidate identity：\n\n```text\nbaseline_main_commit:\n{BASELINE}\n\nS2 exact head:\nce2ec8b627b628977e7a31e0a1bcb630fffb5dfd\n\nS2 merge commit:\n{BASELINE}\n\nS2 merged-main Gate workflow:\n29309185464 SUCCESS\n\nactive_delivery_slice_id:\n{S3}\n\nS3 status:\nIMPLEMENTATION_CANDIDATE\n\nS3 PostgreSQL acceptance workflow:\n29309606079 SUCCESS\n\nmigration count:\n1\n\ncanonical store:\npublic.facts\n\nS4 authorized:\nfalse\n```\n'''
    task = task.replace(marker, block, 1)
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S3 Persistence / Idempotency / Recovery Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S3}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\npostgresql_acceptance_workflow: 29309606079 SUCCESS\ncanonical_store: public.facts\nmigration_count: 1\nnew_canonical_object_types: 0\nnew_transaction_families: 0\nS4_authorized: false\nCAP_06_authorized: false\n```\n\nEstablished candidate scope:\n\n- reuse `G_HUMAN_DECISION_LINK_COMMIT`, `H_ACTION_FEEDBACK_COMMIT`, and `C_FORECAST_RESIDUAL_COMMIT`;\n- append canonical objects only to `public.facts`;\n- reuse `twin_object_idempotency_index_v1` with bounded G/H/C identity kinds;\n- maintain mutable Decision, Action Feedback, Evidence-link, Forecast Residual, Approved Plan binding, and complete feedback-cycle projections;\n- delete and rebuild CAP-05 guards/projections from canonical facts and graph refs;\n- create no business-flow service, State Tick, route, Recommendation, AO-ACT change, calibration candidate, activation, or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")
