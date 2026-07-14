from pathlib import Path
import json
import os
import re

BASELINE = "55b61b36a7d408ab68c2786499e14bab886d01e2"
BRANCH = "agent/mcft-cap-05-s1-controlled-feedback-replay-dataset-v1"
S0 = "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1"
S1 = "MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1"
S2 = "MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1"
S0_PR = 2435
S0_EXACT_HEAD = "0d86de86c1f887a0d1b1a4a1aeb98afab6ed432f"
S0_MATERIALIZATION_WORKFLOW = 29305892261
S0_EXACT_HEAD_WORKFLOW = 29306001138
S0_MERGE = BASELINE
S0_POSTMERGE_PR = 2437
S0_POSTMERGE_WORKFLOW = 29306075015
S1_MATERIALIZATION_WORKFLOW = int(os.environ["GITHUB_RUN_ID"])

ROOT = Path.cwd()
MAP = ROOT / "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
MATRIX = ROOT / "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
TASK = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md"
AUTH_STATUS = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
DELIVERY = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
CONTRACT = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CONTROLLED-REPLAY-DATASET-CONTRACT.md"
STATUS = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S1-STATUS.json"
MANIFEST = ROOT / "fixtures/mcft/water_state/feedback_v1/manifest.json"

FIXTURE_FILES = [
    "fixtures/mcft/water_state/feedback_v1/approval_assertions.jsonl",
    "fixtures/mcft/water_state/feedback_v1/approved_plans.jsonl",
    "fixtures/mcft/water_state/feedback_v1/decision_requests.jsonl",
    "fixtures/mcft/water_state/feedback_v1/et0_context.jsonl",
    "fixtures/mcft/water_state/feedback_v1/execution_receipts.jsonl",
    "fixtures/mcft/water_state/feedback_v1/external_dispatch.jsonl",
    "fixtures/mcft/water_state/feedback_v1/manifest.json",
    "fixtures/mcft/water_state/feedback_v1/rainfall_context.jsonl",
    "fixtures/mcft/water_state/feedback_v1/soil_observations.jsonl",
]
EXACT_FILES = sorted([
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CONTROLLED-REPLAY-DATASET-CONTRACT.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S1-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "fixtures/mcft/water_state/negative/MCFT_CAP_05_NEGATIVE_FIXTURES.json",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTROLLED_REPLAY_DATASET.cjs",
    "scripts/mcft/GENERATE_MCFT_CAP_05_FEEDBACK_DATASET.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_EVIDENCE_INGRESS_DB.ts",
    *FIXTURE_FILES,
])

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
if manifest["top_level_evidence_record_count"] != 8 or manifest["negative_fixture_count"] != 12:
    raise SystemExit("S1 manifest counts invalid")

s0_effectiveness = {
    "pr_number": S0_PR,
    "exact_head": S0_EXACT_HEAD,
    "postgresql_materialization_workflow": S0_MATERIALIZATION_WORKFLOW,
    "exact_head_workflow": S0_EXACT_HEAD_WORKFLOW,
    "merge_commit": S0_MERGE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": S0_POSTMERGE_PR,
    "merged_main_gate_workflow": S0_POSTMERGE_WORKFLOW,
    "merged_main_gate": "PASS",
    "effective": True,
}

contract = f'''<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CONTROLLED-REPLAY-DATASET-CONTRACT.md -->
# GEOX MCFT-CAP-05 S1 Controlled Feedback Replay Dataset Contract

```text
delivery_slice_id: {S1}
primary_owner_work_package_id: MCFT-01
contributing_owner_work_package_ids: MCFT-13, MCFT-15
status: IMPLEMENTATION_CANDIDATE
baseline_main_commit: {BASELINE}
S0_merged_main_gate: {S0_POSTMERGE_WORKFLOW} SUCCESS
```

## Dataset authority

```text
dataset_id: {manifest['dataset_id']}
dataset_truth_class: CONTROLLED_REPLAY_EVIDENCE
positive evidence records: 8
negative fixtures: 12
target receipt-consuming State tick: 2026-06-04T02:00:00.000Z
target outcome observation time: 2026-06-04T03:00:00.000Z
whole dataset semantic hash: {manifest['whole_dataset_semantic_hash']}
```

The dataset contains one controlled Human Decision request, one Approval Assertion Evidence record, one Approved Irrigation Plan Snapshot, one optional External Dispatch Evidence record, one irrigation Execution Receipt Evidence record, one exact 03:00 soil observation, one rainfall-context record and one historical-ET0 context record.

## Evidence identity and availability

Every record carries:

```text
dataset_id
source_record_id
source_record_hash
evidence_identity_key
idempotency_key
record_type
binding_id
origin_source_kind / origin_source_id
ingress_adapter_id / ingress_adapter_version
scope
role_time
available_to_runtime_at
quality
limitations
source_payload
canonical_payload
```

`source_record_hash` is calculated over canonical semantic content excluding only the hash itself and materialized file location. `available_to_runtime_at` is explicit Replay logical-time authority. S1 does not use wall clock, file mtime, process identity, network, branch name or database-generated identity.

## Standard cycle

```text
Scenario amount: 15.000000 mm
Approved amount: 14.000000 mm
Actual covered-footprint amount: 13.600000 mm
Spatial coverage fraction: 0.910000
Target-scope-equivalent irrigation: 12.376000 mm
Receipt available: 2026-06-04T01:55:00.000Z
Target State tick: 2026-06-04T02:00:00.000Z
Post-execution soil observation: 2026-06-04T03:00:00.000Z
```

The Approved Plan Snapshot references the Approval Assertion Evidence by exact source-record ref/hash. The receipt references the Approved Plan and optional External Dispatch Evidence. Amounts remain distinct and coverage is represented explicitly.

## Existing facts ingress proof

`ACCEPTANCE_MCFT_CAP_05_REPLAY_EVIDENCE_INGRESS_DB.ts` uses the existing append-only `facts` schema. It proves:

```text
first ingress: 8 INSERTED
same identity and same semantic hash: 8 EXISTING
same identity and different semantic hash: conflict and atomic no-append
exact identity/hash/availability readback: PASS
```

This acceptance helper adds no production ingress service or migration.

## Negative inventory

```text
late after logical-time cutoff
late after Evidence Window freeze
cross-hour execution
multiple event
conflicting duplicate
wrong scope
wrong binding
wrong unit
wrong status
missing approval assertion
plan/assertion mismatch
Evidence identity conflict
```

## Nonclaims

```text
NO_CANONICAL_DECISION_OBJECT
NO_CANONICAL_ACTION_FEEDBACK_OBJECT
NO_CANONICAL_FORECAST_RESIDUAL_OBJECT
NO_STATE_OR_CHECKPOINT_WRITE
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_GEOX_APPROVAL_AUTHORITY
NO_GEOX_DISPATCH
NO_AO_ACT_CHANGE
NO_RUNTIME_SOURCE_CHANGE_IN_S1
NO_MIGRATION
NO_ROUTE
NO_WEB
NO_CAP_06_AUTHORIZATION
```
'''
CONTRACT.write_text(contract, encoding="utf-8")

status = {
    "schema_version": "geox_mcft_cap_05_s1_status_v1",
    "capability_line_id": "MCFT-CAP-05",
    "delivery_slice_id": S1,
    "slice_kind": "CONTROLLED_REPLAY_EVIDENCE_DATASET",
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "s0_effectiveness": s0_effectiveness,
    "dataset": {
        "dataset_id": manifest["dataset_id"],
        "manifest_ref": "fixtures/mcft/water_state/feedback_v1/manifest.json",
        "manifest_hash": manifest["whole_dataset_semantic_hash"],
        "positive_record_count": 8,
        "positive_file_count": 8,
        "negative_fixture_count": 12,
        "target_state_tick": manifest["target_state_tick"],
        "target_outcome_observation_time": manifest["target_outcome_observation_time"],
        "standard_values": manifest["standard_values"],
    },
    "materialization_workflow_run": S1_MATERIALIZATION_WORKFLOW,
    "runtime_source_changed": False,
    "migration_changed": False,
    "canonical_twin_object_fact_delta": 0,
    "replay_evidence_fact_delta": 8,
    "projection_row_delta": 0,
    "postgresql_ingress_expected": {
        "first_ingress": "8_INSERTED",
        "idempotent_replay": "8_EXISTING",
        "conflicting_duplicate": "REJECT_ATOMIC_NO_APPEND",
    },
    "exact_changed_file_boundary": EXACT_FILES,
    "preserved_nonclaims": [
        "NO_CANONICAL_DECISION_OBJECT",
        "NO_CANONICAL_ACTION_FEEDBACK_OBJECT",
        "NO_CANONICAL_FORECAST_RESIDUAL_OBJECT",
        "NO_STATE_OR_CHECKPOINT_WRITE",
        "NO_RUNTIME_SOURCE_CHANGE_IN_S1",
        "NO_MIGRATION",
        "NO_ROUTE",
        "NO_WEB",
        "NO_AO_ACT_CHANGE",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "next_delivery_slice_id": S2,
    "next_delivery_slice_authorized": False,
    "effectiveness_condition": "S1_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S1_GATE_PASS",
    "effectiveness_condition_satisfied": False,
}
STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

auth = json.loads(AUTH_STATUS.read_text(encoding="utf-8"))
auth.update({
    "status": "MERGED_EFFECTIVE",
    "design_status": "DESIGN_FROZEN",
    "implementation_status": "IN_PROGRESS",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "baseline_main_commit": BASELINE,
    "active_delivery_slice_id": S1,
    "current_blockers": [],
    "s0_effectiveness": s0_effectiveness,
    "next_authorized_slice_id_after_effectiveness": S1,
    "successor_authorized": False,
})
AUTH_STATUS.write_text(json.dumps(auth, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

delivery = json.loads(DELIVERY.read_text(encoding="utf-8"))
delivery.update({
    "status": "S1_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S1,
    "runtime_source_authorized": True,
    "authorization_effective": True,
    "s0_effectiveness": s0_effectiveness,
    "next_authorized_slice_ids": [],
    "next_authorized_slice_id_after_merge_and_postmerge_gate": S2,
})
for item in delivery["slices"]:
    if item["delivery_slice_id"] == S0:
        item.update({"status": "MERGED_EFFECTIVE", "merge_commit": S0_MERGE, "exact_head": S0_EXACT_HEAD, "exact_head_workflow": S0_EXACT_HEAD_WORKFLOW, "merged_main_gate_workflow": S0_POSTMERGE_WORKFLOW, "effectiveness_condition_satisfied": True})
    elif item["delivery_slice_id"] == S1:
        item.update({"status": "IMPLEMENTATION_CANDIDATE", "baseline_main_commit": BASELINE, "branch": BRANCH, "runtime_source_authorized": False, "exact_changed_file_boundary": EXACT_FILES, "allowed_claims": ["CONTROLLED_FEEDBACK_REPLAY_DATASET_ESTABLISHED", "REPLAY_EVIDENCE_IDENTITY_IDEMPOTENCY_ESTABLISHED", "EXISTING_FACTS_INGRESS_COMPATIBILITY_ESTABLISHED"], "effectiveness_condition": "S1_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S1_GATE_PASS", "effectiveness_condition_satisfied": False})
    elif item["delivery_slice_id"] == S2:
        item.update({"status": "BLOCKED", "baseline_main_commit": None, "branch": None, "runtime_source_authorized": False})
DELIVERY.write_text(json.dumps(delivery, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
cap05 = next(x for x in matrix["capability_lines"] if x["capability_line_id"] == "MCFT-CAP-05")
cap05.update({
    "status": "IN_PROGRESS",
    "design_status": "DESIGN_FROZEN",
    "implementation_status": "S1_IMPLEMENTATION_CANDIDATE",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "current_repository_baseline_commit": BASELINE,
    "active_delivery_slice_id": S1,
    "next_delivery_slice_id": S2,
    "next_delivery_slice_authorized": False,
    "delivery_slices": delivery["slices"],
    "next_authorized_slice_ids": [],
    "effectiveness_condition": "S1_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S1_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
matrix["baseline"] = {"branch": "main", "commit": BASELINE, "meaning": "MCFT-CAP-05 S0 merged-main effective; S1 controlled feedback Replay Dataset implementation candidate"}
matrix["latest_governance_update"] = S1
MATRIX.write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

task = TASK.read_text(encoding="utf-8")
pattern = re.compile(r"当前状态：\n\n```text\narchitecture_direction:\n.*?\nfirst_permitted_repository_action:\n.*?\n```", re.S)
replacement = f'''当前状态：

```text
architecture_direction:
CONFORMANT

design_status:
DESIGN_FROZEN

implementation_status:
S1_IMPLEMENTATION_CANDIDATE

authorization_effective:
true

runtime_source_authorized:
true

active_delivery_slice_id:
{S1}

dt02_architecture_amendment_status:
NOT_REQUIRED_MERGED_EFFECTIVE

first_permitted_repository_action:
{S1}
```'''
task, count = pattern.subn(replacement, task, count=1)
if count != 1:
    raise SystemExit("task status block not replaced")
marker = "# 25. S1 — Controlled Replay Dataset"
identity = f'''

S1 implementation candidate identity：

```text
baseline_main_commit:
{BASELINE}

S0 exact head:
{S0_EXACT_HEAD}

S0 merge commit:
{S0_MERGE}

S0 merged-main Authorization Gate workflow:
{S0_POSTMERGE_WORKFLOW} SUCCESS

S1 status:
IMPLEMENTATION_CANDIDATE

S1 materialization workflow:
{S1_MATERIALIZATION_WORKFLOW}

positive Replay Evidence records:
8

negative fixtures:
12

canonical Twin object fact delta:
0

Replay Evidence fact delta:
8

S2 authorized:
false
```
'''
if "S1 implementation candidate identity：" not in task:
    task = task.replace(marker, marker + identity, 1)
TASK.write_text(task, encoding="utf-8")

implementation_map = MAP.read_text(encoding="utf-8")
start = "<!-- MCFT-CAP-05-S1-DATASET-START -->"
if start not in implementation_map:
    implementation_map += f'''

{start}

## MCFT-CAP-05 S1 controlled feedback Replay Dataset candidate

```text
baseline main: {BASELINE}
S0 exact head: {S0_EXACT_HEAD}
S0 merge commit: {S0_MERGE}
S0 merged-main Authorization Gate: {S0_POSTMERGE_WORKFLOW} SUCCESS
active delivery slice: {S1}
status: IMPLEMENTATION_CANDIDATE
authorization effective: true
capability Runtime source authority: true
S1 Runtime source change: false
positive Replay Evidence records: 8
negative fixtures: 12
canonical Twin object fact delta: 0
Replay Evidence fact delta: 8
next delivery slice: {S2}
next delivery slice authorized: false
successor MCFT-CAP-06 authorized: false
```

Established in this bounded slice: deterministic Human Decision request, Approval Assertion, Approved Plan, optional External Dispatch, Execution Receipt, exact 03:00 soil observation, rainfall and ET0 Replay Evidence; source semantic hashes; logical-time availability; Evidence identity/idempotency; deterministic generation; and isolated PostgreSQL append-only facts ingress proof.

No `twin_decision_record_v1`, `twin_action_feedback_v1`, `twin_forecast_residual_v1`, State, checkpoint, migration, production Runtime source, route, web, Recommendation, AO-ACT, calibration or CAP-06 authorization is introduced.

<!-- MCFT-CAP-05-S1-DATASET-END -->
'''
MAP.write_text(implementation_map, encoding="utf-8")
