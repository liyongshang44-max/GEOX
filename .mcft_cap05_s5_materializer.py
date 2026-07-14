# .mcft_cap05_s5_materializer.py
# Purpose: materialize the bounded MCFT-CAP-05 S5 Approval Assertion / Approved Plan binding candidate into current governance SSOT files before this temporary script deletes itself.
# Boundary: deterministic repository-file transformation only; no database, Runtime execution, route, web or capability-completion claim.

from __future__ import annotations

import json
from pathlib import Path

BASELINE = "7f2f2bec144cee4d90608c3a25c3dc7cac9f9189"
BRANCH = "agent/mcft-cap-05-s5-approval-plan-binding-v1"
S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
BOUNDARY = [
    "apps/server/src/domain/twin_runtime/approved_plan_binding_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_approved_plan_binding_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/approved_plan_binding_service_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-BINDING.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
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
    "meaning": "MCFT-CAP-05 S4 merged-main effective; S5 Approval Assertion and Approved Plan Evidence binding candidate",
}
cap05 = require_one(matrix["capability_lines"], "capability_line_id", "MCFT-CAP-05")
cap05["status"] = "IN_PROGRESS"
cap05["implementation_status"] = "S5_IMPLEMENTATION_CANDIDATE"
cap05["active_delivery_slice_id"] = S5
cap05["runtime_source_authorized"] = True
cap05["latest_effective_slice_id"] = S4
cap05["latest_effective_main_commit"] = BASELINE
cap05["next_authorized_slice_ids"] = []
cap05["successor_authorized"] = False
s4_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S4)
s4_matrix.update({
    "status": "MERGED_EFFECTIVE",
    "exact_head": "e9f3b81e2aa8b68498263049086d79184ead6108",
    "materialization_workflow": 29311491031,
    "exact_head_workflow": 29311611506,
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": 29311761419,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "effectiveness_condition_satisfied": True,
})
s5_matrix = require_one(cap05["delivery_slices"], "delivery_slice_id", S5)
s5_matrix.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "initial_postgresql_workflow": 29312144925,
    "recovery_integration_workflow": 29312506965,
    "canonical_twin_fact_delta": 0,
    "migration_count": 0,
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S5_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(matrix_path, matrix)


delivery_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
delivery = read_json(delivery_path)
delivery["status"] = "S5_IMPLEMENTATION_CANDIDATE"
delivery["baseline_main_commit"] = BASELINE
delivery["branch"] = BRANCH
delivery["active_delivery_slice_id"] = S5
delivery["runtime_source_authorized"] = True
s4_delivery = require_one(delivery["slices"], "delivery_slice_id", S4)
s4_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "effectiveness_condition_satisfied": True,
    "exact_head": "e9f3b81e2aa8b68498263049086d79184ead6108",
    "materialization_workflow": 29311491031,
    "exact_head_workflow": 29311611506,
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": 29311761419,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s5_delivery = require_one(delivery["slices"], "delivery_slice_id", S5)
s5_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
    "runtime_source_authorized": True,
    "allowed_claims": [
        "DECISION_APPROVAL_PLAN_EXACT_LINKAGE_ESTABLISHED",
        "APPROVAL_ASSERTION_AND_PLAN_EVIDENCE_SEPARATION_ESTABLISHED",
        "SCENARIO_APPROVED_AMOUNT_SEPARATION_ESTABLISHED",
        "PLAN_VALIDITY_AND_AVAILABILITY_GUARDS_ESTABLISHED",
        "EXPLICIT_PLAN_SUPERSESSION_ESTABLISHED",
        "VALIDATED_PLAN_BINDING_RECOVERY_ESTABLISHED",
        "EXPLICIT_DISPATCH_NOT_OBSERVED_DISPOSITION_ESTABLISHED",
    ],
    "preserved_nonclaims": [
        "NO_GEOX_APPROVAL_AUTHORITY",
        "NO_APPROVAL_ASSERTION_EVIDENCE_CREATION",
        "NO_APPROVED_PLAN_EVIDENCE_CREATION",
        "NO_CANONICAL_TWIN_APPEND",
        "NO_DISPATCH_FACT",
        "NO_ACTION_FEEDBACK_WRITE",
        "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_PUBLIC_ROUTE",
        "NO_RECOMMENDATION",
        "NO_AO_ACT_CHANGE",
        "NO_CALIBRATION_CANDIDATE",
        "NO_MODEL_ACTIVATION",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "exact_changed_file_boundary": BOUNDARY,
    "initial_postgresql_workflow": 29312144925,
    "recovery_integration_workflow": 29312506965,
    "canonical_twin_fact_delta": 0,
    "migration_count": 0,
    "effectiveness_condition": "S5_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
write_json(delivery_path, delivery)


authorization_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
authorization = read_json(authorization_path)
authorization["implementation_status"] = "S5_IMPLEMENTATION_CANDIDATE"
authorization["baseline_main_commit"] = BASELINE
authorization["branch"] = BRANCH
authorization["active_delivery_slice_id"] = S5
authorization["repository_write_scope"] = "S5_APPROVAL_ASSERTION_APPROVED_PLAN_BINDING"
authorization["s4_effectiveness"] = {
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
authorization["s5_candidate"] = {
    "delivery_slice_id": S5,
    "service_id": "MCFT_CAP_05_DECISION_APPROVAL_PLAN_BINDING_SERVICE_V1",
    "projection_table": "twin_approved_plan_binding_projection_v1",
    "initial_postgresql_workflow": 29312144925,
    "recovery_integration_workflow": 29312506965,
    "canonical_twin_fact_delta": 0,
    "migration_count": 0,
    "effectiveness_condition_satisfied": False,
}
authorization["preserved_nonclaims"] = [
    "NO_GEOX_APPROVAL_AUTHORITY",
    "NO_APPROVAL_ASSERTION_EVIDENCE_CREATION",
    "NO_APPROVED_PLAN_EVIDENCE_CREATION",
    "NO_CANONICAL_TWIN_APPEND",
    "NO_DISPATCH_FACT",
    "NO_ACTION_FEEDBACK_WRITE",
    "NO_STATE_OR_CHECKPOINT_MUTATION",
    "NO_PUBLIC_ROUTE",
    "NO_RECOMMENDATION",
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
authorization["next_authorized_slice_id_after_effectiveness"] = S6
authorization["successor_authorized"] = False
write_json(authorization_path, authorization)


persistence_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json"
persistence = read_json(persistence_path)
persistence["latest_validation_slice_id"] = S5
persistence["approved_plan_binding"] = {
    "source_record_types": [
        "approval_assertion_evidence_v1",
        "approved_irrigation_plan_snapshot_v1",
    ],
    "source_store": "public.facts",
    "projection_table": "twin_approved_plan_binding_projection_v1",
    "validator": "validateCap05ApprovedPlanBindingV1",
    "repository": "PostgresApprovedPlanBindingRepositoryV1",
    "service": "Cap05ApprovedPlanBindingServiceV1",
    "exact_canonical_decision_link_required": True,
    "assertion_and_plan_distinct_required": True,
    "projection_is_approval_authority": False,
    "projection_is_canonical_history": False,
    "dispatch_disposition": "NOT_OBSERVED",
    "explicit_supersession_required": True,
    "implicit_replacement_forbidden": True,
    "canonical_twin_fact_delta": 0,
    "migration_delta": 0,
}
persistence["recovery"]["approved_plan_binding_entrypoint"] = "PostgresApprovedPlanBindingRepositoryV1.rebuildAllBindingsWithClientV1"
persistence["recovery"]["generic_recovery_delegates_to_plan_validator"] = True
persistence["approved_plan_binding_postgresql_acceptance"] = {
    "initial_workflow": 29312144925,
    "integration_workflow": 29312506965,
    "result": "SUCCESS",
    "s3_recovery_regression": "PASS",
    "checks": [
        "Decision Assertion Plan exact linkage",
        "Scenario amount and approved amount separation",
        "validity and availability",
        "explicit dispatch NOT_OBSERVED disposition",
        "explicit predecessor ref/hash supersession",
        "projection deletion and validated rebuild",
        "no canonical Twin append",
    ],
}
write_json(persistence_path, persistence)


status_path = "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json"
status = read_json(status_path)
status["exact_changed_file_boundary"] = BOUNDARY
write_json(status_path, status)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
if "S5 recovery integration workflow:" not in task:
    marker = "## S5 — Approval Assertion and Approved Plan Evidence Binding"
    if marker not in task:
        raise SystemExit("S5 task marker missing")
    block = f'''{marker}\n\nS5 implementation candidate identity：\n\n```text\nbaseline_main_commit:\n{BASELINE}\n\nS4 exact head:\ne9f3b81e2aa8b68498263049086d79184ead6108\n\nS4 merge commit:\n{BASELINE}\n\nS4 merged-main Gate workflow:\n29311761419 SUCCESS\n\nactive_delivery_slice_id:\n{S5}\n\nS5 status:\nIMPLEMENTATION_CANDIDATE\n\nS5 initial PostgreSQL workflow:\n29312144925 SUCCESS\n\nS5 recovery integration workflow:\n29312506965 SUCCESS\n\ncanonical Twin fact delta:\n0\n\nmigration delta:\n0\n\nS6 authorized:\nfalse\n```\n'''
    task = task.replace(marker, block, 1)
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S5 Approval and Plan Evidence Binding Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S5}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\ninitial_postgresql_workflow: 29312144925 SUCCESS\nrecovery_integration_workflow: 29312506965 SUCCESS\nprojection_table: twin_approved_plan_binding_projection_v1\ncanonical_twin_fact_delta: 0\nmigration_delta: 0\nS6_authorized: false\nCAP_06_authorized: false\n```\n\nEstablished candidate scope:\n\n- keep Approval Assertion and Approved Plan Snapshot as separate Replay Evidence records;\n- require exact canonical Decision, Decision request, Scenario option, Approval Assertion, Reality scope and Evidence hash linkage;\n- preserve Scenario amount separately from approved amount and reconcile the exact difference with reason codes;\n- validate availability and effective-time order;\n- record `dispatch_disposition = NOT_OBSERVED` without inferring dispatch;\n- require explicit predecessor Plan ref/hash and projection CAS for supersession;\n- store only rebuildable binding state in `twin_approved_plan_binding_projection_v1`;\n- delegate generic CAP-05 Plan recovery to the same S5 validator;\n- create no approval authority, Evidence record, canonical Twin fact, Action Feedback, State/checkpoint, route, Recommendation, AO-ACT, calibration, activation, or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")
