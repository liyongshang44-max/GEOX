from __future__ import annotations

import json
from pathlib import Path

BASELINE = "7f2f2bec144cee4d90608c3a25c3dc7cac9f9189"
BRANCH = "agent/mcft-cap-05-s5-approval-plan-evidence-binding-v1"
S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
BOUNDARY = [
    "apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
    "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
    "apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-EVIDENCE.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
]
S4_EFFECTIVENESS = {
    "pr_number": 2447,
    "exact_head": "e9f3b81e2aa8b68498263049086d79184ead6108",
    "materialization_workflow": 29311491031,
    "exact_head_workflow": 29311611506,
    "merge_commit": BASELINE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": 2449,
    "merged_main_gate_workflow": 29311761419,
    "merged_main_gate": "PASS",
    "effective": True,
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def require_single(items, predicate, label: str):
    matches = [item for item in items if predicate(item)]
    if len(matches) != 1:
        raise SystemExit(f"{label}_CARDINALITY:{len(matches)}")
    return matches[0]


status_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json")
status = read_json(status_path)
if status.get("delivery_slice_id") != S5:
    raise SystemExit("S5_STATUS_IDENTITY_MISMATCH")
if sorted(status.get("exact_changed_file_boundary", [])) != sorted(BOUNDARY):
    raise SystemExit("S5_STATUS_BOUNDARY_MISMATCH")


authorization_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json")
authorization = read_json(authorization_path)
authorization.update({
    "implementation_status": "S5_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S5,
    "repository_write_scope": "S5_APPROVAL_ASSERTION_AND_APPROVED_PLAN_REPLAY_EVIDENCE_BINDING",
    "exact_changed_file_boundary": BOUNDARY,
    "next_authorized_slice_id_after_effectiveness": S6,
})
authorization["s4_effectiveness"] = S4_EFFECTIVENESS
authorization["s5_candidate"] = {
    "delivery_slice_id": S5,
    "service_id": "MCFT_CAP_05_APPROVAL_PLAN_EVIDENCE_BINDING_SERVICE_V1",
    "approval_assertion_record_type": "approval_assertion_evidence_v1",
    "approved_plan_record_type": "approved_irrigation_plan_snapshot_v1",
    "postgresql_acceptance_workflow": 29312412661,
    "canonical_object_delta": 0,
    "transaction_family_delta": 0,
    "migration_delta": 0,
    "effectiveness_condition_satisfied": False,
}
authorization["preserved_nonclaims"] = [
    "NO_GEOX_APPROVAL_REQUEST",
    "NO_GEOX_APPROVAL_AUTHORITY",
    "NO_GEOX_DISPATCH_CREATION",
    "NO_NEW_CANONICAL_TWIN_OBJECT",
    "NO_NEW_TRANSACTION_FAMILY",
    "NO_MIGRATION",
    "NO_PUBLIC_ROUTE",
    "NO_RECOMMENDATION",
    "NO_TASK_WRITE",
    "NO_ACTION_FEEDBACK_WRITE",
    "NO_STATE_OR_CHECKPOINT_MUTATION",
    "NO_FORECAST_EXECUTION",
    "NO_RESIDUAL_MATCHING_ORCHESTRATION",
    "NO_AO_ACT_CHANGE",
    "NO_CALIBRATION_CANDIDATE",
    "NO_MODEL_ACTIVATION",
    "NO_CONTINUOUS_RUNTIME",
    "NO_LIVE_FIELD_CLAIM",
    "NO_CAP_06_AUTHORIZATION",
    "NO_MCFT_GATE_A_CLOSURE",
    "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]
write_json(authorization_path, authorization)


delivery_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json")
delivery = read_json(delivery_path)
delivery.update({
    "status": "S5_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S5,
})
s4_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S4, "S4_DELIVERY")
s4_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "effectiveness_condition_satisfied": True,
    "exact_head": S4_EFFECTIVENESS["exact_head"],
    "materialization_workflow": S4_EFFECTIVENESS["materialization_workflow"],
    "exact_head_workflow": S4_EFFECTIVENESS["exact_head_workflow"],
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": S4_EFFECTIVENESS["merged_main_gate_workflow"],
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s5_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S5, "S5_DELIVERY")
s5_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "APPROVAL_ASSERTION_REPLAY_EVIDENCE_BINDING_ESTABLISHED",
        "APPROVED_PLAN_REPLAY_EVIDENCE_BINDING_ESTABLISHED",
        "SCENARIO_AND_APPROVED_AMOUNT_SEPARATION_ESTABLISHED",
        "EXPLICIT_DISPATCH_DISPOSITION_VALIDATION_ESTABLISHED",
        "PLAN_SUPERSESSION_PROJECTION_ESTABLISHED",
        "PLAN_SUPERSESSION_FACTS_BASED_RECOVERY_ESTABLISHED",
    ],
    "preserved_nonclaims": status["preserved_nonclaims"],
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S5_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5_GATE_PASS",
    "effectiveness_condition_satisfied": False,
    "postgresql_acceptance_workflow": 29312412661,
    "approval_assertion_fact_delta": 1,
    "approved_plan_fact_delta_after_supersession": 2,
    "canonical_twin_object_delta": 0,
    "transaction_family_delta": 0,
    "migration_count": 0,
})
s6_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S6, "S6_DELIVERY")
if s6_delivery.get("status") != "BLOCKED":
    raise SystemExit("S6_MUST_REMAIN_BLOCKED")
write_json(delivery_path, delivery)


matrix_path = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
matrix = read_json(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S4 merged-main effective; S5 Approval Assertion and Approved Plan Replay Evidence binding candidate",
}
cap05 = require_single(matrix["capability_lines"], lambda item: item.get("capability_line_id") == "MCFT-CAP-05", "CAP05_MATRIX")
cap05.update({
    "status": "IN_PROGRESS",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "implementation_status": "S5_IMPLEMENTATION_CANDIDATE",
    "active_delivery_slice_id": S5,
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "next_authorized_slice_ids": [],
})
cap05_s4 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S4, "CAP05_MATRIX_S4")
cap05_s4.update({
    "status": "MERGED_EFFECTIVE",
    "merge_commit": BASELINE,
    "effectiveness_condition_satisfied": True,
})
cap05_s5 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S5, "CAP05_MATRIX_S5")
cap05_s5.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "effectiveness_condition": "S5_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(matrix_path, matrix)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
if "S5 PostgreSQL acceptance workflow:" not in task:
    marker = "## S5 — Approval Assertion and Approved Plan Evidence Binding"
    if marker not in task:
        raise SystemExit("S5_TASK_MARKER_MISSING")
    block = f'''{marker}\n\nS5 implementation candidate identity：\n\n```text\nbaseline_main_commit:\n{BASELINE}\n\nS4 exact head:\ne9f3b81e2aa8b68498263049086d79184ead6108\n\nS4 merge commit:\n{BASELINE}\n\nS4 merged-main Gate workflow:\n29311761419 SUCCESS\n\nactive_delivery_slice_id:\n{S5}\n\nS5 status:\nIMPLEMENTATION_CANDIDATE\n\nS5 PostgreSQL acceptance workflow:\n29312412661 SUCCESS\n\napproval_assertion_evidence fact delta:\n1\n\napproved_plan_evidence fact delta after supersession:\n2\n\ncanonical Twin object delta:\n0\n\ntransaction family delta:\n0\n\nmigration delta:\n0\n\nS6 authorized:\nfalse\n```\n'''
    task = task.replace(marker, block, 1)
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S5 Approval Assertion and Approved Plan Evidence Binding Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S5}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\npostgresql_acceptance_workflow: 29312412661 SUCCESS\napproval_assertion_record_type: approval_assertion_evidence_v1\napproved_plan_record_type: approved_irrigation_plan_snapshot_v1\ncanonical_object_delta: 0\ntransaction_family_delta: 0\nmigration_delta: 0\nS6_authorized: false\nCAP_06_authorized: false\n```\n\nEstablished candidate scope:\n\n- validate controlled Human Approval Assertion Replay Evidence without exercising GEOX approval authority;\n- bind Assertion and Approved Plan Evidence to the unique canonical S4 G Decision;\n- derive scenario amount from the selected canonical Scenario option while preserving the distinct approved amount;\n- validate explicit dispatch disposition and externally recorded Dispatch Evidence without creating dispatch;\n- append Assertion and Plan as immutable facts with deterministic identity and response-loss idempotency;\n- maintain exactly one active Plan projection through explicit supersession;\n- rebuild Plan projections and supersession state from immutable facts;\n- create no canonical Twin object, transaction family, migration, route, Recommendation, Task, Action Feedback, State/checkpoint, Forecast, Residual, AO-ACT, calibration, activation or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")

print("MCFT-CAP-05 S5 SSOT materialization complete")
