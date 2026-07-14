# .mcft_cap05_s5_remediation_materializer.py
# Purpose: materialize the bounded S5 recovery/hash/fixed-point remediation candidate into current CAP-05 governance SSOT files before this temporary script deletes itself.
# Boundary: deterministic repository-file transformation only; no database, Runtime execution, route, web, successor activation or capability-completion claim.

from __future__ import annotations

import json
from pathlib import Path

BASELINE = "ef1c789b15a3e73f93c7e63907519faecb027563"
BRANCH = "agent/mcft-cap-05-s5-remediation-recovery-hash-fixed-point-v1"
REMEDIATION = "MCFT-CAP-05.S5.RECOVERY-HASH-FIXED-POINT-REMEDIATION-V1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
BOUNDARY = [
    "apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_approval_plan_recovery_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
    "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
    "apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-REMEDIATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION_DB.ts",
]
S5_EFFECTIVENESS = {
    "pr_number": 2451,
    "exact_head": "77a4f66741d0c5dab59a4cb0ac4ff91d7916d17d",
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


status_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-REMEDIATION-STATUS.json")
status = read_json(status_path)
if status.get("remediation_id") != REMEDIATION:
    raise SystemExit("S5_REMEDIATION_STATUS_IDENTITY_MISMATCH")
if sorted(status.get("exact_changed_file_boundary", [])) != sorted(BOUNDARY):
    raise SystemExit("S5_REMEDIATION_STATUS_BOUNDARY_MISMATCH")


authorization_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json")
authorization = read_json(authorization_path)
authorization.update({
    "implementation_status": "S5_REMEDIATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S5,
    "current_blockers": ["S5_REMEDIATION_MERGED_MAIN_EFFECTIVENESS_PENDING"],
    "repository_write_scope": "S5_RECOVERY_HASH_FIXED_POINT_REMEDIATION_ONLY",
    "exact_changed_file_boundary": BOUNDARY,
    "next_authorized_slice_id_after_effectiveness": S6,
    "successor_authorized": False,
})
authorization["s5_effectiveness"] = S5_EFFECTIVENESS
authorization["s5_remediation_candidate"] = {
    "remediation_id": REMEDIATION,
    "pr_number": 2457,
    "duplicate_audit_complete": True,
    "independent_prior_remediation_pr_found": False,
    "initial_wiring_and_typecheck_workflow": 29315823499,
    "postgresql_and_s3_regression_workflow": 29316507189,
    "canonical_object_delta": 0,
    "transaction_family_delta": 0,
    "migration_delta": 0,
    "effectiveness_condition_satisfied": False,
}
write_json(authorization_path, authorization)


delivery_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json")
delivery = read_json(delivery_path)
delivery.update({
    "status": "S5_REMEDIATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S5,
})
s5_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S5, "S5_DELIVERY")
s5_delivery.update({
    "status": "MERGED_EFFECTIVE",
    "baseline_main_commit": "7f2f2bec144cee4d90608c3a25c3dc7cac9f9189",
    "branch": "agent/mcft-cap-05-s5-approval-plan-evidence-binding-v1",
    "effectiveness_condition_satisfied": True,
    "exact_head": S5_EFFECTIVENESS["exact_head"],
    "merge_commit": BASELINE,
    "merged_main_gate_workflow": S5_EFFECTIVENESS["merged_main_gate_workflow"],
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
})
s6_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S6, "S6_DELIVERY")
if s6_delivery.get("status") != "BLOCKED" or s6_delivery.get("runtime_source_authorized") is not False:
    raise SystemExit("S6_MUST_REMAIN_BLOCKED")
delivery["s5_remediation_candidate"] = {
    "remediation_id": REMEDIATION,
    "pr_number": 2457,
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "runtime_source_authorized": True,
    "successor_slice_authorized": False,
    "exact_changed_file_boundary": BOUNDARY,
    "validation": {
        "initial_wiring_and_typecheck_workflow": 29315823499,
        "postgresql_and_s3_regression_workflow": 29316507189,
        "repository_typecheck": "PASS",
        "s5_remediation_postgresql": "PASS",
        "s3_persistence_recovery_regression": "PASS",
    },
    "effectiveness_condition": "REMEDIATION_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_REMEDIATION_GATE_PASS",
    "effectiveness_condition_satisfied": False,
}
write_json(delivery_path, delivery)


matrix_path = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
matrix = read_json(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S5 merged-main effective; bounded S5 recovery/hash/fixed-point remediation candidate; S6 blocked",
}
cap05 = require_single(matrix["capability_lines"], lambda item: item.get("capability_line_id") == "MCFT-CAP-05", "CAP05_MATRIX")
cap05.update({
    "status": "IN_PROGRESS",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "implementation_status": "S5_REMEDIATION_CANDIDATE",
    "active_delivery_slice_id": S5,
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_remediation_id": REMEDIATION,
    "remediation_pr": 2457,
    "next_authorized_slice_ids": [],
})
cap05_s5 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S5, "CAP05_MATRIX_S5")
cap05_s5.update({
    "status": "MERGED_EFFECTIVE",
    "merge_commit": BASELINE,
    "effectiveness_condition_satisfied": True,
})
cap05_s6 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S6, "CAP05_MATRIX_S6")
if cap05_s6.get("status") != "BLOCKED":
    raise SystemExit("CAP05_MATRIX_S6_MUST_REMAIN_BLOCKED")
cap05["active_remediation"] = {
    "remediation_id": REMEDIATION,
    "status": "IMPLEMENTATION_CANDIDATE",
    "pr_number": 2457,
    "baseline_main_commit": BASELINE,
    "effectiveness_condition": "REMEDIATION_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_REMEDIATION_GATE_PASS",
    "effectiveness_condition_satisfied": False,
}
write_json(matrix_path, matrix)


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
section = "## S5 Remediation — Recovery / Evidence Hash / Fixed-Point"
if section not in task:
    task += f'''\n\n---\n\n{section}\n\n```text\nremediation_id:\n{REMEDIATION}\n\nbaseline_main_commit:\n{BASELINE}\n\nmerged S5 PR:\n2451\n\nindependent prior S5 remediation PR found:\nfalse\n\nnew remediation PR:\n2457\n\nS5 remediation status:\nIMPLEMENTATION_CANDIDATE\n\ninitial wiring and typecheck workflow:\n29315823499 SUCCESS\n\nPostgreSQL remediation and S3 recovery regression workflow:\n29316507189 SUCCESS\n\nsource_record_hash policy:\nS1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1\n\namount policy:\nWATER_AMOUNT_SCALE_6_HALF_AWAY_FROM_ZERO_V1\n\nrecovery policy:\nREVALIDATE_ASSERTION_DECISION_PLAN_AMOUNT_AVAILABILITY_VALIDITY_SUPERSESSION_V1\n\ncanonical object delta:\n0\n\ntransaction family delta:\n0\n\nmigration delta:\n0\n\nS6 authorized:\nfalse\n```\n'''
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S5 Recovery / Hash / Fixed-Point Remediation Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\nremediation_id: {REMEDIATION}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\nremediation_pr: 2457\nprior_independent_remediation_pr_found: false\ninitial_wiring_and_typecheck_workflow: 29315823499 SUCCESS\npostgresql_and_s3_regression_workflow: 29316507189 SUCCESS\ncanonical_object_delta: 0\ntransaction_family_delta: 0\nmigration_delta: 0\nS6_authorized: false\nCAP_06_authorized: false\n```\n\nBounded remediation scope:\n\n- retain merged S5 PR #2451 as the effective implementation baseline;\n- recompute Approval Assertion and Approved Plan `source_record_hash` from the frozen S1 full-record basis;\n- use the existing scale-6 fixed-point water authority for S5 validation, comparison and projection formatting;\n- rebuild Plan projections only after revalidating the immutable Assertion, canonical G Decision, Plan links, amount semantics, availability, validity and explicit supersession;\n- roll back projection deletion when any recovery fact graph is invalid;\n- preserve S3 G/H/C persistence and recovery behavior;\n- create no replacement S5 implementation, canonical object, transaction family, migration, route, approval/dispatch authority, State mutation or successor authorization.\n'''
map_path.write_text(implementation_map, encoding="utf-8")

print("MCFT-CAP-05 S5 remediation SSOT materialization complete")
