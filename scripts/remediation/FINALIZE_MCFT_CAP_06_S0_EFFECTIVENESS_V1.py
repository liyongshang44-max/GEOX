# scripts/remediation/FINALIZE_MCFT_CAP_06_S0_EFFECTIVENESS_V1.py
# Purpose: materialize the already-proven S0 merged-main effectiveness and authorize only S1.
# Boundary: one-time governance finalizer; it removes itself and all temporary workflows before commit.

from __future__ import annotations

import json
import re
from pathlib import Path

BASE = "4c93ec59a6ac0b53b43584cbef1a7e0295d6b58a"
EXACT_HEAD = "375adfa3ba85082c1742b30314951df61b3a1936"
EXACT_CI = 29471606766
PROBE_PR = 2511
PROBE_RUN = 29472057972
S0 = "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1"
S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1"
EFFECT = "MCFT-CAP-06.S0.MERGED-MAIN-EFFECTIVENESS-ACTIVATION-V1"
EFFECT_REF = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-EFFECTIVENESS.json"
EFFECT_FILES = [
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
    EFFECT_REF,
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts",
]


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path: str, value: object) -> None:
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_once(path: str, marker: str, block: str) -> None:
    file = Path(path)
    source = file.read_text(encoding="utf-8")
    if marker not in source:
        file.write_text(source.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")


def replace_header_field(header: str, key: str, expected: str, replacement: str) -> str:
    pattern = rf"({re.escape(key)}:\n){re.escape(expected)}"
    result, count = re.subn(pattern, rf"\g<1>{replacement}", header, count=1)
    if count != 1:
        raise RuntimeError(f"TASK_HEADER_FIELD_MATCH:{key}:{count}")
    return result


def write_effectiveness_record() -> None:
    print("[effectiveness] write record")
    save_json(EFFECT_REF, {
        "schema_version": "geox_mcft_cap_06_s0_effectiveness_v1",
        "effectiveness_id": EFFECT,
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S0,
        "status": "MERGED_EFFECTIVE",
        "effective": True,
        "implementation_pr_number": 2508,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "implementation_merge_commit": BASE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_probe_closed_without_merge": True,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "dataset_qualification_status": "INSUFFICIENT_MATCHED_PAIRS",
        "case_graph_validation_status": "PASS",
        "availability_order_validation_status": "PASS",
        "homogeneity_validation_status": "PASS",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "active_delivery_slice_id": S1,
        "authorized_not_started_slice_ids": [S1],
        "canonical_write_effective": False,
        "model_activation_authorized": False,
        "active_config_switch_authorized": False,
        "successor_capability_line_authorized": False,
        "effectiveness_writeback_changed_file_boundary": EFFECT_FILES,
    })


def update_authorities() -> None:
    print("[effectiveness] update authority JSON")
    auth_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json"
    auth = load_json(auth_path)
    auth.update({
        "status": "MERGED_EFFECTIVE",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "migration_authorized": False,
        "canonical_write_authorized": False,
        "active_delivery_slice_id": S1,
        "predecessor_lock_status": "MERGED_EFFECTIVE",
        "current_authorized_slice_ids": [S1],
        "effectiveness_ref": EFFECT_REF,
        "effectiveness_writeback_changed_file_boundary": EFFECT_FILES,
    })
    auth["effectiveness"] = {
        "effective": True,
        "condition": "SATISFIED",
        "implementation_pr_number": 2508,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "merge_commit": BASE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
    }
    auth["preserved_nonclaims"] = [
        "NO_CAP_06_MIGRATION_AUTHORIZATION",
        "NO_CAP_06_CANONICAL_WRITE_EFFECTIVENESS_CLAIM",
        "NO_RESIDUAL_CREATED_BY_S0",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_AUTOMATIC_PARAMETER_UPDATE",
        "NO_STATE_MUTATION_BY_S0",
        "NO_CHECKPOINT_MUTATION_BY_S0",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_S2_AUTHORIZATION",
        "NO_SHADOW_ONLINE_CLAIM",
        "NO_FIELD_CALIBRATION_CLAIM",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    save_json(auth_path, auth)

    qualification_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json"
    qualification = load_json(qualification_path)
    qualification.update({
        "status": "MERGED_EFFECTIVE",
        "qualification_effective": True,
        "effectiveness_condition": "SATISFIED",
        "effectiveness_ref": EFFECT_REF,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "merge_commit": BASE,
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
    })
    save_json(qualification_path, qualification)

    lock_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json"
    lock = load_json(lock_path)
    lock.update({
        "status": "MERGED_EFFECTIVE",
        "lock_effective": True,
        "effectiveness_condition": "SATISFIED",
        "effectiveness_ref": EFFECT_REF,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "merge_commit": BASE,
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
    })
    save_json(lock_path, lock)


def update_delivery_and_current_state() -> None:
    print("[effectiveness] update delivery and current state")
    delivery_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json"
    delivery = load_json(delivery_path)
    delivery.update({
        "status": "IMPLEMENTATION_AUTHORIZED",
        "implementation_status": "S0_MERGED_EFFECTIVE_S1_AUTHORIZED_NOT_STARTED",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "active_delivery_slice_id": S1,
        "candidate_slices": [],
        "next_repository_action": S1,
        "authorized_not_started_slices": [S1],
        "s0_candidate_materialized": True,
        "s0_effective": True,
        "s0_effectiveness_ref": EFFECT_REF,
    })
    completed = [item for item in delivery.get("completed_or_effective_slices", []) if item.get("delivery_slice_id") != S0]
    completed.append({
        "delivery_slice_id": S0,
        "status": "MERGED_EFFECTIVE",
        "implementation_pr_number": 2508,
        "exact_head": EXACT_HEAD,
        "exact_head_ci_run": EXACT_CI,
        "merge_commit": BASE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "dataset_qualification_status": "INSUFFICIENT_MATCHED_PAIRS",
    })
    delivery["completed_or_effective_slices"] = completed
    delivery["blocked_slices"] = [item for item in delivery.get("blocked_slices", []) if item != S1]
    save_json(delivery_path, delivery)

    current_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
    current = load_json(current_path)
    current["current_state"].update({
        "s0": "MERGED_EFFECTIVE",
        "capability_line_authorization_effective": True,
        "runtime_source_authorized": True,
        "active_delivery_slice_id": S1,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
        "capability_complete": False,
    })
    current.setdefault("proof", {})["s0"] = {
        "implementation_pr_number": 2508,
        "exact_head": EXACT_HEAD,
        "exact_head_ci_run": EXACT_CI,
        "merge_commit": BASE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "effectiveness_ref": EFFECT_REF,
    }
    current["next_repository_action"] = S1
    current["preserved_nonclaims"] = [
        "NO_CAP_06_MIGRATION_AUTHORIZATION",
        "NO_CAP_06_CANONICAL_WRITE_EFFECTIVENESS_CLAIM",
        "NO_RESIDUAL_WINDOW_CREATED",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_S2_AUTHORIZATION",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    current["s0_effectiveness_ref"] = EFFECT_REF
    current["effectiveness_condition"] = "SATISFIED"
    save_json(current_path, current)


def update_matrix() -> None:
    print("[effectiveness] update vertical matrix")
    path = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    matrix = load_json(path)
    matrix["baseline"] = {
        "branch": "main",
        "commit": BASE,
        "meaning": "MCFT-CAP-06 S0 merged-main effective; S1 authorized not started; later slices and MCFT-CAP-07 remain blocked",
    }
    lines = matrix.get("capability_lines") or matrix.get("capabilities")
    if not isinstance(lines, list):
        raise RuntimeError("CAPABILITY_LINES_REQUIRED")
    line = next((item for item in lines if item.get("capability_line_id") == "MCFT-CAP-06"), None)
    if line is None:
        raise RuntimeError("MCFT_CAP_06_MATRIX_ENTRY_REQUIRED")
    line.update({
        "status": "IMPLEMENTATION_AUTHORIZED",
        "authorization_status": "MERGED_EFFECTIVE",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "design_status": "CONDITIONAL_FROZEN_AFTER_P_MINUS_1",
        "implementation_status": "S0_MERGED_EFFECTIVE_S1_AUTHORIZED_NOT_STARTED",
        "active_delivery_slice_id": S1,
        "dataset_qualification_status": "INSUFFICIENT_MATCHED_PAIRS",
        "predecessor_lock_ref": "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
        "dataset_qualification_ref": "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
        "s0_effectiveness_ref": EFFECT_REF,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
        "capability_complete": False,
        "next_authorized_slice_ids": [S1],
        "successor_authorized": False,
    })
    slices = line.setdefault("delivery_slices", [])
    s0 = next((item for item in slices if item.get("delivery_slice_id") == S0), None)
    if s0 is None:
        s0 = {"delivery_slice_id": S0, "primary_owner_work_package_id": "MCFT-12"}
        slices.append(s0)
    s0.update({
        "status": "MERGED_EFFECTIVE",
        "runtime_source_authorized": False,
        "merge_commit": BASE,
        "exact_head": EXACT_HEAD,
        "exact_head_ci_run": EXACT_CI,
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "effectiveness_condition_satisfied": True,
    })
    s1 = next((item for item in slices if item.get("delivery_slice_id") == S1), None)
    if s1 is None:
        s1 = {
            "delivery_slice_id": S1,
            "primary_owner_work_package_id": "MCFT-11",
            "contributing_owner_work_package_ids": ["MCFT-01", "MCFT-03"],
            "depends_on_delivery_slice_ids": [S0],
        }
        slices.append(s1)
    s1.update({"status": "AUTHORIZED_NOT_STARTED", "runtime_source_authorized": True, "implementation_started": False})
    save_json(path, matrix)


def update_text_ssot() -> None:
    print("[effectiveness] update task, authorization and implementation map")
    task_path = Path("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md")
    task = task_path.read_text(encoding="utf-8")
    marker = "\n# 0. 核心裁决"
    if marker not in task:
        raise RuntimeError("TASK_HEADER_BOUNDARY_REQUIRED")
    header, rest = task.split(marker, 1)
    header = replace_header_field(header, "implementation_status", "S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS", "S0_MERGED_EFFECTIVE_S1_AUTHORIZED_NOT_STARTED")
    header = replace_header_field(header, "authorization_effective", "false", "true")
    header = replace_header_field(header, "runtime_source_authorized", "false", "true")
    header = replace_header_field(header, "active_delivery_slice_id", "null", S1)
    header = replace_header_field(header, "first_permitted_repository_action", "MCFT-CAP-06.S0.MERGE-AND-MERGED-MAIN-AUTHORIZATION-GATE-V1", S1)
    old = "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1 与 P0 均已 merged-main effective；CAP-05 predecessor eligibility 已恢复。S0 v2 已从 reconciled main 完成 exact PostgreSQL predecessor reconstruction 与 structural dataset qualification，并形成候选，等待 merge、tree equivalence 与 merged-main Authorization Gate。CAP-06 Runtime source、migration、canonical write、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。"
    new = "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 均已 merged-main effective；repository-history qualification 为 INSUFFICIENT_MATCHED_PAIRS，且 graph、availability 与 homogeneity 均 PASS。当前仅 S1 Runtime source 实现获授权但尚未开始；S2 及后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。"
    if old not in header:
        raise RuntimeError("TASK_STATUS_PARAGRAPH_REQUIRED")
    header = header.replace(old, new, 1)
    task_path.write_text(header + marker + rest, encoding="utf-8")

    append_once(str(task_path), "<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->", f"""<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->
# 51. S0 merged-main effectiveness and S1 authorization

```text
S0 status: MERGED_EFFECTIVE
implementation PR: 2508
implementation exact head: {EXACT_HEAD}
exact-head CI: {EXACT_CI} SUCCESS
merge commit: {BASE}
head-to-merge file delta count: 0
head-to-merge tree equivalence: PASS
postmerge probe PR: {PROBE_PR} CLOSED_WITHOUT_MERGE
postmerge workflow: {PROBE_RUN} SUCCESS
merged-main Authorization Gate: PASS
dataset qualification: INSUFFICIENT_MATCHED_PAIRS
authorization_effective: true
runtime_source_authorized: true
active_delivery_slice_id: {S1}
S1 status: AUTHORIZED_NOT_STARTED
S2 and later: BLOCKED
```

S0 effectiveness authorizes only S1 implementation. It does not itself create Residuals, Candidate, Evaluation, Model Activation, an active-config binding, a public route, Web behavior, or MCFT-CAP-07 authority.
<!-- MCFT-CAP-06-S0-EFFECTIVENESS-END -->""")

    append_once("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md", "<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->", f"""<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->
## S0 merged-main effectiveness

```text
status: MERGED_EFFECTIVE
implementation_exact_head: {EXACT_HEAD}
exact_head_ci: {EXACT_CI} SUCCESS
merge_commit: {BASE}
head_to_merge_file_delta_count: 0
head_to_merge_tree_equivalence: PASS
postmerge_probe_pr: {PROBE_PR} CLOSED_WITHOUT_MERGE
postmerge_workflow: {PROBE_RUN} SUCCESS
authorization_effective: true
runtime_source_authorized: true
active_delivery_slice_id: {S1}
S1: AUTHORIZED_NOT_STARTED
S2_AND_LATER: BLOCKED
```

This effectiveness activation changes governance authority only. It does not append a Residual, Candidate, Evaluation, Model Activation, State, checkpoint, or active-config binding.
<!-- MCFT-CAP-06-S0-EFFECTIVENESS-END -->""")

    append_once("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->", f"""<!-- MCFT-CAP-06-S0-EFFECTIVENESS-BEGIN -->
## MCFT-CAP-06 S0 Effective and S1 Explicitly Authorized

```text
capability_line_id: MCFT-CAP-06
S0_status: MERGED_EFFECTIVE
S0_exact_head: {EXACT_HEAD}
S0_exact_head_CI: {EXACT_CI} SUCCESS
S0_merge_commit: {BASE}
S0_head_to_merge_file_delta_count: 0
S0_tree_equivalence: PASS
S0_postmerge_probe_PR: {PROBE_PR} CLOSED_WITHOUT_MERGE
S0_postmerge_workflow: {PROBE_RUN} SUCCESS
repository_history_qualification: INSUFFICIENT_MATCHED_PAIRS
S1_status: AUTHORIZED_NOT_STARTED
S1_runtime_source_authorized: true
S1_implementation_started: false
S2_status: BLOCKED
MCFT_CAP_07_authorized: false
```
<!-- MCFT-CAP-06-S0-EFFECTIVENESS-END -->""")


def update_gate() -> None:
    print("[effectiveness] update governance gate")
    gate = f'''// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs
// Purpose: fail closed on effective MCFT-CAP-06 S0 evidence and the exact S1-only authorization boundary.
// Boundary: governance validation only; no Runtime, persistence, route, scheduler, Residual, Candidate, Evaluation, or activation write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const S0 = '{S0}';
const S1 = '{S1}';
const EXACT_HEAD = '{EXACT_HEAD}';
const EXACT_CI = {EXACT_CI};
const MERGE = '{BASE}';
const PROBE_PR = {PROBE_PR};
const PROBE_RUN = {PROBE_RUN};

function readJson(relativePath) {{ return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }}
function readText(relativePath) {{ return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }}

function main() {{
  const postmerge = process.argv.includes('--postmerge');
  const authorization = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json');
  const effectiveness = readJson('{EFFECT_REF}');
  const lock = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json');
  const qualification = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_exact_head, EXACT_HEAD);
  assert.equal(effectiveness.implementation_exact_head_ci_run, EXACT_CI);
  assert.equal(effectiveness.implementation_merge_commit, MERGE);
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, PROBE_PR);
  assert.equal(effectiveness.postmerge_workflow_run, PROBE_RUN);
  assert.equal(effectiveness.postmerge_gate, 'PASS');

  assert.equal(authorization.delivery_slice_id, S0);
  assert.equal(authorization.status, 'MERGED_EFFECTIVE');
  assert.equal(authorization.authorization_effective, true);
  assert.equal(authorization.runtime_source_authorized, true);
  assert.equal(authorization.migration_authorized, false);
  assert.equal(authorization.canonical_write_authorized, false);
  assert.equal(authorization.active_delivery_slice_id, S1);
  assert.deepEqual(authorization.current_authorized_slice_ids, [S1]);

  assert.equal(lock.status, 'MERGED_EFFECTIVE');
  assert.equal(lock.lock_effective, true);
  assert.equal(lock.canonical_identity.checkpoint_sequence, 80);
  assert.equal(lock.canonical_identity.reproduced_state_fact_count, 33);
  assert.equal(qualification.status, 'MERGED_EFFECTIVE');
  assert.equal(qualification.qualification_effective, true);
  assert.equal(qualification.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(qualification.case_graph_validation_status, 'PASS');
  assert.equal(qualification.availability_order_validation_status, 'PASS');
  assert.equal(qualification.homogeneity_validation_status, 'PASS');

  assert.equal(delivery.s0_effective, true);
  assert.equal(delivery.authorization_effective, true);
  assert.equal(delivery.runtime_source_authorized, true);
  assert.equal(delivery.active_delivery_slice_id, S1);
  assert.deepEqual(delivery.authorized_not_started_slices, [S1]);
  assert.equal(delivery.blocked_slices.includes(S1), false);
  assert.equal(delivery.candidate_slices.length, 0);

  assert.equal(current.current_state.s0, 'MERGED_EFFECTIVE');
  assert.equal(current.current_state.capability_line_authorization_effective, true);
  assert.equal(current.current_state.runtime_source_authorized, true);
  assert.equal(current.current_state.active_delivery_slice_id, S1);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);
  assert.equal(current.current_state.capability_complete, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.authorization_effective, true);
  assert.equal(line.runtime_source_authorized, true);
  assert.equal(line.active_delivery_slice_id, S1);
  assert.deepEqual(line.next_authorized_slice_ids, [S1]);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);

  const task = readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const map = readText('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');
  assert.ok(task.includes('S0_MERGED_EFFECTIVE_S1_AUTHORIZED_NOT_STARTED'));
  assert.ok(task.includes('S0 merged-main effectiveness and S1 authorization'));
  assert.ok(map.includes('MCFT-CAP-06 S0 Effective and S1 Explicitly Authorized'));
  assert.equal(task.includes('S2_status: AUTHORIZED') || map.includes('S2_status: AUTHORIZED'), false);
  assert.equal(task.includes('MCFT_CAP_07_authorized: true') || map.includes('MCFT_CAP_07_authorized: true'), false);

  console.log('PASS MCFT-CAP-06 S0 merged-main effectiveness evidence');
  console.log('PASS repository history remains INSUFFICIENT_MATCHED_PAIRS with structural validation PASS');
  console.log('PASS S1 is the only authorized-not-started implementation slice');
  console.log('PASS Candidate/Evaluation/Activation/S2/CAP-07 remain unimplemented or blocked');
  console.log(postmerge ? 'PASS effective merged-main authorization boundary' : 'PASS effectiveness writeback candidate');
}}

main();
'''
    Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs").write_text(gate, encoding="utf-8")


def update_exact_runner() -> None:
    print("[effectiveness] update exact qualification state assertions")
    path = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts")
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'  assert\.equal\(currentState\.current_state\?\.s0, "AUTHORIZED_NOT_STARTED", "S0_AUTHORIZED_NOT_STARTED_REQUIRED"\);\n'
        r'  assert\.equal\(currentState\.current_state\?\.runtime_source_authorized, false, "CAP06_RUNTIME_SOURCE_MUST_REMAIN_UNAUTHORIZED"\);\n'
        r'  assert\.equal\(delivery\.s0_qualification_authorized, true, "S0_QUALIFICATION_AUTHORIZATION_REQUIRED"\);\n'
        r'  assert\.equal\(delivery\.runtime_source_authorized, false, "CAP06_RUNTIME_SOURCE_MUST_REMAIN_UNAUTHORIZED"\);'
    )
    replacement = f'''  assert.equal(currentState.current_state?.s0, "MERGED_EFFECTIVE", "S0_MERGED_EFFECTIVE_REQUIRED");
  assert.equal(currentState.current_state?.capability_line_authorization_effective, true, "CAP06_AUTHORIZATION_EFFECTIVE_REQUIRED");
  assert.equal(currentState.current_state?.runtime_source_authorized, true, "CAP06_RUNTIME_SOURCE_AUTHORIZATION_REQUIRED");
  assert.equal(currentState.current_state?.active_delivery_slice_id, "{S1}", "S1_ACTIVE_DELIVERY_SLICE_REQUIRED");
  assert.equal(delivery.s0_qualification_authorized, true, "S0_QUALIFICATION_AUTHORIZATION_REQUIRED");
  assert.equal(delivery.s0_effective, true, "S0_EFFECTIVENESS_REQUIRED");
  assert.equal(delivery.runtime_source_authorized, true, "CAP06_RUNTIME_SOURCE_AUTHORIZATION_REQUIRED");
  assert.equal(delivery.active_delivery_slice_id, "{S1}", "S1_ACTIVE_DELIVERY_SLICE_REQUIRED");'''
    source, count = pattern.subn(replacement, source, count=1)
    if count != 1:
        raise RuntimeError(f"S0_EFFECTIVE_RUNNER_ASSERTIONS_MATCH:{count}")
    path.write_text(source, encoding="utf-8")


def remove_temporary_assets() -> None:
    print("[effectiveness] remove temporary assets")
    for path in [
        ".github/workflows/mcft-cap-06-s0-effectiveness-finalize.yml",
        ".github/workflows/mcft-cap-06-s0-effectiveness-finalize-v2.yml",
        "scripts/remediation/FINALIZE_MCFT_CAP_06_S0_EFFECTIVENESS_V1.py",
    ]:
        Path(path).unlink(missing_ok=True)


def main() -> None:
    write_effectiveness_record()
    update_authorities()
    update_delivery_and_current_state()
    update_matrix()
    update_text_ssot()
    update_gate()
    update_exact_runner()
    remove_temporary_assets()
    print("[effectiveness] materialization complete")


if __name__ == "__main__":
    main()
