from __future__ import annotations

import json
from pathlib import Path

BASELINE = "ef1c789b15a3e73f93c7e63907519faecb027563"
BRANCH = "agent/mcft-cap-05-s6-action-feedback-h-adapter-v1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1"
BOUNDARY = [
    "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
    "apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts",
    "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts",
]
S5_EFFECTIVENESS = {
    "pr_number": 2451,
    "exact_head": "77a4f66741d0c5dab59a4cb0ac4ff91d7916d17d",
    "materialization_workflow": 29312814297,
    "exact_head_workflow": 29312941309,
    "merge_commit": BASELINE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": 2455,
    "merged_main_gate_workflow": 29313112424,
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


status_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json")
status = read_json(status_path)
if status.get("delivery_slice_id") != S6:
    raise SystemExit("S6_STATUS_IDENTITY_MISMATCH")
if sorted(status.get("exact_changed_file_boundary", [])) != sorted(BOUNDARY):
    raise SystemExit("S6_STATUS_BOUNDARY_MISMATCH")


authorization_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json")
authorization = read_json(authorization_path)
authorization.update({
    "implementation_status": "S6_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S6,
    "repository_write_scope": "S6_RECEIPT_TO_ACTION_FEEDBACK_H_AND_EXECUTED_IRRIGATION_ADAPTER",
    "exact_changed_file_boundary": BOUNDARY,
    "next_authorized_slice_id_after_effectiveness": S7,
})
authorization["s5_effectiveness"] = S5_EFFECTIVENESS
authorization["s6_candidate"] = {
    "delivery_slice_id": S6,
    "service_id": "MCFT_CAP_05_ACTION_FEEDBACK_NORMALIZATION_SERVICE_V1",
    "canonical_object_type": "twin_action_feedback_v1",
    "transaction_family": "H_ACTION_FEEDBACK_COMMIT",
    "postgresql_acceptance_workflow": 29313657871,
    "canonical_action_feedback_fact_delta_standard_case": 1,
    "migration_delta": 0,
    "effectiveness_condition_satisfied": False,
}
authorization["preserved_nonclaims"] = status["preserved_nonclaims"] + [
    "NO_MCFT_GATE_A_CLOSURE",
    "NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM",
]
write_json(authorization_path, authorization)


delivery_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json")
delivery = read_json(delivery_path)
delivery.update({
    "status": "S6_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S6,
})
s5_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S5, "S5_DELIVERY")
s5_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "effectiveness_condition_satisfied": True,
    "exact_head": S5_EFFECTIVENESS["exact_head"],
    "materialization_workflow": S5_EFFECTIVENESS["materialization_workflow"],
    "exact_head_workflow": S5_EFFECTIVENESS["exact_head_workflow"],
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": S5_EFFECTIVENESS["merged_main_gate_workflow"],
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s6_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S6, "S6_DELIVERY")
s6_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "CONTROLLED_RECEIPT_EVIDENCE_NORMALIZATION_ESTABLISHED",
        "H_ACTION_FEEDBACK_COMMIT_ESTABLISHED",
        "ACTION_FEEDBACK_RESPONSE_LOSS_RETRY_ESTABLISHED",
        "EXECUTION_VALIDATION_QUALITY_MAPPING_ESTABLISHED",
        "COVERED_FOOTPRINT_AMOUNT_VALIDATION_ESTABLISHED",
        "ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_ADAPTER_ESTABLISHED",
        "SAME_HOUR_AND_LATE_NO_SHIFT_GUARDS_ESTABLISHED",
        "SINGLE_ELIGIBLE_EVENT_GUARD_ESTABLISHED",
        "DEPTH_MM_ONLY_NO_VOLUME_CONVERSION_ESTABLISHED",
    ],
    "preserved_nonclaims": status["preserved_nonclaims"],
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS",
    "effectiveness_condition_satisfied": False,
    "postgresql_acceptance_workflow": 29313657871,
    "canonical_action_feedback_fact_delta_standard_case": 1,
    "transaction_family": "H_ACTION_FEEDBACK_COMMIT",
    "migration_count": 0,
})
s7_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S7, "S7_DELIVERY")
if s7_delivery.get("status") != "BLOCKED":
    raise SystemExit("S7_MUST_REMAIN_BLOCKED")
write_json(delivery_path, delivery)


matrix_path = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
matrix = read_json(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S5 merged-main effective; S6 Receipt-to-H Action Feedback and executed-irrigation adapter candidate",
}
cap05 = require_single(matrix["capability_lines"], lambda item: item.get("capability_line_id") == "MCFT-CAP-05", "CAP05_MATRIX")
cap05.update({
    "status": "IN_PROGRESS",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "implementation_status": "S6_IMPLEMENTATION_CANDIDATE",
    "active_delivery_slice_id": S6,
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "next_authorized_slice_ids": [],
})
cap05_s5 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S5, "CAP05_MATRIX_S5")
cap05_s5.update({
    "status": "MERGED_EFFECTIVE",
    "merge_commit": BASELINE,
    "effectiveness_condition_satisfied": True,
})
cap05_s6 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S6, "CAP05_MATRIX_S6")
cap05_s6.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "effectiveness_condition": "S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(matrix_path, matrix)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
if "S6 PostgreSQL acceptance workflow:" not in task:
    marker = "## S6 — Action Feedback and Adapter"
    if marker not in task:
        raise SystemExit("S6_TASK_MARKER_MISSING")
    block = f'''{marker}\n\nS6 implementation candidate identity：\n\n```text\nbaseline_main_commit:\n{BASELINE}\n\nS5 exact head:\n77a4f66741d0c5dab59a4cb0ac4ff91d7916d17d\n\nS5 merge commit:\n{BASELINE}\n\nS5 merged-main Gate workflow:\n29313112424 SUCCESS\n\nactive_delivery_slice_id:\n{S6}\n\nS6 status:\nIMPLEMENTATION_CANDIDATE\n\nS6 PostgreSQL acceptance workflow:\n29313657871 SUCCESS\n\ncanonical Action Feedback fact delta standard case:\n1\n\ntransaction family:\nH_ACTION_FEEDBACK_COMMIT\n\nstandard actual amount mm:\n13.600000\n\nstandard coverage fraction:\n0.910000\n\nstandard target-scope equivalent irrigation mm:\n12.376000\n\nmigration delta:\n0\n\nS7 authorized:\nfalse\n```\n'''
    task = task.replace(marker, block, 1)
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S6 Action Feedback H Commit and Adapter Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S6}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\npostgresql_acceptance_workflow: 29313657871 SUCCESS\ncanonical_object_type: twin_action_feedback_v1\ntransaction_family: H_ACTION_FEEDBACK_COMMIT\nstandard_actual_amount_mm: 13.600000\nstandard_spatial_coverage_fraction: 0.910000\nstandard_target_scope_equivalent_irrigation_mm: 12.376000\nmigration_delta: 0\nS7_authorized: false\nCAP_06_authorized: false\n```\n\nEstablished candidate scope:\n\n- read one exact controlled irrigation Receipt Evidence ref/hash from `public.facts`;\n- validate source/canonical payload identity, exact Reality scope, depth-mm unit, same-hour execution, role-time order and covered-footprint amount;\n- resolve the active S5 Approved Plan and unique canonical S4 G Decision from PostgreSQL readback;\n- validate optional external Dispatch Evidence without creating dispatch;\n- map execution, validation and quality independently;\n- build and commit canonical `twin_action_feedback_v1` through the existing H transaction and S3 persistence repository;\n- preserve execution logical time for late Evidence and return exact existing H object on response-loss retry;\n- adapt eligible H feedback into the existing executed-irrigation candidate while preserving raw amount and coverage;\n- apply coverage exactly once in the existing irrigation aggregator;\n- reject multiple eligible events, cross-hour execution, forged covered-footprint amount and volume units;\n- create no State/checkpoint, Forecast, Residual, route, Recommendation, AO-ACT, calibration, activation or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")

print("MCFT-CAP-05 S6 SSOT materialization complete")
