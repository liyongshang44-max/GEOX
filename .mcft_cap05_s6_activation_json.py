# .mcft_cap05_s6_activation_json.py
# Purpose: settle S6 and authorize S7 in CAP-05 JSON governance SSOT.
# Boundary: repository JSON transformation only; no Runtime, database, migration, route or successor capability authority.

from __future__ import annotations

import json
import os
from pathlib import Path

BASELINE = "be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe"
BRANCH = "agent/mcft-cap-05-s6-ssot-activation-v1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1"
WORKFLOW_RUN = int(os.environ["GITHUB_RUN_ID"])


def load(path: str):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save(path: str, value) -> None:
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def one(items, key: str, value: str, label: str):
    found = [item for item in items if item.get(key) == value]
    if len(found) != 1:
        raise SystemExit(f"{label}_CARDINALITY:{len(found)}")
    return found[0]


status_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTIVATION-STATUS.json"
status = load(status_path)
status["validation"].update({
    "materialization_workflow": WORKFLOW_RUN,
    "governance_gate": "PASS",
    "repository_typecheck": "PASS",
    "standard_ci_state": "PENDING",
})
save(status_path, status)
boundary = status["exact_changed_file_boundary"]
nonclaims = status["preserved_nonclaims"]
effectiveness = status["s6_effectiveness"]


auth_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
auth = load(auth_path)
auth.update({
    "implementation_status": "S7_AUTHORIZED_NOT_STARTED",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S7,
    "active_authorized_slice_id": S7,
    "current_blockers": ["S7_IMPLEMENTATION_NOT_STARTED"],
    "repository_write_scope": "S6_EFFECTIVENESS_SETTLEMENT_AND_S7_EXPLICIT_ACTIVATION_ONLY",
    "exact_changed_file_boundary": boundary,
    "next_authorized_slice_id_after_effectiveness": S7,
    "successor_authorized": False,
    "s6_effectiveness": effectiveness,
    "preserved_nonclaims": nonclaims,
})
auth["s6_activation_candidate"] = {
    "activation_id": status["activation_id"],
    "pr_number": 2463,
    "materialization_workflow": WORKFLOW_RUN,
    "target_state": "S7_AUTHORIZED_NOT_STARTED",
    "canonical_object_delta": 0,
    "transaction_family_delta": 0,
    "migration_delta": 0,
    "runtime_source_delta": 0,
    "effectiveness_condition_satisfied": False,
}
save(auth_path, auth)


delivery_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
delivery = load(delivery_path)
delivery.update({
    "status": "S7_AUTHORIZED_NOT_STARTED",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S7,
})
s5 = one(delivery["slices"], "delivery_slice_id", "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1", "S5")
s5.update({
    "remediation_effective": True,
    "remediation_merge_commit": "99221bb464818f8686718fd25df123e1096b2281",
    "remediation_merged_main_gate_workflow": 29317273201,
})
s6 = one(delivery["slices"], "delivery_slice_id", S6, "S6")
s6.update({
    "baseline_main_commit": "99221bb464818f8686718fd25df123e1096b2281",
    "branch": "agent/mcft-cap-05-s6-action-feedback-h-adapter-v1",
    "status": "MERGED_EFFECTIVE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "IRRIGATION_RECEIPT_REPLAY_EVIDENCE_VALIDATION_ESTABLISHED",
        "RECEIPT_SOURCE_RECORD_HASH_REVALIDATION_ESTABLISHED",
        "ACTION_FEEDBACK_H_COMMIT_ESTABLISHED",
        "ACTION_FEEDBACK_EXECUTED_IRRIGATION_ADAPTER_ESTABLISHED",
        "RESPONSE_LOSS_IDEMPOTENCY_ESTABLISHED",
        "SINGLE_COVERAGE_APPLICATION_BOUNDARY_ESTABLISHED",
        "LATE_RECEIPT_NO_SHIFT_ESTABLISHED",
    ],
    "preserved_nonclaims": [
        "NO_PUBLIC_ROUTE", "NO_GEOX_APPROVAL_AUTHORITY", "NO_GEOX_DISPATCH_CREATION",
        "NO_RECEIPT_CONSUMING_STATE_TICK", "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_FORECAST_EXECUTION", "NO_FORECAST_RESIDUAL_COMMIT", "NO_RECOMMENDATION",
        "NO_AO_ACT_CHANGE", "NO_CALIBRATION_CANDIDATE", "NO_MODEL_ACTIVATION",
        "NO_MIGRATION", "NO_CAP_06_AUTHORIZATION",
    ],
    "exact_changed_file_boundary": [
        "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
        "apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts",
        "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
        "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md",
        "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json",
        "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs",
        "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts",
    ],
    "effectiveness_condition": "S6_RUNTIME_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_RUNTIME_GATE_PASS",
    "effectiveness_condition_satisfied": True,
    "candidate_ci_workflow": 29323156789,
    "exact_head": effectiveness["exact_head"],
    "exact_head_workflow": effectiveness["exact_head_workflow"],
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": effectiveness["merged_main_gate_workflow"],
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "canonical_action_feedback_fact_delta_standard_case": 1,
    "transaction_family": "H_ACTION_FEEDBACK_COMMIT",
    "migration_count": 0,
})
s7 = one(delivery["slices"], "delivery_slice_id", S7, "S7")
s7.update({
    "baseline_main_commit": BASELINE,
    "branch": None,
    "status": "AUTHORIZED_NOT_STARTED",
    "runtime_source_authorized": True,
    "allowed_claims": ["RECEIPT_CONSUMING_TICK_IMPLEMENTATION_AUTHORIZED"],
    "preserved_nonclaims": nonclaims,
    "exact_changed_file_boundary": [],
    "effectiveness_condition": "PREDECESSOR_SLICE_MERGED_AND_MERGED_MAIN_GATE_PASS_AND_EXPLICIT_SLICE_ACTIVATION",
    "effectiveness_condition_satisfied": True,
    "activation_id": status["activation_id"],
    "activation_pr_number": 2463,
    "implementation_started": False,
})
delivery["s6_activation_candidate"] = {
    "activation_id": status["activation_id"],
    "pr_number": 2463,
    "materialization_workflow": WORKFLOW_RUN,
    "status": "IMPLEMENTATION_CANDIDATE",
    "effectiveness_condition_satisfied": False,
}
save(delivery_path, delivery)


matrix_path = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
matrix = load(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S6 Action Feedback H Runtime merged-main effective; S7 Receipt-consuming tick explicitly authorized but not started",
}
cap05 = one(matrix["capability_lines"], "capability_line_id", "MCFT-CAP-05", "CAP05")
cap05.update({
    "status": "IN_PROGRESS",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "implementation_status": "S7_AUTHORIZED_NOT_STARTED",
    "active_delivery_slice_id": S7,
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_remediation_id": None,
    "remediation_effective": True,
    "next_authorized_slice_ids": [S7],
})
ms6 = one(cap05["delivery_slices"], "delivery_slice_id", S6, "MATRIX_S6")
ms6.update({
    "status": "MERGED_EFFECTIVE",
    "baseline_main_commit": "99221bb464818f8686718fd25df123e1096b2281",
    "branch": "agent/mcft-cap-05-s6-action-feedback-h-adapter-v1",
    "runtime_source_authorized": True,
    "exact_head": effectiveness["exact_head"],
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": effectiveness["merged_main_gate_workflow"],
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "effectiveness_condition_satisfied": True,
})
ms7 = one(cap05["delivery_slices"], "delivery_slice_id", S7, "MATRIX_S7")
ms7.update({
    "status": "AUTHORIZED_NOT_STARTED",
    "baseline_main_commit": BASELINE,
    "branch": None,
    "runtime_source_authorized": True,
    "activation_id": status["activation_id"],
    "activation_pr_number": 2463,
    "implementation_started": False,
    "effectiveness_condition_satisfied": True,
})
cap05["active_activation"] = {
    "activation_id": status["activation_id"],
    "status": "IMPLEMENTATION_CANDIDATE",
    "pr_number": 2463,
    "target_state": "S7_AUTHORIZED_NOT_STARTED",
    "effectiveness_condition_satisfied": False,
}
save(matrix_path, matrix)

print(f"S6 activation JSON SSOT materialized in workflow {WORKFLOW_RUN}")
