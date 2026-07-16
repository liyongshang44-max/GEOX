# scripts/governance_acceptance/materialize_mcft_cap06_s1_correction.py
# Purpose: materialize the additive MCFT-CAP-06 S1 controlled-data correction candidate from exact runtime artifacts.
# Boundary: one-shot repository writeback helper; it changes governance/docs only and creates no Runtime, Candidate, Evaluation, Activation, route, Web, scheduler, or CAP-07 authority.

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CAP = ROOT / "docs/digital_twin/mcft/cap_06"
S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1"
S2 = "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1"
BASE_MAIN = "3a1494acb47db776d97ba75e339d85dc18c9d629"
OLD_RESIDUAL_SET = "sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7"
OLD_CASE_INPUT_SET = "sha256:fac894cf5a4de2c473523190408933ae25185c6a63b9568cde2d8121add4dc62"
ERRATUM_REF = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json"
EXPECTED_FILES = [
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    ERRATUM_REF,
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.md",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "scripts/acceptance/run_acceptance.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_REGIMES.ts",
    "scripts/runtime_acceptance/mcft_cap_04_twenty_four_tick_range_fixture_v1.ts",
    "scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts",
]


def read_json(path: Path | str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path | str, value: dict[str, Any]) -> None:
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def upsert_marked_section(path: Path, marker: str, body: str) -> None:
    text = path.read_text(encoding="utf-8")
    begin = f"<!-- {marker}:BEGIN -->"
    end = f"<!-- {marker}:END -->"
    section = f"{begin}\n{body.rstrip()}\n{end}"
    if begin in text:
        start = text.index(begin)
        finish = text.index(end, start) + len(end)
        text = text[:start] + section + text[finish:]
    else:
        text = text.rstrip() + "\n\n" + section + "\n"
    path.write_text(text, encoding="utf-8")


def replace_runner_governance_step() -> None:
    path = ROOT / "scripts/acceptance/run_acceptance.cjs"
    text = path.read_text(encoding="utf-8")
    old_id = "id: 'MCFT_CAP_06_S1_RESIDUAL_WINDOWS_GOVERNANCE'"
    new_id = "id: 'MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION_GOVERNANCE'"
    if new_id in text:
        return
    if text.count(old_id) != 1:
        raise RuntimeError(f"S1 governance runner id count={text.count(old_id)}")
    start = text.rfind("    {", 0, text.index(old_id))
    end = text.index("\n    }", text.index(old_id)) + len("\n    }")
    replacement = """    {
      id: 'MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION_GOVERNANCE',
      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs',
      logFile: 'MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION_GOVERNANCE.log',
      notes: 'Cross-checks regenerated S1 runtime and wetness-regime evidence against the additive erratum and current SSOT while S2 remains blocked.'
    }"""
    path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


def main() -> None:
    candidate_head = os.environ.get("CANDIDATE_HEAD", "").strip()
    workflow_run = int(os.environ.get("CANDIDATE_WORKFLOW_RUN", "0"))
    if not candidate_head or workflow_run <= 0:
        raise RuntimeError("CANDIDATE_HEAD_AND_WORKFLOW_RUN_REQUIRED")

    runtime = read_json(ROOT / "acceptance-output/MCFT_CAP_06_S1_RESULT.json")
    regimes = read_json(ROOT / "acceptance-output/MCFT_CAP_06_S1_CONTROLLED_REGIMES_RESULT.json")
    assert runtime["ordered_residual_refs"] == regimes["ordered_residual_refs"]
    assert runtime["ordered_residual_hashes"] == regimes["ordered_residual_hashes"]
    assert runtime["residual_set_hash"] == regimes["residual_set_hash"]
    assert runtime["case_input_set_hash"] == regimes["case_input_set_hash"]
    assert regimes["calibration_regime_counts"] == {"LOW_EXCESS": 8, "MID_EXCESS": 2, "HIGH_EXCESS": 6}
    assert regimes["holdout_regime_counts"] == {"LOW_EXCESS": 0, "MID_EXCESS": 0, "HIGH_EXCESS": 8}
    assert regimes["calibration_represented_regime_count"] == 3

    erratum: dict[str, Any] = {
        "schema_version": "geox_mcft_cap_06_s1_controlled_data_erratum_v1",
        "erratum_id": "MCFT-CAP-06.S1-CONTROLLED-DATA-SUCCESSOR-READINESS-ERRATUM-V1",
        "capability_line_id": "MCFT-CAP-06",
        "affected_delivery_slice_id": S1,
        "status": "CORRECTION_CANDIDATE",
        "baseline_main_commit": BASE_MAIN,
        "correction_pr_number": 2519,
        "discovery": {
            "closed_without_merge_s2_pr_number": 2518,
            "s2_probe_run_16_case": 29481414125,
            "s2_probe_run_24_case": 29481690201,
            "original_case_count": 24,
            "original_regime_counts": {"LOW_EXCESS": 24, "MID_EXCESS": 0, "HIGH_EXCESS": 0},
            "original_maximum_normalized_excess_ratio_scale_9": "0.093326488",
            "frozen_mid_lower_bound": "0.100000000",
            "finding": "NO_16_8_RESELECTION_CAN_MEET_TWO_SENSITIVE_WETNESS_REGIMES",
        },
        "scope_of_retraction": {
            "prior_s1_mechanical_proof_preserved": True,
            "prior_s1_successor_readiness_claim_superseded": True,
            "s2_authorization_withdrawn": True,
            "prior_effectiveness_ref": "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json",
            "prior_residual_set_hash": OLD_RESIDUAL_SET,
            "prior_case_input_set_hash": OLD_CASE_INPUT_SET,
        },
        "correction": {
            "forcing_profile_id": "CAP06_MULTI_REGIME_V1",
            "dynamics_changed": False,
            "regime_formula_changed": False,
            "regime_thresholds_changed": False,
            "base_parameter": "0.030000",
            "hidden_parameter": "0.034000",
            "canonical_residual_count": 24,
            "ordered_residual_refs": runtime["ordered_residual_refs"],
            "ordered_residual_hashes": runtime["ordered_residual_hashes"],
            "residual_set_hash": runtime["residual_set_hash"],
            "case_input_set_hash": runtime["case_input_set_hash"],
            "calibration_window_hash": runtime["calibration_window_hash"],
            "holdout_window_hash": runtime["holdout_window_hash"],
            "calibration_regime_counts": regimes["calibration_regime_counts"],
            "holdout_regime_counts": regimes["holdout_regime_counts"],
            "calibration_represented_regime_count": regimes["calibration_represented_regime_count"],
            "base_replay_status": regimes["base_replay_status"],
            "postgresql_acceptance": "9_PASS_0_FAIL",
        },
        "candidate_execution": {"head": candidate_head, "workflow_run": workflow_run},
        "effectiveness": {
            "effective": False,
            "condition": "CORRECTION_EXACT_HEAD_CI_PASS_AND_MERGED_AND_TREE_EQUIVALENT_AND_MERGED_MAIN_GATE_PASS_AND_SEPARATE_EFFECTIVENESS_WRITEBACK",
        },
        "preserved_nonclaims": [
            "NO_S2_IMPLEMENTATION_ON_CORRECTED_BASELINE",
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
    write_json(CAP / "GEOX-MCFT-CAP-06-S1-CONTROLLED-DATA-ERRATUM.json", erratum)

    contract_path = CAP / "GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json"
    contract = read_json(contract_path)
    contract.update(
        status="CONTROLLED_DATA_CORRECTION_CANDIDATE",
        baseline_main_commit=BASE_MAIN,
        implementation_pr_number=2519,
        candidate_execution_head=candidate_head,
        candidate_execution_workflow=workflow_run,
        ordered_residual_refs=runtime["ordered_residual_refs"],
        ordered_residual_hashes=runtime["ordered_residual_hashes"],
        residual_set_hash=runtime["residual_set_hash"],
        case_input_set_hash=runtime["case_input_set_hash"],
        erratum_ref=ERRATUM_REF,
    )
    contract["calibration_window"].update(
        ordered_residual_refs=runtime["calibration_window_refs"],
        window_hash=runtime["calibration_window_hash"],
    )
    contract["holdout_window"].update(
        ordered_residual_refs=runtime["holdout_window_refs"],
        window_hash=runtime["holdout_window_hash"],
    )
    contract["validation"].update(
        controlled_regime_acceptance="PASS",
        calibration_regime_counts=regimes["calibration_regime_counts"],
        holdout_regime_counts=regimes["holdout_regime_counts"],
        calibration_represented_regime_count=regimes["calibration_represented_regime_count"],
        minimum_required_calibration_regime_count=2,
        runtime_result_ssot_crosscheck="PASS",
    )
    write_json(contract_path, contract)

    status_path = CAP / "GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json"
    status = read_json(status_path)
    status["prior_effectiveness"] = status.get("effectiveness", {})
    status.update(
        status="CONTROLLED_DATA_CORRECTION_CANDIDATE",
        baseline_main_commit=BASE_MAIN,
        implementation_pr_number=2519,
        candidate_execution_head=candidate_head,
        candidate_execution_workflow=workflow_run,
        candidate_execution_result="REGIME_PASS_POSTGRESQL_9_PASS_0_FAIL",
        residual_set_hash=runtime["residual_set_hash"],
        calibration_window_hash=runtime["calibration_window_hash"],
        holdout_window_hash=runtime["holdout_window_hash"],
        case_input_set_hash=runtime["case_input_set_hash"],
        s1_effective=False,
        s2_authorized=False,
        next_authorized_slice_after_effectiveness=S2,
        erratum_ref=ERRATUM_REF,
        exact_changed_file_boundary=EXPECTED_FILES,
        effectiveness={"effective": False, "condition": erratum["effectiveness"]["condition"]},
        candidate_tree_validation={
            "controlled_regime_acceptance": "PASS_8_LOW_2_MID_6_HIGH_CALIBRATION",
            "isolated_postgresql_acceptance": "9_PASS_0_FAIL",
            "runtime_result_ssot_crosscheck": "PASS",
            "repository_typecheck": "PENDING_EXACT_HEAD_CI",
            "repository_build": "PENDING_EXACT_HEAD_CI",
            "exact_changed_file_count": len(EXPECTED_FILES),
            "temporary_workflows_retained": False,
            "generated_acceptance_artifacts_retained": False,
        },
    )
    write_json(status_path, status)

    delivery_path = CAP / "GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json"
    delivery = read_json(delivery_path)
    delivery.update(
        implementation_status="S1_CONTROLLED_DATA_CORRECTION_CANDIDATE_S2_AUTHORIZATION_WITHDRAWN",
        active_delivery_slice_id=S1,
        candidate_slices=[S1],
        next_repository_action=S1,
        authorized_not_started_slices=[],
        s1_candidate_materialized=True,
        s1_effective=False,
        s1_successor_readiness_effective=False,
        s1_prior_mechanical_effectiveness_preserved=True,
        s2_authorized=False,
        s2_implementation_started=False,
        s1_erratum_ref=ERRATUM_REF,
    )
    if S2 not in delivery["blocked_slices"]:
        delivery["blocked_slices"].insert(0, S2)
    for item in delivery["completed_or_effective_slices"]:
        if item.get("delivery_slice_id") == S1:
            item["status"] = "PRIOR_MERGED_EFFECTIVE_MECHANICAL_PROOF_PRESERVED_SUCCESSOR_READINESS_SUPERSEDED"
            item["superseded_by_erratum"] = erratum["erratum_id"]
    write_json(delivery_path, delivery)

    current_path = CAP / "GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
    current = read_json(current_path)
    current.update(
        status="S1_CONTROLLED_DATA_CORRECTION_CANDIDATE",
        reconciliation_effective=False,
        next_repository_action=S1,
        effectiveness_condition=erratum["effectiveness"]["condition"],
    )
    current["current_state"].update(
        active_delivery_slice_id=S1,
        s1="CONTROLLED_DATA_CORRECTION_CANDIDATE",
        controlled_residual_window_candidate_implemented=True,
        controlled_residual_window_effective=False,
        s2="BLOCKED_BY_S1_CONTROLLED_DATA_CORRECTION",
        calibration_contract_math_implemented=False,
    )
    current["proof"]["s1_controlled_data_correction"] = {
        "correction_pr_number": 2519,
        "candidate_head": candidate_head,
        "candidate_workflow_run": workflow_run,
        "erratum_ref": ERRATUM_REF,
        "regime_acceptance": "PASS",
        "postgresql_acceptance": "9_PASS_0_FAIL",
        "effective": False,
    }
    current["s1_candidate"].update(
        residual_set_hash=runtime["residual_set_hash"],
        calibration_window_hash=runtime["calibration_window_hash"],
        holdout_window_hash=runtime["holdout_window_hash"],
        execution_workflow=workflow_run,
    )
    write_json(current_path, current)

    matrix_path = ROOT / "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    matrix = read_json(matrix_path)
    lines = matrix.get("capability_lines", matrix.get("capabilities"))
    line = next(item for item in lines if item.get("capability_line_id") == "MCFT-CAP-06")
    line.update(
        active_delivery_slice_id=S1,
        next_authorized_slice_ids=[],
        controlled_residual_window_candidate_implemented=True,
        controlled_residual_window_effective=False,
        s1_successor_readiness_effective=False,
        s1_prior_mechanical_effectiveness_preserved=True,
    )
    for item in line["delivery_slices"]:
        if item.get("delivery_slice_id") == S1:
            item.update(status="CONTROLLED_DATA_CORRECTION_CANDIDATE", effectiveness_condition_satisfied=False)
        if item.get("delivery_slice_id") == S2:
            item.update(
                status="BLOCKED_BY_S1_CONTROLLED_DATA_CORRECTION",
                implementation_started=False,
                migration_authorized=False,
                canonical_write_authorized=False,
            )
    write_json(matrix_path, matrix)

    correction_text = f"""## MCFT-CAP-06 S1 受控数据后继就绪性纠偏

S2 草稿 PR #2518 的专用 probe 证明：原 S1 的 24 个受控案例全部属于 `LOW_EXCESS`，最大归一化超田间持水量比率仅为 `0.093326488`，低于冻结的 `MID_EXCESS` 下界 `0.10`。因此，原 S1 的机械持久化、幂等和重建证明保留，但其对 S2 的后继就绪性授权被撤销。

当前唯一 active slice 回到 `{S1}` 的受控数据纠偏。纠偏仅增加 CAP-06 专用 `CAP06_MULTI_REGIME_V1` forcing profile；不修改 Dynamics、固定点策略、湿度分区公式或阈值。修正后的校准窗口为 8 LOW / 2 MID / 6 HIGH，holdout 为 8 HIGH；24 条 Residual refs 保持稳定，Residual hashes、residual-set hash 与 case-input-set hash按新证据重新生成。

在纠偏 exact-head CI、merge、head-to-merge tree equivalence、merged-main Gate 与独立 effectiveness writeback 全部通过前，S2 及其后续 Slice 均保持阻塞。"""
    marker = "MCFT-CAP-06-S1-CONTROLLED-DATA-CORRECTION"
    upsert_marked_section(CAP / "GEOX-MCFT-CAP-06-TASK.md", marker, correction_text)
    upsert_marked_section(CAP / "GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.md", marker, correction_text)
    upsert_marked_section(ROOT / "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", marker, correction_text)
    replace_runner_governance_step()


if __name__ == "__main__":
    main()
