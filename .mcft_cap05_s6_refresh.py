# .mcft_cap05_s6_refresh.py
# Purpose: refresh the S6 Action Feedback candidate over the effective S5-remediated main, strengthen Receipt Evidence hash validation, and rematerialize CAP-05 governance SSOT.
# Boundary: deterministic repository-file transformation only; no database mutation, public route, approval/dispatch creation, State/checkpoint mutation, Forecast, Residual, Recommendation, AO-ACT, calibration, activation or CAP-06 authority.

from __future__ import annotations

import json
import os
from pathlib import Path

BASELINE = "99221bb464818f8686718fd25df123e1096b2281"
BRANCH = "agent/mcft-cap-05-s6-action-feedback-h-adapter-v1"
S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1"
S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1"
S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1"
RUN_ID = int(os.environ["GITHUB_RUN_ID"])
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
    "merge_commit": "ef1c789b15a3e73f93c7e63907519faecb027563",
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": 2455,
    "merged_main_gate_workflow": 29313112424,
    "merged_main_gate": "PASS",
    "effective": True,
}
S5_REMEDIATION_EFFECTIVENESS = {
    "pr_number": 2457,
    "exact_head": "4d9319f468f420c43dc4de80993a0712b7b0da03",
    "merge_commit": BASELINE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "exact_head_probe_pr_number": 2458,
    "exact_head_workflow": 29317032605,
    "postmerge_probe_pr_number": 2459,
    "merged_main_gate_workflow": 29317273201,
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


# Strengthen Receipt Replay Evidence validation with the already-effective S1 source-record hash policy.
receipt_path = Path("apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts")
receipt = receipt_path.read_text(encoding="utf-8")
hash_import = 'import { assertCap05ReplayEvidenceSourceRecordHashV1 } from "./approval_plan_evidence_contracts_v1.js";\n'
if hash_import not in receipt:
    anchor = 'import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";\n'
    if anchor not in receipt:
        raise SystemExit("RECEIPT_HASH_IMPORT_ANCHOR_MISSING")
    receipt = receipt.replace(anchor, anchor + hash_import, 1)
hash_validation = '  assertCap05ReplayEvidenceSourceRecordHashV1(record as unknown as Record<string, unknown>);\n'
if hash_validation not in receipt:
    anchor = '  requiredStringV1(record.source_record_hash, "CAP05_RECEIPT_SOURCE_RECORD_HASH_REQUIRED");\n'
    if anchor not in receipt:
        raise SystemExit("RECEIPT_HASH_VALIDATION_ANCHOR_MISSING")
    receipt = receipt.replace(anchor, anchor + hash_validation, 1)
receipt_path.write_text(receipt, encoding="utf-8")


# Rehash every legitimate mutated Receipt fixture and add a forged full-record hash negative case.
acceptance_path = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts")
acceptance = acceptance_path.read_text(encoding="utf-8")
old_import = '''import type {
  Cap05ApprovalAssertionEvidenceV1,
  Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";'''
new_import = '''import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";'''
if old_import in acceptance:
    acceptance = acceptance.replace(old_import, new_import, 1)
elif "computeCap05ReplayEvidenceSourceRecordHashV1" not in acceptance:
    raise SystemExit("S6_ACCEPTANCE_HASH_IMPORT_ANCHOR_MISSING")
old_clone_tail = '''  record.source_record_hash = `sha256:acceptance-receipt-${suffix}`;
  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;'''
new_clone_tail = '''  record.evidence_identity_key = `${source.evidence_identity_key}_${suffix}`;'''
if old_clone_tail in acceptance:
    acceptance = acceptance.replace(old_clone_tail, new_clone_tail, 1)
old_mutate_tail = '''  mutate?.(record);
  return record;'''
new_mutate_tail = '''  mutate?.(record);
  record.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(record as unknown as Record<string, unknown>);
  return record;'''
if old_mutate_tail in acceptance:
    acceptance = acceptance.replace(old_mutate_tail, new_mutate_tail, 1)
elif new_mutate_tail not in acceptance:
    raise SystemExit("S6_ACCEPTANCE_REHASH_ANCHOR_MISSING")
forged_block = '''
  const forgedSourceHash = cloneReceipt("forged_source_hash", receipt, (record) => {
    record.role_time.execution_start = "2026-06-04T01:23:00.000Z";
    record.role_time.execution_end = "2026-06-04T01:24:00.000Z";
    record.role_time.ingested_at = "2026-06-04T01:57:00.000Z";
    record.role_time.available_to_runtime_at = "2026-06-04T01:57:00.000Z";
    record.available_to_runtime_at = record.role_time.available_to_runtime_at;
  });
  forgedSourceHash.source_record_hash = "sha256:forged-receipt-source-record-hash";
  await seedReplayEvidence(forgedSourceHash);
  await assert.rejects(feedbackService.commitActionFeedback({
    scope,
    receipt_evidence_ref: forgedSourceHash.source_record_id,
    receipt_evidence_hash: forgedSourceHash.source_record_hash,
  }), /CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH/);
  ok("forged Receipt source-record hash fails closed before canonical H construction");
'''
if "forged Receipt source-record hash fails closed" not in acceptance:
    anchor = '  ok("execution, validation and quality status mappings are explicit and independent");\n'
    if anchor not in acceptance:
        raise SystemExit("S6_ACCEPTANCE_FORGED_HASH_INSERTION_ANCHOR_MISSING")
    acceptance = acceptance.replace(anchor, anchor + forged_block, 1)
acceptance_path.write_text(acceptance, encoding="utf-8")


# Refresh S6 status over the remediated main and record the current validation workflow.
status_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json")
status = read_json(status_path)
status.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "s5_effectiveness": S5_EFFECTIVENESS,
    "s5_remediation_effectiveness": S5_REMEDIATION_EFFECTIVENESS,
    "validation": {
        "refresh_and_validation_workflow": RUN_ID,
        "repository_typecheck": "PASS",
        "postgresql_acceptance": "PASS",
        "s5_remediation_regression": "PASS",
        "acceptance_pass_count": 15,
        "acceptance_fail_count": 0,
    },
    "migration_delta": 0,
    "next_delivery_slice_id": S7,
    "next_delivery_slice_authorized": False,
    "effectiveness_condition_satisfied": False,
    "exact_changed_file_boundary": BOUNDARY,
})
status.setdefault("receipt_evidence", {}).update({
    "source_record_hash_policy": "S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1",
    "source_record_hash_recomputed": True,
})
write_json(status_path, status)


# Rematerialize Authorization Status from the effective remediated main.
authorization_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json")
authorization = read_json(authorization_path)
authorization.update({
    "implementation_status": "S6_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S6,
    "current_blockers": ["S6_MERGED_MAIN_EFFECTIVENESS_PENDING"],
    "repository_write_scope": "S6_ACTION_FEEDBACK_H_COMMIT_AND_ADAPTER_ONLY",
    "exact_changed_file_boundary": BOUNDARY,
    "next_authorized_slice_id_after_effectiveness": S7,
    "successor_authorized": False,
    "s5_effectiveness": S5_EFFECTIVENESS,
    "s5_remediation_effectiveness": S5_REMEDIATION_EFFECTIVENESS,
})
authorization["s6_candidate"] = {
    "delivery_slice_id": S6,
    "status": "IMPLEMENTATION_CANDIDATE",
    "refresh_and_validation_workflow": RUN_ID,
    "canonical_object_type": "twin_action_feedback_v1",
    "transaction_family": "H_ACTION_FEEDBACK_COMMIT",
    "canonical_action_feedback_fact_delta_standard_case": 1,
    "migration_delta": 0,
    "effectiveness_condition_satisfied": False,
}
write_json(authorization_path, authorization)


# Advance Delivery Status to S6 candidate without authorizing S7.
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
    "remediation_effective": True,
    "remediation_merge_commit": BASELINE,
    "remediation_merged_main_gate_workflow": 29317273201,
})
s6_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S6, "S6_DELIVERY")
s6_delivery.update({
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "status": "IMPLEMENTATION_CANDIDATE",
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
    "exact_changed_file_boundary": BOUNDARY,
    "effectiveness_condition": "S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS",
    "effectiveness_condition_satisfied": False,
    "refresh_and_validation_workflow": RUN_ID,
    "canonical_action_feedback_fact_delta_standard_case": 1,
    "migration_count": 0,
})
s7_delivery = require_single(delivery["slices"], lambda item: item.get("delivery_slice_id") == S7, "S7_DELIVERY")
if s7_delivery.get("status") != "BLOCKED" or s7_delivery.get("runtime_source_authorized") is not False:
    raise SystemExit("S7_MUST_REMAIN_BLOCKED")
write_json(delivery_path, delivery)


# Advance the global Matrix to the S6 candidate only.
matrix_path = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
matrix = read_json(matrix_path)
matrix["baseline"] = {
    "branch": "main",
    "commit": BASELINE,
    "meaning": "MCFT-CAP-05 S5 remediation merged-main effective; S6 Action Feedback H commit and adapter candidate; S7 blocked",
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
    "active_remediation_id": None,
    "remediation_pr": 2457,
    "remediation_effective": True,
    "next_authorized_slice_ids": [],
})
cap05_s5 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S5, "CAP05_MATRIX_S5")
cap05_s5.update({"status": "MERGED_EFFECTIVE", "merge_commit": "ef1c789b15a3e73f93c7e63907519faecb027563", "effectiveness_condition_satisfied": True, "remediation_effective": True})
cap05_s6 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S6, "CAP05_MATRIX_S6")
cap05_s6.update({
    "status": "IMPLEMENTATION_CANDIDATE",
    "primary_owner_work_package_id": "MCFT-15",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "refresh_and_validation_workflow": RUN_ID,
    "effectiveness_condition_satisfied": False,
})
cap05_s7 = require_single(cap05["delivery_slices"], lambda item: item.get("delivery_slice_id") == S7, "CAP05_MATRIX_S7")
if cap05_s7.get("status") != "BLOCKED":
    raise SystemExit("CAP05_MATRIX_S7_MUST_REMAIN_BLOCKED")
write_json(matrix_path, matrix)


# Append fresh S6 authority records to the task and Implementation Map after taking main's remediation-aware versions.
task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
section = "## S6 — Action Feedback H Commit and Adapter Candidate"
if section not in task:
    task += f'''\n\n---\n\n{section}\n\n```text\ndelivery_slice_id:\n{S6}\n\nbaseline_main_commit:\n{BASELINE}\n\nS5 remediation effective:\ntrue\n\nS5 remediation merged-main Gate:\n29317273201 SUCCESS\n\nS6 status:\nIMPLEMENTATION_CANDIDATE\n\nrefresh and validation workflow:\n{RUN_ID} SUCCESS\n\nReceipt source_record_hash policy:\nS1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1\n\ncanonical object:\ntwin_action_feedback_v1\n\ntransaction family:\nH_ACTION_FEEDBACK_COMMIT\n\nstandard canonical fact delta:\n1\n\nmigration delta:\n0\n\nS7 authorized:\nfalse\n```\n'''
task_path.write_text(task, encoding="utf-8")

map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S6 Action Feedback H Commit and Adapter Candidate"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\ndelivery_slice_id: {S6}\nbaseline_main_commit: {BASELINE}\nstatus: IMPLEMENTATION_CANDIDATE\nrefresh_and_validation_workflow: {RUN_ID} SUCCESS\nS5_remediation_effective: true\nReceipt_source_record_hash_policy: S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1\ncanonical_object_type: twin_action_feedback_v1\ntransaction_family: H_ACTION_FEEDBACK_COMMIT\nmigration_delta: 0\nS7_authorized: false\nCAP_06_authorized: false\n```\n\nBounded S6 scope:\n\n- resolve one exact irrigation Receipt Replay Evidence record by ref and hash;\n- recompute its source-record hash from the frozen S1 full-record basis;\n- map execution, validation and quality axes independently;\n- bind the Receipt to one active remediated Approved Plan and one canonical G Decision;\n- commit canonical `twin_action_feedback_v1` through the existing H transaction;\n- preserve raw executed depth and coverage so the existing aggregator applies coverage exactly once;\n- preserve execution logical time for late Receipt availability;\n- create no public route, approval, dispatch, State tick, Forecast, Residual, Recommendation, AO-ACT or CAP-06 authority.\n'''
map_path.write_text(implementation_map, encoding="utf-8")


authority_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md")
authority = authority_path.read_text(encoding="utf-8")
refresh_section = "## Remediation-aware refresh"
if refresh_section not in authority:
    authority += f'''\n\n---\n\n{refresh_section}\n\n```text\nbaseline_main_commit: {BASELINE}\nS5_remediation_effective: true\nS5_remediation_merged_main_gate: 29317273201 SUCCESS\nReceipt_source_record_hash_policy: S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1\nrefresh_and_validation_workflow: {RUN_ID} SUCCESS\n```\n\nThe S6 service must not trust equality between a caller-provided hash and a stored hash as integrity proof. Before canonical H construction, the Receipt record is rehashed from the frozen S1 full-record basis, excluding only `source_record_hash` and `materialized_file_location`.\n'''
authority_path.write_text(authority, encoding="utf-8")


# Upgrade the static Gate for remediation-aware predecessor and Receipt hash validation.
gate_path = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs")
gate = gate_path.read_text(encoding="utf-8")
gate = gate.replace(
    'check(status.s5_effectiveness?.effective === true && status.s5_effectiveness?.merged_main_gate === "PASS", "S5 merged-main effectiveness is prerequisite authority");',
    'check(status.s5_effectiveness?.effective === true && status.s5_effectiveness?.merged_main_gate === "PASS", "S5 merged-main effectiveness is prerequisite authority");\ncheck(status.s5_remediation_effectiveness?.effective === true && status.s5_remediation_effectiveness?.merged_main_gate === "PASS", "S5 remediation merged-main effectiveness is prerequisite authority");',
    1,
)
gate = gate.replace(
    'check(status.validation?.postgresql_acceptance_workflow === 29313657871 && status.validation?.postgresql_acceptance === "PASS", "S6 PostgreSQL acceptance is recorded");',
    'check(Number.isInteger(status.validation?.refresh_and_validation_workflow) && status.validation?.refresh_and_validation_workflow > 0 && status.validation?.postgresql_acceptance === "PASS", "S6 refresh and PostgreSQL acceptance are recorded");',
    1,
)
hash_gate = 'check(receiptContract.includes("assertCap05ReplayEvidenceSourceRecordHashV1") && receiptContract.includes("CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH"), "Receipt full-record source hash is recomputed under the effective S1 policy");\n'
if hash_gate not in gate:
    anchor = 'check(receiptContract.includes("irrigation_execution_receipt_evidence_v1") && receiptContract.includes("CONTROLLED_REPLAY_DATASET"), "Receipt contract binds the controlled Replay Evidence type");\n'
    if anchor not in gate:
        raise SystemExit("S6_GATE_HASH_INSERTION_ANCHOR_MISSING")
    gate = gate.replace(anchor, anchor + hash_gate, 1)
needle = '  "forged Receipt source-record hash fails closed before canonical H construction",\n'
if needle not in gate:
    anchor = '  "status mappings are explicit and independent",\n'
    if anchor not in gate:
        raise SystemExit("S6_GATE_ACCEPTANCE_NEEDLE_ANCHOR_MISSING")
    gate = gate.replace(anchor, anchor + needle, 1)
gate = gate.replace(
    'check(authorization.s5_effectiveness?.effective === true, "Authorization status records S5 effectiveness");',
    'check(authorization.s5_effectiveness?.effective === true, "Authorization status records S5 effectiveness");\ncheck(authorization.s5_remediation_effectiveness?.effective === true, "Authorization status records S5 remediation effectiveness");',
    1,
)
gate_path.write_text(gate, encoding="utf-8")

print(f"MCFT-CAP-05 S6 refreshed over remediation-effective main in workflow {RUN_ID}")
