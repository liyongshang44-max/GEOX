from pathlib import Path
import json
import os
import re

BASELINE = "552d19505f0cd93584c899665b7d7b339f67e9fe"
BRANCH = "agent/mcft-cap-05-s2-contracts-projection-math-config-v1"
S1 = "MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1"
S2 = "MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1"
S3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1"
S1_PR = 2438
S1_EXACT_HEAD = "6e2e3e238c5b7886e4d21d7899406e5642192500"
S1_MATERIALIZATION_WORKFLOW = 29306561067
S1_EXACT_HEAD_WORKFLOW = 29306684953
S1_MERGE = BASELINE
S1_POSTMERGE_PR = 2440
S1_POSTMERGE_WORKFLOW = 29306783482
S2_PURE_VALIDATION_WORKFLOW = 29307407557
S2_MATERIALIZATION_WORKFLOW = int(os.environ["GITHUB_RUN_ID"])

ROOT = Path.cwd()
MAP = ROOT / "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
MATRIX = ROOT / "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
TASK = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md"
AUTH_STATUS = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json"
DELIVERY = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json"
CONTRACT = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md"
STATUS = ROOT / "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-STATUS.json"
GATE = ROOT / "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs"

EXACT_FILES = sorted([
    "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
    "apps/server/src/domain/twin_runtime/decision_second_write_policy_v1.ts",
    "apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts",
    "apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.ts",
    "apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.ts",
    "apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-STATUS.json",
    "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts",
])

s1_effectiveness = {
    "pr_number": S1_PR,
    "exact_head": S1_EXACT_HEAD,
    "materialization_workflow": S1_MATERIALIZATION_WORKFLOW,
    "exact_head_workflow": S1_EXACT_HEAD_WORKFLOW,
    "merge_commit": S1_MERGE,
    "head_to_merge_file_delta_count": 0,
    "tree_equivalence": "PASS",
    "postmerge_probe_pr_number": S1_POSTMERGE_PR,
    "merged_main_gate_workflow": S1_POSTMERGE_WORKFLOW,
    "merged_main_gate": "PASS",
    "effective": True,
}

contract = f'''<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md -->
# GEOX MCFT-CAP-05 S2 Contracts, Projection Math and Runtime Config

```text
delivery_slice_id: {S2}
status: IMPLEMENTATION_CANDIDATE
baseline_main_commit: {BASELINE}
S1_merged_main_gate: {S1_POSTMERGE_WORKFLOW} SUCCESS
pure_validation_workflow: {S2_PURE_VALIDATION_WORKFLOW} SUCCESS
```

## Frozen DT-02 reuse

```text
twin_decision_record_v1 -> G_HUMAN_DECISION_LINK_COMMIT
twin_action_feedback_v1 -> H_ACTION_FEEDBACK_COMMIT
twin_forecast_residual_v1 -> C_FORECAST_RESIDUAL_COMMIT
new canonical object type: none
new transaction family: none
```

All three objects use the frozen DT-02 `NON_LINEAGE_CONTEXT` envelope. `context_lineage_ref` and `context_revision_ref` are trace context only; no lineage ownership is claimed.

## Human Decision

```text
contract_id: MCFT_CAP_05_HUMAN_DECISION_V1
selected_option_reference_policy: GEOX_SCENARIO_OPTION_MEMBER_REF_BY_OPTION_ID_V1
second_write_policy: IMMUTABLE_CONFLICT_V1
logical_time: Scenario Set logical_time
as_of: decided_at
```

The selected option is resolved by exact `option_id` from the Scenario Set options array. It is a GEOX semantic member reference, not an RFC 6901 JSON Pointer. Identical replay returns existing semantics; a second different decision for the same Scenario Set conflicts.

## Action Feedback

```text
contract_id: MCFT_CAP_05_ACTION_FEEDBACK_V1
eligibility_policy: EXECUTED_OR_PARTIAL_VALIDATED_USABLE_EXACT_SCOPE_V1
quality_mapping: PASS/LIMITED -> USABLE; FAIL -> UNUSABLE
logical_time: execution_end
as_of: available_to_runtime_at
adapter: ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1
single_event_guard: EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1
```

The adapter supplies the existing `ExecutedIrrigationCandidateV1` fields: binding, origin source, exact scope, event ID, source record ID, execution/ingestion times, actual amount, coverage, eligibility, source quality and normalized execution status. `PARTIALLY_EXECUTED` may normalize to candidate `EXECUTED` only after eligibility validation, while the source status remains in the adapter trace.

## Forecast projection and residual

```text
projection_method: FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
variance_method: STORAGE_VARIANCE_DIVIDED_BY_ROOT_ZONE_DEPTH_SQUARED_V1
residual_formula: actual_observation - projected_forecast
normalized_residual: residual / sqrt(predicted_variance + observation_variance + representativeness_variance)
observation_operator_h: 1.000000
direct_state_equivalence: false
```

The Forecast produces root-zone storage, not a 200 mm point prediction. Root-zone storage is projected to root-zone mean VWC. The existing 200 mm observation is used through H=1 with explicit representativeness variance. `Forecast Residual` remains distinct from `Assimilation Innovation`; the Residual may reference an Assimilation Update but owns no gain, posterior mean or State authority.

## Runtime Config chain

```text
config_purpose: HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1
chain_length: 8
first logical time: 2026-06-04T02:00:00.000Z
parent authority: exact predecessor State-bound CAP-04 Runtime Config ref/hash
selection_mode: PERSISTED_PREDECESSOR_CHAIN_ONLY_V1
```

Inherited CAP-04 water-model, Forecast and Scenario authority is validated under the CAP-04 contract before CAP-05 policies are added. No active-config pointer substitutes for the persisted predecessor chain.

## Feedback-cycle projection

The rebuildable projection contains explicit phases:

```text
Decision
Approval Assertion
Approved Plan
Dispatch disposition
Execution
Outcome Observation
Forecast Residual
Assimilation
Updated State
```

Dispatch disposition is one of `NOT_OBSERVED`, `NOT_APPLICABLE`, or `EXTERNALLY_RECORDED`. The projection is not canonical truth and makes no causal-effect or action-effectiveness claim.

## S2 nonclaims

```text
NO_PERSISTENCE
NO_MIGRATION
NO_CANONICAL_APPEND
NO_DECISION_FACT_WRITTEN
NO_ACTION_FEEDBACK_FACT_WRITTEN
NO_FORECAST_RESIDUAL_FACT_WRITTEN
NO_STATE_OR_CHECKPOINT_WRITE
NO_ROUTE
NO_WEB
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CAP_06_AUTHORIZATION
```
'''
CONTRACT.write_text(contract, encoding="utf-8")

status = {
    "schema_version": "geox_mcft_cap_05_s2_status_v1",
    "capability_line_id": "MCFT-CAP-05",
    "delivery_slice_id": S2,
    "slice_kind": "PURE_CONTRACTS_PROJECTION_MATH_CONFIG",
    "status": "IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "s1_effectiveness": s1_effectiveness,
    "pure_validation_workflow": S2_PURE_VALIDATION_WORKFLOW,
    "materialization_workflow": S2_MATERIALIZATION_WORKFLOW,
    "contracts": {
        "decision_contract_id": "MCFT_CAP_05_HUMAN_DECISION_V1",
        "decision_transaction_variant": "G_HUMAN_DECISION_LINK_COMMIT",
        "action_feedback_contract_id": "MCFT_CAP_05_ACTION_FEEDBACK_V1",
        "action_feedback_transaction_variant": "H_ACTION_FEEDBACK_COMMIT",
        "forecast_residual_contract_id": "MCFT_CAP_05_FORECAST_OBSERVATION_RESIDUAL_V1",
        "forecast_residual_transaction_variant": "C_FORECAST_RESIDUAL_COMMIT",
        "new_canonical_object_types": [],
        "new_transaction_families": [],
    },
    "math": {
        "projection_method_id": "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1",
        "variance_projection_method_id": "STORAGE_VARIANCE_DIVIDED_BY_ROOT_ZONE_DEPTH_SQUARED_V1",
        "residual_formula_id": "ACTUAL_MINUS_PREDICTED_V1",
        "normalized_residual_formula_id": "RESIDUAL_DIVIDED_BY_SQRT_PREDICTED_PLUS_OBSERVATION_VARIANCE_V1",
        "forecast_assimilation_relation_policy_id": "DISTINCT_UNLESS_EXPLICIT_EQUIVALENCE_PROOF_V1",
        "fixed_point_authority": True,
    },
    "runtime_config": {
        "config_purpose": "HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1",
        "chain_length": 8,
        "first_effective_logical_time": "2026-06-04T02:00:00.000Z",
        "parent_ref_authority": "PREDECESSOR_STATE_BOUND_RUNTIME_CONFIG",
        "selection_mode": "PERSISTED_PREDECESSOR_CHAIN_ONLY_V1",
    },
    "adapter": {
        "adapter_id": "ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1",
        "target_contract": "ExecutedIrrigationCandidateV1",
        "single_event_guard_policy_id": "EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1",
    },
    "canonical_twin_object_fact_delta": 0,
    "replay_evidence_fact_delta": 0,
    "projection_row_delta": 0,
    "migration_delta": 0,
    "exact_changed_file_boundary": EXACT_FILES,
    "preserved_nonclaims": [
        "NO_PERSISTENCE",
        "NO_MIGRATION",
        "NO_CANONICAL_APPEND",
        "NO_STATE_OR_CHECKPOINT_WRITE",
        "NO_ROUTE",
        "NO_WEB",
        "NO_RECOMMENDATION",
        "NO_AO_ACT_CHANGE",
        "NO_CALIBRATION_CANDIDATE",
        "NO_MODEL_ACTIVATION",
        "NO_CAP_06_AUTHORIZATION",
    ],
    "next_delivery_slice_id": S3,
    "next_delivery_slice_authorized": False,
    "effectiveness_condition": "S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS",
    "effectiveness_condition_satisfied": False,
}
STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

auth = json.loads(AUTH_STATUS.read_text(encoding="utf-8"))
auth.update({
    "status": "MERGED_EFFECTIVE",
    "design_status": "DESIGN_FROZEN",
    "implementation_status": "S2_IMPLEMENTATION_CANDIDATE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "baseline_main_commit": BASELINE,
    "active_delivery_slice_id": S2,
    "s1_effectiveness": s1_effectiveness,
    "next_authorized_slice_id_after_effectiveness": S2,
    "successor_authorized": False,
})
AUTH_STATUS.write_text(json.dumps(auth, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

delivery = json.loads(DELIVERY.read_text(encoding="utf-8"))
delivery.update({
    "status": "S2_IMPLEMENTATION_CANDIDATE",
    "baseline_main_commit": BASELINE,
    "branch": BRANCH,
    "active_delivery_slice_id": S2,
    "runtime_source_authorized": True,
    "authorization_effective": True,
    "s1_effectiveness": s1_effectiveness,
    "next_authorized_slice_ids": [],
    "next_authorized_slice_id_after_merge_and_postmerge_gate": S3,
})
for item in delivery["slices"]:
    if item["delivery_slice_id"] == S1:
        item.update({
            "status": "MERGED_EFFECTIVE",
            "merge_commit": S1_MERGE,
            "exact_head": S1_EXACT_HEAD,
            "materialization_workflow": S1_MATERIALIZATION_WORKFLOW,
            "exact_head_workflow": S1_EXACT_HEAD_WORKFLOW,
            "merged_main_gate_workflow": S1_POSTMERGE_WORKFLOW,
            "effectiveness_condition_satisfied": True,
        })
    elif item["delivery_slice_id"] == S2:
        item.update({
            "status": "IMPLEMENTATION_CANDIDATE",
            "baseline_main_commit": BASELINE,
            "branch": BRANCH,
            "runtime_source_authorized": True,
            "exact_changed_file_boundary": EXACT_FILES,
            "allowed_claims": [
                "C_G_H_PURE_CONTRACTS_ESTABLISHED",
                "FORECAST_OBSERVATION_H1_PROJECTION_MATH_ESTABLISHED",
                "FORECAST_RESIDUAL_DISTINCT_FROM_ASSIMILATION_ESTABLISHED",
                "ACTION_FEEDBACK_EXECUTED_IRRIGATION_ADAPTER_ESTABLISHED",
                "CAP05_RUNTIME_CONFIG_CHAIN_ESTABLISHED",
                "FEEDBACK_CYCLE_PROJECTION_CONTRACT_ESTABLISHED",
            ],
            "effectiveness_condition": "S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS",
            "effectiveness_condition_satisfied": False,
        })
    elif item["delivery_slice_id"] == S3:
        item.update({"status": "BLOCKED", "baseline_main_commit": None, "branch": None, "runtime_source_authorized": False})
DELIVERY.write_text(json.dumps(delivery, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
cap05 = next(x for x in matrix["capability_lines"] if x["capability_line_id"] == "MCFT-CAP-05")
cap05.update({
    "status": "IN_PROGRESS",
    "design_status": "DESIGN_FROZEN",
    "implementation_status": "S2_IMPLEMENTATION_CANDIDATE",
    "authorization_status": "MERGED_EFFECTIVE",
    "authorization_effective": True,
    "runtime_source_authorized": True,
    "current_repository_baseline_commit": BASELINE,
    "active_delivery_slice_id": S2,
    "next_delivery_slice_id": S3,
    "next_delivery_slice_authorized": False,
    "delivery_slices": delivery["slices"],
    "next_authorized_slice_ids": [],
    "effectiveness_condition": "S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS",
    "effectiveness_condition_satisfied": False,
})
matrix["baseline"] = {"branch": "main", "commit": BASELINE, "meaning": "MCFT-CAP-05 S1 merged-main effective; S2 pure contracts, projection math and Runtime Config candidate"}
matrix["latest_governance_update"] = S2
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
S2_IMPLEMENTATION_CANDIDATE

authorization_effective:
true

runtime_source_authorized:
true

active_delivery_slice_id:
{S2}

dt02_architecture_amendment_status:
NOT_REQUIRED_MERGED_EFFECTIVE

first_permitted_repository_action:
{S2}
```'''
task, count = pattern.subn(replacement, task, count=1)
if count != 1:
    raise SystemExit("task status block not replaced")
marker = "# 26. S2 — Contracts, Projection Math and Runtime Config"
identity = f'''

S2 implementation candidate identity：

```text
baseline_main_commit:
{BASELINE}

S1 exact head:
{S1_EXACT_HEAD}

S1 merge commit:
{S1_MERGE}

S1 merged-main Gate workflow:
{S1_POSTMERGE_WORKFLOW} SUCCESS

S2 status:
IMPLEMENTATION_CANDIDATE

S2 pure validation workflow:
{S2_PURE_VALIDATION_WORKFLOW} SUCCESS

S2 materialization workflow:
{S2_MATERIALIZATION_WORKFLOW}

canonical Twin object fact delta:
0

migration delta:
0

S3 authorized:
false
```
'''
if "S2 implementation candidate identity：" not in task:
    task = task.replace(marker, marker + identity, 1)
TASK.write_text(task, encoding="utf-8")

implementation_map = MAP.read_text(encoding="utf-8")
start = "<!-- MCFT-CAP-05-S2-CONTRACTS-CONFIG-START -->"
if start not in implementation_map:
    implementation_map += f'''

{start}

## MCFT-CAP-05 S2 contracts, projection math and Runtime Config candidate

```text
baseline main: {BASELINE}
S1 exact head: {S1_EXACT_HEAD}
S1 merge commit: {S1_MERGE}
S1 merged-main Gate: {S1_POSTMERGE_WORKFLOW} SUCCESS
active delivery slice: {S2}
status: IMPLEMENTATION_CANDIDATE
authorization effective: true
runtime source authorized: true
new canonical object types: 0
new transaction families: 0
canonical fact delta: 0
migration delta: 0
next delivery slice: {S3}
next delivery slice authorized: false
successor MCFT-CAP-06 authorized: false
```

Established in this bounded slice: pure G Decision, H Action Feedback and C Forecast Residual builders/validators; immutable Decision second-write policy; Action Feedback to existing ExecutedIrrigationCandidateV1 adapter; exact-one-event guard; fixed-point H=1 Forecast-to-observation projection and normalized residual math; eight immutable CAP-05 Runtime Configs chained from the predecessor State-bound config; and rebuildable feedback-cycle projection.

Persistence, migration, canonical append, State/checkpoint writes, route, web, Recommendation, AO-ACT change, calibration and model activation remain outside S2.

<!-- MCFT-CAP-05-S2-CONTRACTS-CONFIG-END -->
'''
MAP.write_text(implementation_map, encoding="utf-8")

acceptance = r'''// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs
// Purpose: verify the exact MCFT-CAP-05 S2 pure-contract, projection-math and Runtime Config candidate boundary.
// Boundary: static governance checks only; no database, migration, canonical append, route, web, scheduler or network mutation.

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = process.cwd();
const baseline = process.env.MCFT_CAP_05_S2_BASELINE || "552d19505f0cd93584c899665b7d7b339f67e9fe";
const postmerge = process.argv.includes("--postmerge");
const s2 = "MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1";
const s3 = "MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1";
const files = {
  decision: "apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts",
  adapter: "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
  decisionPolicy: "apps/server/src/domain/twin_runtime/decision_second_write_policy_v1.ts",
  cycle: "apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.ts",
  config: "apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.ts",
  residual: "apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.ts",
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  auth: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  delivery: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  contract: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md",
  status: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-STATUS.json",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S2_CONTRACTS_CONFIG.cjs",
  runtimeAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts",
};
const expected = Object.values(files).sort();
let pass = 0;
let fail = 0;
function check(condition, label, detail = "") { if (condition) { pass++; console.log(`PASS ${label}`); } else { fail++; console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`); } }
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function git(args) { return cp.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
function cap(matrix, id) { return matrix.capability_lines.find((entry) => entry.capability_line_id === id); }
for (const file of expected) check(fs.existsSync(path.join(root, file)), `file exists ${file}`);
const status = json(files.status);
const matrix = json(files.matrix);
const auth = json(files.auth);
const delivery = json(files.delivery);
const task = read(files.task);
const map = read(files.map);
const contract = read(files.contract);
const decision = read(files.decision);
const adapter = read(files.adapter);
const config = read(files.config);
const residual = read(files.residual);
const cycle = read(files.cycle);
const cap05 = cap(matrix, "MCFT-CAP-05");
check(status.schema_version === "geox_mcft_cap_05_s2_status_v1", "S2 status schema exact");
check(status.status === "IMPLEMENTATION_CANDIDATE" && status.baseline_main_commit === baseline, "S2 status and baseline exact");
check(status.s1_effectiveness.effective === true && status.s1_effectiveness.merged_main_gate === "PASS", "S1 effectiveness recorded");
check(status.contracts.new_canonical_object_types.length === 0 && status.contracts.new_transaction_families.length === 0, "no new DT-02 object or transaction family");
check(status.math.projection_method_id === "FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1", "H1 projection method exact");
check(status.math.fixed_point_authority === true, "fixed-point math authority");
check(status.runtime_config.chain_length === 8 && status.runtime_config.parent_ref_authority === "PREDECESSOR_STATE_BOUND_RUNTIME_CONFIG", "Runtime Config chain authority exact");
check(status.canonical_twin_object_fact_delta === 0 && status.migration_delta === 0, "S2 fact and migration delta zero");
check(status.next_delivery_slice_id === s3 && status.next_delivery_slice_authorized === false, "S3 remains blocked");
check(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expected), "status exact changed-file boundary");
check(auth.active_delivery_slice_id === s2 && auth.implementation_status === "S2_IMPLEMENTATION_CANDIDATE", "authorization status active S2");
check(delivery.active_delivery_slice_id === s2 && delivery.status === "S2_IMPLEMENTATION_CANDIDATE", "delivery status active S2");
check(delivery.slices.some((item) => item.delivery_slice_id === s2 && item.status === "IMPLEMENTATION_CANDIDATE"), "S2 delivery candidate present");
check(delivery.slices.some((item) => item.delivery_slice_id === s3 && item.status === "BLOCKED"), "S3 delivery remains blocked");
check(cap05.active_delivery_slice_id === s2 && cap05.next_delivery_slice_id === s3 && cap05.next_delivery_slice_authorized === false, "matrix S2 active S3 blocked");
check(task.includes(`active_delivery_slice_id:\n${s2}`) && task.includes("S2 status:\nIMPLEMENTATION_CANDIDATE"), "task records S2 candidate");
check(task.includes("S3 authorized:\nfalse"), "task preserves S3 block");
check(map.includes("MCFT-CAP-05-S2-CONTRACTS-CONFIG-START") && map.includes("canonical fact delta: 0"), "implementation map S2 section exact");
check(contract.includes("Forecast Residual remains distinct from `Assimilation Innovation`"), "contract separates residual and innovation");
check(decision.includes("G_HUMAN_DECISION_LINK_COMMIT") && decision.includes("H_ACTION_FEEDBACK_COMMIT"), "Decision and Action Feedback reuse G/H");
check(decision.includes("GEOX_SCENARIO_OPTION_MEMBER_REF_BY_OPTION_ID_V1"), "semantic option member reference policy frozen");
check(adapter.includes("ExecutedIrrigationCandidateV1") && adapter.includes("EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1"), "adapter and single-event guard frozen");
check(config.includes("HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1") && config.includes("CAP05_CONFIG_CHAIN_LENGTH_V1 = 8"), "CAP-05 Runtime Config purpose and length exact");
check(config.includes("CAP04_CONFIG_SELECTION_MODE_V1") && config.includes("PERSISTED_PREDECESSOR_CHAIN_ONLY_V1"), "inherited and CAP-05 config selection semantics separated");
check(residual.includes("FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1"), "production residual code uses root-zone-mean projection");
check(!residual.includes("ROOT_ZONE_STORAGE_TO_POINT_200MM_VWC_V1"), "withdrawn point-200mm projection absent from production code");
check(residual.includes("DISTINCT_UNLESS_EXPLICIT_EQUIVALENCE_PROOF_V1") && residual.includes("equivalence_claimed: false"), "residual/innovation distinction frozen");
check(!residual.includes("assimilation_gain") && !residual.includes("posterior_mean"), "Residual owns no gain or posterior mean");
check(cycle.includes("dispatch_disposition") || cycle.includes("disposition"), "feedback-cycle projection exposes Dispatch disposition");
let changed = [];
try {
  changed = git(["diff", "--name-only", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expected), "git exact changed-file boundary", JSON.stringify(changed));
} catch (error) { check(false, "git exact changed-file boundary", error.message); }
for (const file of changed) check(!file.startsWith("apps/server/db/migrations/") && !file.startsWith("apps/web/") && !file.includes("route"), `no forbidden path ${file}`);
try { git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]); check(true, "git diff --check"); } catch (error) { check(false, "git diff --check", error.message); }
console.log(`MCFT-CAP-05 S2 governance: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
'''
GATE.write_text(acceptance, encoding="utf-8")
