# scripts/remediation/FINALIZE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_V1.py
# Purpose: materialize the proven MCFT-CAP-06 S1 controlled Residual-window candidate and its exact governance boundary.
# Boundary: one-time candidate finalizer; it removes itself and the temporary workflow before commit and grants no S2 authority.

from __future__ import annotations

import json
import re
from pathlib import Path

BASELINE_MAIN = "b709bfed36ef1efa6d970b349d23a2b0006e4de2"
S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1"
S2 = "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1"
PROFILE = "PRESEEDED_24_H1_FORECAST_OBSERVATION_PAIRS_NO_RESIDUALS_V1"
EXECUTION_HEAD = "91edc0e7c0d88b5bec1c60aa0d4b249c3cd81cfe"
EXECUTION_WORKFLOW = 29473868540
PR_NUMBER = 2514
ORDERED_REFS = [
    "twin_forecast_residual_82a3a33ec85e745b3da94926",
    "twin_forecast_residual_3f304b582b7ccd88ff595e58",
    "twin_forecast_residual_b1927fa85ec7907003536743",
    "twin_forecast_residual_70cb140deddbd82431b930a8",
    "twin_forecast_residual_5f1002f427dfc7a3898004c6",
    "twin_forecast_residual_2e70b5e205e97d59ac5463ea",
    "twin_forecast_residual_3dff46adeb68ddd13eb6cc23",
    "twin_forecast_residual_5460ebde9cb3b3874330fbb0",
    "twin_forecast_residual_b88ec039ea40554565fe48c6",
    "twin_forecast_residual_eb356def2ef9987d04928088",
    "twin_forecast_residual_a2cb5086fadd37dc50e223d0",
    "twin_forecast_residual_911de330aea53e3fee88e0d3",
    "twin_forecast_residual_9e4081b160e65b9bebd10c33",
    "twin_forecast_residual_c6cb6464fb3a19634e5593d6",
    "twin_forecast_residual_1561f21073c4a305e939e156",
    "twin_forecast_residual_cb4c4702aaa1bff2027dc7eb",
    "twin_forecast_residual_5e56e928f343f3311534101f",
    "twin_forecast_residual_cc73ee4d8445074800a80e5f",
    "twin_forecast_residual_8460f596160f7a25c002d137",
    "twin_forecast_residual_c08214c843f869a28aa89751",
    "twin_forecast_residual_0a5d78b827e5a53addbf030b",
    "twin_forecast_residual_40dcac4516a48226c9fa2651",
    "twin_forecast_residual_2a34b15f913f3ad58ee3fb37",
    "twin_forecast_residual_09e61f26baff44fd6679824b",
]
ORDERED_HASHES = [
    "sha256:bf52e954d113d5f0cb8ddb8fd9d5f980fc78024c9484afd24f1b228411d74698",
    "sha256:51ed607ae2ee80f610eb915d2b2f164585a841afe0db4ab1a4e658dd6b2ee6c7",
    "sha256:c9acfce97e1e77bc8648fcc5a68aa9b51514b7b15d415b805cef21239c92d00f",
    "sha256:e4004da4ffde893cc0f041403c53146352032a4dc9cef2b8b5cc73d439b81afb",
    "sha256:b3cdf2e81beac508f4b509677907d4ce5df3a9d970c6425624400d57358e4b78",
    "sha256:af4015fc36872e83b2e5808c81cd884151d5dcf3b914d67fbf0763317ec1e61a",
    "sha256:6c0c848a55dd79fc4b43f29f165cbf771d33ef5e2a856e2498566eda38116166",
    "sha256:31c47dcb9c787587fec0dd1dadacee85671343fc710f62e630a256fb7fc816eb",
    "sha256:0e169a584acfd69bb2ff13ec1404d3962c0a388ce2cbfc70387bf87661f288d2",
    "sha256:3b80a497cbe40be1d7f0d520dbd3f687c1264dd26d588fc84a9198d3574c8e1e",
    "sha256:5a9599a5790495bdb831b78392f91d9c1246f31e1beb9e8d9b877cb6b2863f68",
    "sha256:a29f58a418cdab658e22985bf2776213f2e7893888aa78d4e2a53c648280d171",
    "sha256:8ed287354d52f9da04ad2accc0df9403145937715007cba6e920d38f3096a3a9",
    "sha256:0cff7fbbe847cece24bbc571db47bc5a0731772d1a3ee2594a84d18e5b20f138",
    "sha256:c6da6632179dae8fad37bef4d13b2d2517d54e4b0128d3edd70b50d57030a672",
    "sha256:c25ec6614f1e0aa3074c20b450c5ba5e45b8af874ceece0075f0241f9daf5ad0",
    "sha256:47ce9094dc8bc29b87beacc42ac8339cec29495fccd5c2a3926a66b477f6289e",
    "sha256:4a24ef4a16589f3cf6a7ace8276584951ebcd0ab687518ec3bb736f5a3b57762",
    "sha256:113aa825e7a611cbb646a090a1493aa85f53ab2af6fef0f43d8593ca437a8504",
    "sha256:9cfc521bea9dc1448e2cfb87732caeb44c15a93bf5b0a3140ae0a26184d0acd1",
    "sha256:0f4ff85fabd6fdcd95a3a77d65e08ef96339167c0f9d08c1a0f171045f7498c6",
    "sha256:a7d7d654e8b03b2eda9d380f373f5d88a118edc75405a13e2f5807e2b4e126aa",
    "sha256:61cc2a09cfbf4f261714687c0042b7b181c6e9e0dd99e75f6f7e3d75ca2ef5a7",
    "sha256:8b1feaae71a654168ae50022c03501c60010425b5b59411b4eff9d25988505db",
]
RESIDUAL_SET_HASH = "sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7"
CALIBRATION_HASH = "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d"
HOLDOUT_HASH = "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a"
CASE_INPUT_HASH = "sha256:fac894cf5a4de2c473523190408933ae25185c6a63b9568cde2d8121add4dc62"
MODEL_HASH = "sha256:3daa9adb75b975d5e956579a4f18afb6dab3aafb5418d85a37dd09cf1c0afe29"
BUNDLE_HASH = "sha256:a3b3bbe9dbf78f246ff1dd187868a2427f6f977ede04dce0fbcfbfda427c7772"
OPERATOR_HASH = "sha256:123a292449ac04e52c83c9232f734e914d95b9f2298fd3e8fefd657c67dfc11e"
GEOMETRY_HASH = "sha256:7777777777777777777777777777777777777777777777777777777777777777"
NUMERIC_HASH = "sha256:b73f9a895211593f4b95851a2e9e407ed87ede2580b9ae5ed916affc15d02bf6"
CONTRACT_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json"
STATUS_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json"
RECORD_PATH = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.md"
GATE_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs"
CHANGED_FILES = [
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    CONTRACT_PATH,
    STATUS_PATH,
    RECORD_PATH,
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "scripts/acceptance/run_acceptance.cjs",
    GATE_PATH,
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs",
    "scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts",
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
        raise RuntimeError(f"S1_TASK_HEADER_MATCH:{key}:{count}")
    return result


def write_contracts() -> None:
    contract = {
        "schema_version": "geox_mcft_cap_06_s1_residual_windows_v1",
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S1,
        "status": "IMPLEMENTATION_CANDIDATE",
        "baseline_main_commit": BASELINE_MAIN,
        "implementation_pr_number": PR_NUMBER,
        "candidate_execution_head": EXECUTION_HEAD,
        "candidate_execution_workflow": EXECUTION_WORKFLOW,
        "profile_id": PROFILE,
        "qualification_track": "CONTROLLED_POSITIVE_MECHANISM_TRACK",
        "repository_history_track": "REPOSITORY_HISTORY_QUALIFICATION_TRACK",
        "base_drainage_coefficient": "0.030000",
        "hidden_drainage_coefficient": "0.034000",
        "source_profile_prestate": {
            "posterior_state_count": 24,
            "runtime_config_count": 24,
            "completed_h1_forecast_count": 24,
            "exact_h1_forecast_point_count": 24,
            "matching_observation_evidence_count": 24,
            "matching_residual_count_before_s1": 0,
        },
        "canonical_residual_count": 24,
        "ordered_residual_refs": ORDERED_REFS,
        "ordered_residual_hashes": ORDERED_HASHES,
        "residual_set_hash": RESIDUAL_SET_HASH,
        "calibration_window": {
            "case_count": 16,
            "ordered_residual_refs": ORDERED_REFS[:16],
            "window_hash": CALIBRATION_HASH,
        },
        "holdout_window": {
            "case_count": 8,
            "ordered_residual_refs": ORDERED_REFS[16:],
            "window_hash": HOLDOUT_HASH,
        },
        "case_input_set_hash": CASE_INPUT_HASH,
        "context_hashes": {
            "model_component_hash": MODEL_HASH,
            "effective_parameter_bundle_hash": BUNDLE_HASH,
            "observation_operator_hash": OPERATOR_HASH,
            "geometry_hash": GEOMETRY_HASH,
            "runtime_replay_numeric_policy_hash": NUMERIC_HASH,
        },
        "validation": {
            "case_graph_validation_status": "PASS",
            "availability_order_validation_status": "PASS",
            "homogeneity_validation_status": "PASS",
            "future_leakage_count": 0,
            "calibration_holdout_ref_intersection_count": 0,
            "controlled_repository_history_ref_intersection_count": 0,
            "idempotent_replay": "PASS_ZERO_ADDITIONAL_WRITES",
            "response_loss_retry": "PASS_EXISTING_IDEMPOTENT_SUCCESS",
            "canonical_readback": "24_PASS_0_FAIL",
            "forged_forecast_hash_rejection": "PASS",
            "forged_forecast_point_hash_rejection": "PASS",
            "forged_observation_hash_rejection": "PASS",
            "duplicate_target_rejection": "PASS",
            "semantic_duplicate_rejection": "PASS",
            "conflicting_same_identity_rejection": "PASS",
            "facts_only_projection_rebuild": "PASS_24",
        },
        "canonical_deltas": {
            "twin_forecast_residual_v1": 24,
            "twin_calibration_candidate_v1": 0,
            "twin_shadow_evaluation_v1": 0,
            "twin_model_activation_v1": 0,
        },
        "transaction_authority": "REUSE_EXISTING_C_FORECAST_RESIDUAL_COMMIT",
        "migration_delta": 0,
        "limitations": [
            "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
            "NOT_REPOSITORY_HISTORY",
            "NOT_FIELD_CALIBRATION",
            "NO_CALIBRATION_SEARCH_EXECUTED_BY_S1",
            "NO_CANDIDATE_OR_EVALUATION_CANONICALIZED",
            "NO_MODEL_ACTIVATION",
        ],
    }
    save_json(CONTRACT_PATH, contract)
    status = {
        "schema_version": "geox_mcft_cap_06_s1_residual_windows_status_v1",
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S1,
        "status": "IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "baseline_main_commit": BASELINE_MAIN,
        "implementation_pr_number": PR_NUMBER,
        "candidate_execution_head": EXECUTION_HEAD,
        "candidate_execution_workflow": EXECUTION_WORKFLOW,
        "candidate_execution_result": "9_PASS_0_FAIL",
        "runtime_source_authorized": True,
        "migration_authorized": False,
        "canonical_write_authorized_for_slice": True,
        "canonical_write_scope": ["twin_forecast_residual_v1"],
        "canonical_residual_count": 24,
        "residual_set_hash": RESIDUAL_SET_HASH,
        "calibration_window_hash": CALIBRATION_HASH,
        "holdout_window_hash": HOLDOUT_HASH,
        "case_input_set_hash": CASE_INPUT_HASH,
        "s1_effective": False,
        "s2_authorized": False,
        "next_authorized_slice_after_effectiveness": S2,
        "exact_changed_file_boundary": CHANGED_FILES,
        "effectiveness": {
            "effective": False,
            "condition": "S1_EXACT_HEAD_CI_PASS_AND_S1_MERGED_AND_HEAD_TO_MERGE_TREE_EQUIVALENT_AND_MERGED_MAIN_S1_GATE_PASS",
            "implementation_exact_head": None,
            "implementation_exact_head_ci_run": None,
            "merge_commit": None,
            "head_to_merge_file_delta_count": None,
            "head_to_merge_tree_equivalence": "PENDING",
            "postmerge_probe_pr_number": None,
            "postmerge_workflow_run": None,
            "postmerge_gate": "PENDING",
        },
        "preserved_nonclaims": [
            "NO_S2_AUTHORIZATION",
            "NO_CALIBRATION_ENGINE",
            "NO_CALIBRATION_CANDIDATE",
            "NO_SHADOW_EVALUATION",
            "NO_MODEL_ACTIVATION",
            "NO_ACTIVE_CONFIG_SWITCH",
            "NO_STATE_OR_CHECKPOINT_MUTATION",
            "NO_PUBLIC_ROUTE",
            "NO_WEB",
            "NO_SCHEDULER",
            "NO_MCFT_CAP_07_AUTHORIZATION",
        ],
    }
    save_json(STATUS_PATH, status)
    Path(RECORD_PATH).write_text(f"""<!-- {RECORD_PATH} -->

# GEOX MCFT-CAP-06 S1 — Controlled Canonical Residual Windows

```text
status: IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
baseline_main_commit: {BASELINE_MAIN}
implementation_pr: {PR_NUMBER}
candidate_execution_head: {EXECUTION_HEAD}
candidate_execution_workflow: {EXECUTION_WORKFLOW} SUCCESS
profile_id: {PROFILE}
qualification_track: CONTROLLED_POSITIVE_MECHANISM_TRACK
canonical_residual_count: 24
calibration_window_count: 16
holdout_window_count: 8
residual_set_hash: {RESIDUAL_SET_HASH}
calibration_window_hash: {CALIBRATION_HASH}
holdout_window_hash: {HOLDOUT_HASH}
case_input_set_hash: {CASE_INPUT_HASH}
```

S1 reuses the existing CAP-04 H1 Forecast trace, CAP-02 fixed-point Dynamics, CAP-05 `twin_forecast_residual_v1` contract and existing C transaction. Each controlled observation is generated by exact base replay at `0.030000` followed by a replay in which the only changed model parameter is `dynamics_parameters.drainage_coefficient_per_hour = 0.034000`.

The first 16 ordered Residuals form the calibration window and the later 8 form the holdout window. Event time and observation-availability time are both strictly separated. The controlled refs have zero intersection with the repository-history qualification track.

This candidate creates no calibration search, Candidate, Shadow Evaluation, Model Activation, active-config binding, State/checkpoint mutation, public route, Web behavior, scheduler or MCFT-CAP-07 authority. S2 remains blocked until S1 merges and its merged-main Gate passes.
""", encoding="utf-8")


def update_ssot() -> None:
    delivery_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json"
    delivery = load_json(delivery_path)
    delivery.update({
        "status": "IMPLEMENTATION_IN_PROGRESS",
        "implementation_status": "S1_IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "active_delivery_slice_id": S1,
        "authorized_not_started_slices": [],
        "next_repository_action": "MCFT-CAP-06.S1.MERGE-AND-MERGED-MAIN-GATE-V1",
        "s1_candidate_materialized": True,
        "s1_effective": False,
        "s1_contract_ref": CONTRACT_PATH,
        "s1_status_ref": STATUS_PATH,
    })
    delivery["candidate_slices"] = [{
        "delivery_slice_id": S1,
        "status": "IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "canonical_residual_count": 24,
        "residual_set_hash": RESIDUAL_SET_HASH,
        "calibration_window_hash": CALIBRATION_HASH,
        "holdout_window_hash": HOLDOUT_HASH,
        "runtime_source_authorized": True,
        "next_authorized_slice_after_effectiveness": S2,
    }]
    if S2 not in delivery.get("blocked_slices", []):
        delivery.setdefault("blocked_slices", []).insert(0, S2)
    save_json(delivery_path, delivery)

    current_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
    current = load_json(current_path)
    current["current_state"].update({
        "s0": "MERGED_EFFECTIVE",
        "s1": "IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "capability_line_authorization_effective": True,
        "runtime_source_authorized": True,
        "active_delivery_slice_id": S1,
        "controlled_residual_window_candidate_implemented": True,
        "controlled_residual_window_effective": False,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
        "capability_complete": False,
    })
    current["next_repository_action"] = "MCFT-CAP-06.S1.MERGE-AND-MERGED-MAIN-GATE-V1"
    current["s1_candidate"] = {
        "contract_ref": CONTRACT_PATH,
        "status_ref": STATUS_PATH,
        "canonical_residual_count": 24,
        "residual_set_hash": RESIDUAL_SET_HASH,
        "calibration_window_hash": CALIBRATION_HASH,
        "holdout_window_hash": HOLDOUT_HASH,
        "execution_workflow": EXECUTION_WORKFLOW,
    }
    current["preserved_nonclaims"] = [
        "NO_S2_AUTHORIZATION",
        "NO_CALIBRATION_CANDIDATE",
        "NO_SHADOW_EVALUATION",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    save_json(current_path, current)

    matrix_path = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    matrix = load_json(matrix_path)
    matrix["baseline"] = {
        "branch": "main",
        "commit": BASELINE_MAIN,
        "meaning": "MCFT-CAP-06 S0 effective; S1 controlled Residual-window implementation candidate; S2 and later remain blocked",
    }
    lines = matrix.get("capability_lines") or matrix.get("capabilities")
    if not isinstance(lines, list):
        raise RuntimeError("S1_CAPABILITY_LINES_REQUIRED")
    line = next((item for item in lines if item.get("capability_line_id") == "MCFT-CAP-06"), None)
    if line is None:
        raise RuntimeError("S1_MATRIX_ENTRY_REQUIRED")
    line.update({
        "status": "IMPLEMENTATION_IN_PROGRESS",
        "authorization_status": "MERGED_EFFECTIVE",
        "authorization_effective": True,
        "runtime_source_authorized": True,
        "implementation_status": "S1_IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "active_delivery_slice_id": S1,
        "s1_contract_ref": CONTRACT_PATH,
        "s1_status_ref": STATUS_PATH,
        "controlled_residual_window_candidate_implemented": True,
        "controlled_residual_window_effective": False,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
        "capability_complete": False,
        "next_authorized_slice_ids": [S1],
        "successor_authorized": False,
    })
    slices = line.setdefault("delivery_slices", [])
    s1 = next((item for item in slices if item.get("delivery_slice_id") == S1), None)
    if s1 is None:
        s1 = {"delivery_slice_id": S1, "primary_owner_work_package_id": "MCFT-11", "contributing_owner_work_package_ids": ["MCFT-01", "MCFT-03"]}
        slices.append(s1)
    s1.update({
        "status": "IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS",
        "baseline_main_commit": BASELINE_MAIN,
        "implementation_pr_number": PR_NUMBER,
        "candidate_execution_head": EXECUTION_HEAD,
        "candidate_execution_workflow": EXECUTION_WORKFLOW,
        "runtime_source_authorized": True,
        "canonical_residual_count": 24,
        "residual_set_hash": RESIDUAL_SET_HASH,
        "calibration_window_hash": CALIBRATION_HASH,
        "holdout_window_hash": HOLDOUT_HASH,
        "effectiveness_condition_satisfied": False,
    })
    save_json(matrix_path, matrix)


def update_text_documents() -> None:
    task_path = Path("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md")
    task = task_path.read_text(encoding="utf-8")
    boundary = "\n# 0. 核心裁决"
    header, rest = task.split(boundary, 1)
    header = replace_header_field(header, "implementation_status", "S0_MERGED_EFFECTIVE_S1_AUTHORIZED_NOT_STARTED", "S1_IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS")
    old = "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 均已 merged-main effective；repository-history qualification 为 INSUFFICIENT_MATCHED_PAIRS，且 graph、availability 与 homogeneity 均 PASS。当前仅 S1 Runtime source 实现获授权但尚未开始；S2 及后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。"
    new = "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0 与 S0 均已 merged-main effective；S1 已形成受控 24-case canonical Residual-window implementation candidate，等待 exact-head CI、merge、tree equivalence 与 merged-main S1 Gate。S2 及后续、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。"
    if old not in header:
        raise RuntimeError("S1_TASK_STATUS_PARAGRAPH_REQUIRED")
    header = header.replace(old, new, 1)
    task_path.write_text(header + boundary + rest, encoding="utf-8")
    append_once(str(task_path), "<!-- MCFT-CAP-06-S1-CANDIDATE-BEGIN -->", f"""<!-- MCFT-CAP-06-S1-CANDIDATE-BEGIN -->
# 52. S1 controlled canonical Residual-window candidate

```text
status: IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
baseline main: {BASELINE_MAIN}
implementation PR: {PR_NUMBER}
candidate execution head: {EXECUTION_HEAD}
candidate PostgreSQL workflow: {EXECUTION_WORKFLOW} SUCCESS
profile: {PROFILE}
canonical Residuals: 24
calibration window: 16
holdout window: 8
residual set hash: {RESIDUAL_SET_HASH}
calibration window hash: {CALIBRATION_HASH}
holdout window hash: {HOLDOUT_HASH}
case input set hash: {CASE_INPUT_HASH}
S2 authorized: false
```

S1 reuses CAP-02 fixed-point Dynamics, CAP-04 H1 Forecast traces, CAP-05 Residual contracts and the existing C transaction. It introduces no second Residual type, no migration and no calibration search. The controlled mechanism track is disjoint from repository history.
<!-- MCFT-CAP-06-S1-CANDIDATE-END -->""")
    append_once("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "<!-- MCFT-CAP-06-S1-CANDIDATE-BEGIN -->", f"""<!-- MCFT-CAP-06-S1-CANDIDATE-BEGIN -->
## MCFT-CAP-06 S1 controlled Residual-window candidate

```text
capability_line_id: MCFT-CAP-06
delivery_slice_id: {S1}
baseline_main_commit: {BASELINE_MAIN}
status: IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
candidate_execution_workflow: {EXECUTION_WORKFLOW} SUCCESS
controlled_profile: {PROFILE}
canonical_residual_count: 24
calibration_window_count: 16
holdout_window_count: 8
residual_set_hash: {RESIDUAL_SET_HASH}
S2_status: BLOCKED
Candidate_runtime_implemented: false
Shadow_Evaluation_runtime_implemented: false
Model_Activation_authorized: false
MCFT_CAP_07_authorized: false
```
<!-- MCFT-CAP-06-S1-CANDIDATE-END -->""")


def write_gate() -> None:
    refs_json = json.dumps(ORDERED_REFS)
    hashes_json = json.dumps(ORDERED_HASHES)
    files_json = json.dumps(CHANGED_FILES)
    gate = f'''// {GATE_PATH}
// Purpose: fail closed on the exact MCFT-CAP-06 S1 controlled Residual-window candidate and preserved S2 boundary.
// Boundary: governance validation only; no database write, calibration search, Candidate, Evaluation, Model Activation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const S1 = '{S1}';
const S2 = '{S2}';
const EXPECTED_REFS = {refs_json};
const EXPECTED_HASHES = {hashes_json};
const EXPECTED_FILES = {files_json};

function readJson(relativePath) {{ return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }}
function readText(relativePath) {{ return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }}

function main() {{
  const contract = readJson('{CONTRACT_PATH}');
  const status = readJson('{STATUS_PATH}');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');

  assert.equal(contract.delivery_slice_id, S1);
  assert.equal(contract.status, 'IMPLEMENTATION_CANDIDATE');
  assert.equal(contract.profile_id, '{PROFILE}');
  assert.equal(contract.qualification_track, 'CONTROLLED_POSITIVE_MECHANISM_TRACK');
  assert.equal(contract.canonical_residual_count, 24);
  assert.deepEqual(contract.ordered_residual_refs, EXPECTED_REFS);
  assert.deepEqual(contract.ordered_residual_hashes, EXPECTED_HASHES);
  assert.equal(contract.residual_set_hash, '{RESIDUAL_SET_HASH}');
  assert.deepEqual(contract.calibration_window.ordered_residual_refs, EXPECTED_REFS.slice(0, 16));
  assert.deepEqual(contract.holdout_window.ordered_residual_refs, EXPECTED_REFS.slice(16));
  assert.equal(contract.calibration_window.window_hash, '{CALIBRATION_HASH}');
  assert.equal(contract.holdout_window.window_hash, '{HOLDOUT_HASH}');
  assert.equal(contract.case_input_set_hash, '{CASE_INPUT_HASH}');
  assert.equal(contract.validation.future_leakage_count, 0);
  assert.equal(contract.validation.calibration_holdout_ref_intersection_count, 0);
  assert.equal(contract.validation.controlled_repository_history_ref_intersection_count, 0);
  assert.equal(contract.canonical_deltas.twin_forecast_residual_v1, 24);
  assert.equal(contract.canonical_deltas.twin_calibration_candidate_v1, 0);
  assert.equal(contract.canonical_deltas.twin_shadow_evaluation_v1, 0);
  assert.equal(contract.canonical_deltas.twin_model_activation_v1, 0);
  assert.equal(contract.migration_delta, 0);

  assert.equal(status.status, 'IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(status.runtime_source_authorized, true);
  assert.equal(status.canonical_write_authorized_for_slice, true);
  assert.deepEqual(status.canonical_write_scope, ['twin_forecast_residual_v1']);
  assert.equal(status.s1_effective, false);
  assert.equal(status.s2_authorized, false);
  assert.deepEqual([...status.exact_changed_file_boundary].sort(), [...EXPECTED_FILES].sort());

  assert.equal(delivery.active_delivery_slice_id, S1);
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

  const runner = readText('scripts/acceptance/run_acceptance.cjs');
  assert.ok(runner.includes('MCFT_CAP_06_S1_RESIDUAL_WINDOWS_POSTGRESQL'));
  assert.ok(runner.includes('MCFT_CAP_06_S1_RESIDUAL_WINDOWS_GOVERNANCE'));
  const fixture = readText('scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts');
  assert.ok(fixture.includes('executeHourlyWaterBalanceV1'));
  assert.ok(fixture.includes('buildCap05ForecastResidualV1'));
  assert.ok(fixture.includes('buildCap04S7RangeFixtureV1'));
  assert.equal(fixture.includes('twin_calibration_candidate_v1'), false);
  assert.equal(fixture.includes('twin_shadow_evaluation_v1'), false);
  assert.equal(fixture.includes('twin_model_activation_v1'), false);

  console.log('PASS MCFT-CAP-06 S1 exact 24 Residual refs and hashes');
  console.log('PASS disjoint 16/8 dual-time windows and zero future leakage');
  console.log('PASS existing C transaction reuse, zero migration and isolated PostgreSQL harness');
  console.log('PASS S2/Candidate/Evaluation/Activation/CAP-07 remain blocked');
}}

main();
'''
    Path(GATE_PATH).write_text(gate, encoding="utf-8")


def wire_acceptance() -> None:
    path = Path("scripts/acceptance/run_acceptance.cjs")
    source = path.read_text(encoding="utf-8")
    anchor = """    {
      id: 'MCFT_CAP_06_S0_V2_GOVERNANCE',
      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs',
      logFile: 'MCFT_CAP_06_S0_V2_GOVERNANCE.log',
      notes: 'Validates the formal S0 v2 predecessor lock, dataset qualification, exact changed-file boundary, and preserved non-authority claims.'
    }"""
    replacement = anchor + ",\n" + """    {
      id: 'MCFT_CAP_06_S1_RESIDUAL_WINDOWS_POSTGRESQL',
      command: 'node scripts/runtime_acceptance/RUN_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs',
      logFile: 'MCFT_CAP_06_S1_RESIDUAL_WINDOWS_POSTGRESQL.log',
      notes: 'Creates an isolated database and proves the controlled 24-Residual profile, exact 16/8 windows, idempotency, negative guards and facts-only rebuild.'
    },
    {
      id: 'MCFT_CAP_06_S1_RESIDUAL_WINDOWS_GOVERNANCE',
      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs',
      logFile: 'MCFT_CAP_06_S1_RESIDUAL_WINDOWS_GOVERNANCE.log',
      notes: 'Validates exact S1 refs/hashes, controlled/repository track isolation, zero migration and preserved S2/Candidate/Evaluation/Activation boundaries.'
    }"""
    if source.count(anchor) != 1:
        raise RuntimeError(f"S1_ACCEPTANCE_WIRING_MATCH:{source.count(anchor)}")
    path.write_text(source.replace(anchor, replacement, 1), encoding="utf-8")


def clean_implementation() -> None:
    path = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts")
    source = path.read_text(encoding="utf-8")
    source = re.sub(
        r'\nfunction expectGraphFailureV1\([\s\S]*?\n}\n\nfunction assertDuplicateTargetRejectedV1',
        '\nfunction assertDuplicateTargetRejectedV1',
        source,
        count=1,
    )
    path.write_text(source, encoding="utf-8")


def remove_temporary_assets() -> None:
    for path in [
        ".github/workflows/mcft-cap-06-s1-materialize.yml",
        ".github/workflows/mcft-cap-06-s1-finalize.yml",
        "scripts/remediation/FINALIZE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_V1.py",
    ]:
        Path(path).unlink(missing_ok=True)


def main() -> None:
    write_contracts()
    update_ssot()
    update_text_documents()
    write_gate()
    wire_acceptance()
    clean_implementation()
    remove_temporary_assets()
    print("MCFT_CAP_06_S1_CANDIDATE_MATERIALIZED")


if __name__ == "__main__":
    main()
