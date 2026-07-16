# scripts/remediation/FINALIZE_MCFT_CAP_06_S1_EFFECTIVENESS.py
# Purpose: materialize the bounded S1 merged-main effectiveness writeback and S2-only authorization.
# Boundary: one-time branch finalization only; no Runtime object write, calibration math, Candidate, Evaluation, activation, route, Web, scheduler, or CAP-07 authority.

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1"
S2 = "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1"
S3 = "MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1"
EXACT_HEAD = "57d9844528665a5ae3ecbd0ccf0406bf3c5e91cd"
EXACT_CI = 29475482824
MERGE = "6db3f8d0c2b2ba7bcc48993b4b4783332e2ae62b"
PROBE_PR = 2515
PROBE_RUN = 29476027885

MAP_PATH = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
MATRIX_PATH = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
CURRENT_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
DELIVERY_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json"
STATUS_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json"
EFFECTIVENESS_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json"
TASK_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md"
GATE_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs"

EXPECTED_FILES = [
    MAP_PATH,
    MATRIX_PATH,
    CURRENT_PATH,
    DELIVERY_PATH,
    STATUS_PATH,
    EFFECTIVENESS_PATH,
    TASK_PATH,
    GATE_PATH,
]


def read_json(relative_path: str) -> dict:
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def write_json(relative_path: str, value: dict) -> None:
    (ROOT / relative_path).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}_EXPECTED_ONCE_ACTUAL_{count}")
    return source.replace(old, new, 1)


def materialize_status() -> None:
    status = read_json(STATUS_PATH)
    status["status"] = "MERGED_EFFECTIVE"
    status["implementation_exact_head"] = EXACT_HEAD
    status["implementation_exact_head_ci_run"] = EXACT_CI
    status["implementation_merge_commit"] = MERGE
    status["head_to_merge_file_delta_count"] = 0
    status["head_to_merge_tree_equivalence"] = "PASS"
    status["postmerge_probe_pr_number"] = PROBE_PR
    status["postmerge_probe_closed_without_merge"] = True
    status["postmerge_workflow_run"] = PROBE_RUN
    status["postmerge_gate"] = "PASS"
    status["s1_effective"] = True
    status["s2_authorized"] = True
    status["effectiveness"] = {
        "effective": True,
        "condition": "S1_EXACT_HEAD_CI_PASS_AND_S1_MERGED_AND_HEAD_TO_MERGE_TREE_EQUIVALENT_AND_MERGED_MAIN_S1_GATE_PASS",
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "merge_commit": MERGE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_probe_closed_without_merge": True,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
    }
    status["effectiveness_writeback_changed_file_boundary"] = EXPECTED_FILES
    status["preserved_nonclaims"] = [
        "S2_AUTHORIZED_NOT_STARTED_CONTRACTS_MATH_ONLY",
        "NO_S2_IMPLEMENTATION",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    write_json(STATUS_PATH, status)


def materialize_effectiveness() -> None:
    effectiveness = {
        "schema_version": "geox_mcft_cap_06_s1_effectiveness_v1",
        "effectiveness_id": "MCFT-CAP-06.S1.MERGED-MAIN-EFFECTIVENESS-ACTIVATION-V1",
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S1,
        "status": "MERGED_EFFECTIVE",
        "effective": True,
        "implementation_pr_number": 2514,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "implementation_merge_commit": MERGE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_probe_closed_without_merge": True,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "canonical_residual_count": 24,
        "residual_set_hash": "sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7",
        "calibration_window_hash": "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d",
        "holdout_window_hash": "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a",
        "case_input_set_hash": "sha256:fac894cf5a4de2c473523190408933ae25185c6a63b9568cde2d8121add4dc62",
        "runtime_source_authorized": True,
        "canonical_write_effective_for_s1": True,
        "canonical_write_scope": ["twin_forecast_residual_v1"],
        "migration_delta": 0,
        "active_delivery_slice_id": S2,
        "authorized_not_started_slice_ids": [S2],
        "s2_authorized": True,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
        "model_activation_authorized": False,
        "active_config_switch_authorized": False,
        "successor_capability_line_authorized": False,
        "effectiveness_writeback_changed_file_boundary": EXPECTED_FILES,
        "preserved_nonclaims": [
            "NO_S2_IMPLEMENTATION",
            "NO_CALIBRATION_CANDIDATE",
            "NO_SHADOW_EVALUATION",
            "NO_MODEL_ACTIVATION",
            "NO_ACTIVE_CONFIG_SWITCH",
            "NO_STATE_OR_CHECKPOINT_MUTATION_BY_EFFECTIVENESS_WRITEBACK",
            "NO_PUBLIC_ROUTE_OR_WEB_OR_SCHEDULER",
            "NO_MCFT_CAP_07_AUTHORIZATION",
        ],
    }
    write_json(EFFECTIVENESS_PATH, effectiveness)


def materialize_delivery() -> None:
    delivery = read_json(DELIVERY_PATH)
    delivery["status"] = "IMPLEMENTATION_IN_PROGRESS"
    delivery["implementation_status"] = "S1_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED"
    delivery["active_delivery_slice_id"] = S2
    completed = [item for item in delivery.get("completed_or_effective_slices", []) if item.get("delivery_slice_id") != S1]
    completed.append({
        "delivery_slice_id": S1,
        "status": "MERGED_EFFECTIVE",
        "implementation_pr_number": 2514,
        "exact_head": EXACT_HEAD,
        "exact_head_ci_run": EXACT_CI,
        "merge_commit": MERGE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "canonical_residual_count": 24,
        "residual_set_hash": "sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7",
        "calibration_window_hash": "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d",
        "holdout_window_hash": "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a",
    })
    delivery["completed_or_effective_slices"] = completed
    delivery["candidate_slices"] = []
    delivery["blocked_slices"] = [item for item in delivery.get("blocked_slices", []) if item != S2]
    delivery["authorized_not_started_slices"] = [S2]
    delivery["next_repository_action"] = S2
    delivery["s1_candidate_materialized"] = True
    delivery["s1_effective"] = True
    delivery["s1_effectiveness_ref"] = EFFECTIVENESS_PATH
    delivery["s2_authorized"] = True
    delivery["s2_implementation_started"] = False
    write_json(DELIVERY_PATH, delivery)


def materialize_current() -> None:
    current = read_json(CURRENT_PATH)
    state = current["current_state"]
    state["active_delivery_slice_id"] = S2
    state["s1"] = "MERGED_EFFECTIVE"
    state["controlled_residual_window_candidate_implemented"] = True
    state["controlled_residual_window_effective"] = True
    state["s2"] = "AUTHORIZED_NOT_STARTED"
    state["calibration_contract_math_implemented"] = False
    state["candidate_runtime_implemented"] = False
    state["shadow_evaluation_runtime_implemented"] = False
    current.setdefault("proof", {})["s1"] = {
        "implementation_pr_number": 2514,
        "exact_head": EXACT_HEAD,
        "exact_head_ci_run": EXACT_CI,
        "merge_commit": MERGE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "effectiveness_ref": EFFECTIVENESS_PATH,
    }
    current["next_repository_action"] = S2
    current["preserved_nonclaims"] = [
        "NO_S2_IMPLEMENTATION",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    current["s1_effectiveness_ref"] = EFFECTIVENESS_PATH
    current["effectiveness_condition"] = "S1_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED"
    write_json(CURRENT_PATH, current)


def materialize_matrix() -> None:
    matrix = read_json(MATRIX_PATH)
    matrix["baseline"] = {
        "branch": "main",
        "commit": MERGE,
        "meaning": "MCFT-CAP-06 S1 merged-main effective; S2 contracts and fixed-point math authorized not started; later slices and MCFT-CAP-07 remain blocked",
    }
    lines = matrix.get("capability_lines", matrix.get("capabilities"))
    line = next(item for item in lines if item.get("capability_line_id") == "MCFT-CAP-06")
    line["status"] = "IMPLEMENTATION_IN_PROGRESS"
    line["implementation_status"] = "S1_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED"
    line["authorization_effective"] = True
    line["runtime_source_authorized"] = True
    line["active_delivery_slice_id"] = S2
    line["next_repository_action"] = S2
    line["authorization_status"] = "MERGED_EFFECTIVE"
    line["next_delivery_slice_id"] = S2
    line["next_delivery_slice_authorized"] = True
    line["controlled_residual_window_candidate_implemented"] = True
    line["controlled_residual_window_effective"] = True
    line["candidate_runtime_implemented"] = False
    line["shadow_evaluation_runtime_implemented"] = False
    line["capability_complete"] = False
    line["s1_effectiveness_ref"] = EFFECTIVENESS_PATH
    line["next_authorized_slice_ids"] = [S2]
    line["preserved_nonclaims"] = [
        "NO_S2_IMPLEMENTATION",
        "NO_MIGRATION",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_PUBLIC_ROUTE_OR_WEB_OR_SCHEDULER",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    if isinstance(line.get("s0"), dict):
        line["s0"]["status"] = "MERGED_EFFECTIVE"
        line["s0"]["runtime_source_authorized"] = False
        line["s0"]["effectiveness_condition_satisfied"] = True
    slices = line.setdefault("delivery_slices", [])
    s1 = next(item for item in slices if item.get("delivery_slice_id") == S1)
    s1.update({
        "status": "MERGED_EFFECTIVE",
        "runtime_source_authorized": True,
        "implementation_started": True,
        "implementation_exact_head": EXACT_HEAD,
        "implementation_exact_head_ci_run": EXACT_CI,
        "implementation_merge_commit": MERGE,
        "head_to_merge_file_delta_count": 0,
        "head_to_merge_tree_equivalence": "PASS",
        "postmerge_probe_pr_number": PROBE_PR,
        "postmerge_workflow_run": PROBE_RUN,
        "postmerge_gate": "PASS",
        "effectiveness_condition_satisfied": True,
    })
    if not any(item.get("delivery_slice_id") == S2 for item in slices):
        slices.append({
            "delivery_slice_id": S2,
            "primary_owner_work_package_id": "MCFT-12",
            "contributing_owner_work_package_ids": ["MCFT-02", "MCFT-06", "MCFT-07", "MCFT-09", "MCFT-11"],
            "depends_on_delivery_slice_ids": [S1],
            "status": "AUTHORIZED_NOT_STARTED",
            "runtime_source_authorized": True,
            "migration_authorized": False,
            "canonical_write_authorized": False,
            "implementation_started": False,
            "next_authorized_slice_after_effectiveness": S3,
        })
    matrix["latest_governance_update"] = "MCFT-CAP-06.S1.MERGED-MAIN-EFFECTIVENESS-ACTIVATION-V1"
    write_json(MATRIX_PATH, matrix)


def materialize_task() -> None:
    path = ROOT / TASK_PATH
    source = path.read_text(encoding="utf-8")
    source = replace_once(source, "implementation_status:\nS1_IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS", "implementation_status:\nS1_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED", "TASK_IMPLEMENTATION_STATUS")
    source = replace_once(source, "runtime_implementation_status:\nNOT_STARTED", "runtime_implementation_status:\nS1_CANONICAL_RESIDUAL_WINDOWS_MERGED_EFFECTIVE", "TASK_RUNTIME_STATUS")
    source = replace_once(source, f"active_delivery_slice_id:\n{S1}", f"active_delivery_slice_id:\n{S2}", "TASK_ACTIVE_SLICE")
    source = replace_once(source, f"first_permitted_repository_action:\n{S1}", f"first_permitted_repository_action:\n{S2}", "TASK_FIRST_ACTION")
    source = replace_once(
        source,
        "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 均已 merged-main effective；S1 已形成受控 24-case canonical Residual-window implementation candidate，等待 exact-head CI、merge、tree equivalence 与 merged-main S1 Gate。S2 及后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。",
        "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0、S0 与 S1 均已 merged-main effective；S1 已建立受控 24-case canonical Residual history、16-case calibration window 与 later 8-case holdout window。当前仅 S2 contracts、fixed-point math 与 policy implementation 获授权但尚未开始；S3 及后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。",
        "TASK_CURRENT_PARAGRAPH",
    )
    marker = "<!-- MCFT-CAP-06-S1-EFFECTIVENESS-BEGIN -->"
    if marker not in source:
        source = source.rstrip() + f"""

{marker}
# 52. S1 merged-main effectiveness and S2 authorization

```text
S1 status: MERGED_EFFECTIVE
implementation PR: 2514
implementation exact head: {EXACT_HEAD}
exact-head CI: {EXACT_CI} SUCCESS
merge commit: {MERGE}
head-to-merge file delta count: 0
head-to-merge tree equivalence: PASS
postmerge probe PR: {PROBE_PR} CLOSED_WITHOUT_MERGE
postmerge workflow: {PROBE_RUN} SUCCESS
merged-main S1 Gate: PASS
canonical Residual count: 24
calibration window count: 16
holdout window count: 8
active_delivery_slice_id: {S2}
S2 status: AUTHORIZED_NOT_STARTED
S3 and later: BLOCKED
```

S1 effectiveness authorizes only S2 contract, fixed-point math and policy implementation. It does not implement the calibration engine, append Candidate or Evaluation objects, create Model Activation, switch active Config, mutate State/checkpoint, expose a public route/Web path/scheduler, or authorize MCFT-CAP-07.
<!-- MCFT-CAP-06-S1-EFFECTIVENESS-END -->
"""
    path.write_text(source, encoding="utf-8")


def materialize_map() -> None:
    path = ROOT / MAP_PATH
    source = path.read_text(encoding="utf-8")
    marker = "<!-- MCFT-CAP-06-S1-EFFECTIVENESS-BEGIN -->"
    if marker not in source:
        source = source.rstrip() + f"""

{marker}
## MCFT-CAP-06 S1 Effective and S2 Explicitly Authorized

```text
capability_line_id: MCFT-CAP-06
S1_status: MERGED_EFFECTIVE
S1_exact_head: {EXACT_HEAD}
S1_exact_head_CI: {EXACT_CI} SUCCESS
S1_merge_commit: {MERGE}
S1_head_to_merge_file_delta_count: 0
S1_tree_equivalence: PASS
S1_postmerge_probe_PR: {PROBE_PR} CLOSED_WITHOUT_MERGE
S1_postmerge_workflow: {PROBE_RUN} SUCCESS
canonical_residual_count: 24
calibration_window_count: 16
holdout_window_count: 8
S2_status: AUTHORIZED_NOT_STARTED
S2_runtime_source_authorized: true
S2_migration_authorized: false
S2_canonical_write_authorized: false
S3_status: BLOCKED
Candidate_runtime_implemented: false
Shadow_Evaluation_runtime_implemented: false
Model_Activation_authorized: false
MCFT_CAP_07_authorized: false
```
<!-- MCFT-CAP-06-S1-EFFECTIVENESS-END -->
"""
    path.write_text(source, encoding="utf-8")


def materialize_gate() -> None:
    path = ROOT / GATE_PATH
    source = path.read_text(encoding="utf-8")
    source = replace_once(
        source,
        "// Purpose: fail closed on the exact MCFT-CAP-06 S1 controlled Residual-window candidate and preserved S2 boundary.",
        "// Purpose: fail closed on immutable MCFT-CAP-06 S1 Residual-window evidence, merged-main effectiveness and S2-only authorization.",
        "GATE_PURPOSE",
    )
    source = replace_once(
        source,
        "const EXPECTED_FILES = [",
        "const EXPECTED_EFFECTIVENESS_FILES = " + json.dumps(EXPECTED_FILES) + ";\nconst EXPECTED_FILES = [",
        "GATE_EFFECTIVENESS_FILES",
    )
    source = replace_once(
        source,
        "  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');",
        "  const effectiveness = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json');\n  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');",
        "GATE_EFFECTIVENESS_LOAD",
    )
    old_status = """  assert.equal(status.status, 'IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(status.runtime_source_authorized, true);
  assert.equal(status.canonical_write_authorized_for_slice, true);
  assert.deepEqual(status.canonical_write_scope, ['twin_forecast_residual_v1']);
  assert.equal(status.candidate_tree_validation.exact_changed_file_count, EXPECTED_FILES.length);
  assert.equal(status.s1_effective, false);
  assert.equal(status.s2_authorized, false);
  assert.deepEqual([...status.exact_changed_file_boundary].sort(), [...EXPECTED_FILES].sort());
"""
    new_status = f"""  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.runtime_source_authorized, true);
  assert.equal(status.canonical_write_authorized_for_slice, true);
  assert.deepEqual(status.canonical_write_scope, ['twin_forecast_residual_v1']);
  assert.equal(status.candidate_tree_validation.exact_changed_file_count, EXPECTED_FILES.length);
  assert.equal(status.s1_effective, true);
  assert.equal(status.s2_authorized, true);
  assert.equal(status.effectiveness.implementation_exact_head, '{EXACT_HEAD}');
  assert.equal(status.effectiveness.implementation_exact_head_ci_run, {EXACT_CI});
  assert.equal(status.effectiveness.merge_commit, '{MERGE}');
  assert.equal(status.effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(status.effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(status.effectiveness.postmerge_probe_pr_number, {PROBE_PR});
  assert.equal(status.effectiveness.postmerge_workflow_run, {PROBE_RUN});
  assert.equal(status.effectiveness.postmerge_gate, 'PASS');
  assert.deepEqual([...status.exact_changed_file_boundary].sort(), [...EXPECTED_FILES].sort());
  assert.deepEqual([...status.effectiveness_writeback_changed_file_boundary].sort(), [...EXPECTED_EFFECTIVENESS_FILES].sort());

  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_exact_head, '{EXACT_HEAD}');
  assert.equal(effectiveness.implementation_exact_head_ci_run, {EXACT_CI});
  assert.equal(effectiveness.implementation_merge_commit, '{MERGE}');
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, {PROBE_PR});
  assert.equal(effectiveness.postmerge_workflow_run, {PROBE_RUN});
  assert.equal(effectiveness.postmerge_gate, 'PASS');
  assert.equal(effectiveness.active_delivery_slice_id, S2);
  assert.deepEqual(effectiveness.authorized_not_started_slice_ids, [S2]);
  assert.deepEqual([...effectiveness.effectiveness_writeback_changed_file_boundary].sort(), [...EXPECTED_EFFECTIVENESS_FILES].sort());
"""
    source = replace_once(source, old_status, new_status, "GATE_STATUS_BLOCK")
    old_state = """  assert.equal(delivery.active_delivery_slice_id, S1);
  assert.equal(delivery.s1_candidate_materialized, true);
  assert.equal(delivery.s1_effective, false);
  assert.equal(delivery.candidate_slices.length, 1);
  assert.equal(delivery.candidate_slices[0].delivery_slice_id, S1);
  assert.equal(delivery.blocked_slices.includes(S2), true);

  assert.equal(current.current_state.s1, 'IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(current.current_state.controlled_residual_window_candidate_implemented, true);
  assert.equal(current.current_state.controlled_residual_window_effective, false);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S1);
  assert.equal(line.controlled_residual_window_candidate_implemented, true);
  assert.equal(line.controlled_residual_window_effective, false);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);
"""
    new_state = f"""  assert.equal(delivery.active_delivery_slice_id, S2);
  assert.equal(delivery.s1_candidate_materialized, true);
  assert.equal(delivery.s1_effective, true);
  assert.equal(delivery.candidate_slices.length, 0);
  assert.deepEqual(delivery.authorized_not_started_slices, [S2]);
  assert.equal(delivery.blocked_slices.includes(S2), false);
  assert.equal(delivery.blocked_slices.includes('{S3}'), true);
  const completedS1 = delivery.completed_or_effective_slices.find((item) => item.delivery_slice_id === S1);
  assert.ok(completedS1);
  assert.equal(completedS1.status, 'MERGED_EFFECTIVE');
  assert.equal(completedS1.exact_head, '{EXACT_HEAD}');
  assert.equal(completedS1.exact_head_ci_run, {EXACT_CI});
  assert.equal(completedS1.merge_commit, '{MERGE}');
  assert.equal(completedS1.postmerge_workflow_run, {PROBE_RUN});

  assert.equal(current.current_state.s1, 'MERGED_EFFECTIVE');
  assert.equal(current.current_state.s2, 'AUTHORIZED_NOT_STARTED');
  assert.equal(current.current_state.active_delivery_slice_id, S2);
  assert.equal(current.current_state.controlled_residual_window_candidate_implemented, true);
  assert.equal(current.current_state.controlled_residual_window_effective, true);
  assert.equal(current.current_state.calibration_contract_math_implemented, false);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S2);
  assert.deepEqual(line.next_authorized_slice_ids, [S2]);
  assert.equal(line.controlled_residual_window_candidate_implemented, true);
  assert.equal(line.controlled_residual_window_effective, true);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'MERGED_EFFECTIVE');
  assert.equal(matrixS1.effectiveness_condition_satisfied, true);
  assert.equal(matrixS2.status, 'AUTHORIZED_NOT_STARTED');
  assert.equal(matrixS2.implementation_started, false);
  assert.equal(matrixS2.migration_authorized, false);
  assert.equal(matrixS2.canonical_write_authorized, false);
"""
    source = replace_once(source, old_state, new_state, "GATE_STATE_BLOCK")
    old_console = """  console.log('PASS MCFT-CAP-06 S1 exact 24 Residual refs and hashes');
  console.log('PASS disjoint 16/8 dual-time windows and zero future leakage');
  console.log('PASS existing C transaction reuse, zero migration and isolated PostgreSQL harness');
  console.log('PASS monotonic S0 evidence Gate remains compatible with the active S1 candidate');
  console.log('PASS S2/Candidate/Evaluation/Activation/CAP-07 remain blocked');
"""
    new_console = """  console.log('PASS MCFT-CAP-06 immutable S1 exact 24 Residual refs and hashes');
  console.log('PASS disjoint 16/8 dual-time windows and zero future leakage');
  console.log('PASS S1 exact-head, merge, tree equivalence and merged-main Gate evidence');
  console.log('PASS S2 is the sole authorized-not-started successor slice');
  console.log('PASS Candidate/Evaluation/Activation/S3/CAP-07 remain unimplemented or blocked');
"""
    source = replace_once(source, old_console, new_console, "GATE_CONSOLE_BLOCK")
    path.write_text(source, encoding="utf-8")


def main() -> None:
    materialize_status()
    materialize_effectiveness()
    materialize_delivery()
    materialize_current()
    materialize_matrix()
    materialize_task()
    materialize_map()
    materialize_gate()
    print(json.dumps({
        "status": "MATERIALIZED",
        "delivery_slice_id": S1,
        "active_delivery_slice_id": S2,
        "exact_permanent_changed_file_boundary": EXPECTED_FILES,
    }, indent=2))


if __name__ == "__main__":
    main()
