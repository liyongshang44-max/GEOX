# .mcft_cap05_s4_materializer.py
# Purpose: materialize the bounded MCFT-CAP-05 S4 Human Decision G candidate into current governance SSOT files before this temporary script deletes itself.
# Boundary: deterministic repository-file transformation only; no database, Runtime execution, route, web or capability-completion claim.

from __future__ import annotations

import json
from pathlib import Path

BASELINE = "7e2de9c00a4ecc305c27b6572a63914f38157dbd"
BRANCH = "agent/mcft-cap-05-s4-human-decision-g-commit-v1"
S3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1"
S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
BOUNDARY = [
    "apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts",
    "apps/server/src/runtime/twin_runtime/human_decision_service_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-HUMAN-DECISION-G.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S4_HUMAN_DECISION_G.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts",
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
    "meaning": "MCFT-CAP-05 S3 merged-main effective; S4 controlled Human Decision G transaction candidate",
}
cap05 = require_one(matrix["capability_lines"], "capability_line_id", "MCFT-CAP-05")
cap05["status"] = "IN_PROGRESS"
cap05["implementation_status"] = "S4_IMPLEMENTATION_CANDIDATE"
cap05["active_delivery_slice_id"] = S4
cap05["runtime_source_authorized"] = True
cap05["latest_effective_slice_id"] = S3
cap05["latest_effective_main_commit"] = BASELINE
cap05["next_authorized_slice_ids"] = []
cap05["successor_authorized"] = False
s3_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S3)
s3_matrix.update({
    "status": "MERGED_EFFECTIVE",
    "exact_head": "e63018ee0fef1e8862d73260489c858eccfebf07",
    "materialization_workflow": 29309794282,
    "exact_head_workflow": 29309925820,
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": 29310035502,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "effectiveness_condition_satisfied": True,
})
s4_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S4)
s4_matrix.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "postgresql_acceptance_workflow": 29310564723,
    "canonical_decision_fact_delta": 1,
    "downstream_inferred_fact_delta": 0,
    "migration_count": 0,
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S4_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S4_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(matrix_path, matrix)


delivery_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
delivery = read_json(delivery_path)
delivery["status"] = "S4_IMPLEMENTATION_CANDIDATE"
delivery["baseline_main_commit"] = BASELINE
delivery["branch"] = BRANCH
delivery["active_delivery_slice_id"] = S4
delivery["runtime_source_authorized"] = True
s3_delivery = require_one(delivery["slices"], "delivery_slice_id", S3)
s3_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "effectiveness_condition_satisfied": True,
    "exact_head": "e63018ee0fef1e8862d73260489c858eccfebf07",
    "materialization_workflow": 29309794282,
    "exact_head_workflow": 29309925820,
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": 29310035502,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s4_delivery = require_one(delivery["slices"], "delivery_slice_id", S4)
s4_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "CONTROLLED_HUMAN_DECISION_SERVICE_ESTABLISHED",
        "CURRENT_CANONICAL_SCENARIO_READBACK_ESTABLISHED",
        "SCENARIO_OPTION_MEMBER_IDENTITY_VALIDATED",
        "G_HUMAN_DECISION_LINK_COMMIT_ESTABLISHED",
        "DECISION_RESPONSE_LOSS_RETRY_ESTABLISHED",
        "DECISION_IMMUTABLE_SECOND_WRITE_CONFLICT_ESTABLISHED",
    ],
    "preserved_nonclaims": [
        "NO_PUBLIC_ROUTE",
        "NO_RECOMMENDATION",
        "NO_APPROVAL_AUTHORITY",
        "NO_APPROVED_PLAN_WRITE",
        "NO_TASK_OR_DISPATCH",
        "NO_ACTION_FEEDBACK_WRITE",
        "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_FORECAST_EXECUTION",
        "NO_RESIDUAL_MATCHING_ORCHESTRATION",
        "NO_AO_ACT_CHANGE",
        "NO_CALIBRATION_CANDIDATE",
        "NO_MODEL_ACTIVATION",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "exact_changed_file_boundary": BOUNDARY,
    "postgresql_acceptance_workflow": 29310564723,
    "canonical_decision_fact_delta": 1,
    "downstream_inferred_fact_delta": 0,
    "migration_count": 0,
    "effectiveness_condition": "S4_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S4_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(delivery_path, delivery)


authorization_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
authorization = read_json(authorization_path)
authorization["implementation_status"] = "S4_IMPLEMENTATION_CANDIDATE"
authorization["baseline_main_commit"] = BASELINE
authorization["branch"] = BRANCH
authorization["active_delivery_slice_id"] = S4
authorization["repository_write_scope"] = "S4_CONTROLLED_HUMAN_DECISION_G_COMMIT"
authorization["s3_effectiveness"] = {
    "pr_number": 2444,
    "exact_head": "e63018ee0fef1e8862d73260489c858eccfebf07",
    "materialization_workflow": 29309794282,
    "exact_head_workflow": 29309925820,
    "merge_commit": BASELINE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": 2446,
    "merged_main_gate_workflow": 29310035502,
    "merged_main_gate": "PASS",
    "effective": True,
}
authorization["s4_candidate"] = {
    "delivery_slice_id": S4,
    "service_id": "MCFT_CAP_05_CONTROLLED_REPLAY_HUMAN_DECISION_SERVICE_V1",
    "transaction_family": "G_HUMAN_DECISION_LINK_COMMIT",
    "postgresql_acceptance_workflow": 29310564723,
    "canonical_decision_fact_delta": 1,
    "downstream_inferred_fact_delta": 0,
    "effectiveness_condition_satisfied": False,
}
authorization["preserved_nonclaims"] = [
    "NO_PUBLIC_ROUTE",
    "NO_RECOMMENDATION",
    "NO_APPROVAL_AUTHORITY",
    "NO_APPROVED_PLAN_WRITE",
    "NO_TASK_OR_DISPATCH",
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
authorization["exact_changed_file_boundary"] = BOUNDARY
authorization["next_authorized_slice_id_after_effectiveness"] = S5
authorization["successor_authorized"] = False
write_json(authorization_path, authorization)


status_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-STATUS.json"
status = read_json(status_path)
status["exact_changed_file_boundary"] = BOUNDARY
write_json(status_path, status)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
if "S4 PostgreSQL acceptance workflow:" not in task:
    marker = "# 28. S4 — Human Decision through G transaction"
    if marker not in task:
        raise SystemExit("S4 task marker missing")
    block = f'''{marker}\n\nS4 implementation candidate identity：\n\n```text\nbaseline_main_commit:\n{BASELINE}\n\nS3 exact head:\ne63018ee0fef1e8862d73260489c858eccfebf07\n\nS3 merge commit:\n{BASELINE}\n\nS3 merged-main Gate workflow:\n29310035502 SUCCESS\n\nactive_delivery_slice_id:\n{S4}\n\nS4 status:\nIMPLEMENTATION_CANDIDATE\n\nS4 PostgreSQL acceptance workflow:\n29310564723 SUCCESS\n\ncanonical Decision fact delta:\n1\n\ndownstream inferred fact delta:\n0\n\nmigration delta:\n0\n\nS5 authorized:\nfalse\n```\n'''
    task = task.replace(marker, block, 1)
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S4 Human Decision G Commit Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S4}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\npostgresql_acceptance_workflow: 29310564723 SUCCESS\ntransaction_family: G_HUMAN_DECISION_LINK_COMMIT\ncanonical_object_type: twin_decision_record_v1\ncanonical_decision_fact_delta: 1\ndownstream_inferred_fact_delta: 0\nmigration_delta: 0\nS5_authorized: false\nCAP_06_authorized: false\n```\n\nEstablished candidate scope:\n\n- read an exact controlled Human Decision request Evidence ref/hash from `public.facts`;\n- resolve the current Scenario, latest successful Forecast, active lineage, and revision from PostgreSQL readback;\n- resolve the selected Scenario option by frozen semantic member ref/hash;\n- build and commit one immutable `twin_decision_record_v1` through the existing G transaction and S3 persistence repository;\n- return the exact existing object on response-loss retry;\n- reject forged Evidence, forged option identity, stale Scenario, late Evidence, non-Human actor, wrong scope, and a different second Decision;\n- create no Approval, Plan, Task, Dispatch, Action Feedback, State, checkpoint, route, Recommendation, AO-ACT, calibration, activation, or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")
