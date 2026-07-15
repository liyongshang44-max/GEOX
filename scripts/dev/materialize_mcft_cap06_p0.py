# scripts/dev/materialize_mcft_cap06_p0.py
# Purpose: atomically materialize the governance-only MCFT-CAP-06 P0 provisional SSOT candidate.
# Boundary: edits only the frozen P0 governance files and deletes its own temporary materialization assets.

import json
from pathlib import Path

BASELINE = "79cd7814eff06ad86f86cdcb379c6f71a77f1ab8"
MATRIX_PATH = Path("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json")
MAP_PATH = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
TASK_PATH = Path("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md")
WORKFLOW_PATH = Path(".github/workflows/mcft-cap-06-p0-materialize.yml")
SELF_PATH = Path("scripts/dev/materialize_mcft_cap06_p0.py")


def materialize_matrix() -> None:
    matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    matrix["baseline"] = {
        "branch": "main",
        "commit": BASELINE,
        "meaning": "MCFT-CAP-05 COMPLETE; MCFT-CAP-06 P-1 merged-main effective; P0 provisional SSOT candidate; CAP-06 Runtime and S0 remain unauthorized",
    }
    cap05 = next((entry for entry in matrix["capability_lines"] if entry.get("capability_line_id") == "MCFT-CAP-05"), None)
    if cap05 is None:
        raise SystemExit("MCFT-CAP-05 matrix entry missing")
    cap05.update({
        "status": "COMPLETE",
        "implementation_status": "COMPLETE",
        "closure_effective": True,
        "capability_complete": True,
        "active_delivery_slice_id": None,
        "next_repository_action": None,
        "successor_capability_line_id": "MCFT-CAP-06",
        "successor_authorized": False,
    })
    cap06 = next((entry for entry in matrix["capability_lines"] if entry.get("capability_line_id") == "MCFT-CAP-06"), None)
    cap06_value = {
        "capability_line_id": "MCFT-CAP-06",
        "display_alias": "MCFT-6",
        "name": "Calibration Candidate and Shadow Evaluation",
        "runtime_mode": "REPLAY",
        "target_completion_level": "Level A",
        "status": "NOT_AUTHORIZED",
        "design_status": "CONDITIONAL_FROZEN_AFTER_P_MINUS_1",
        "implementation_status": "P_MINUS_1_COMPLETE",
        "authorization_effective": False,
        "runtime_source_authorized": False,
        "active_delivery_slice_id": None,
        "predecessor_capability_line_id": "MCFT-CAP-05",
        "successor_capability_line_id": "MCFT-CAP-07",
        "successor_authorized": False,
        "primary_owner_work_package_id": "MCFT-12",
        "contributing_owner_work_package_ids": ["MCFT-01", "MCFT-02", "MCFT-03", "MCFT-04", "MCFT-05", "MCFT-06", "MCFT-07", "MCFT-08", "MCFT-09", "MCFT-11", "MCFT-16"],
        "excluded_owner_work_package_ids": ["MCFT-10", "MCFT-13", "MCFT-14", "MCFT-15", "MCFT-17", "MCFT-18"],
        "p_minus_1": {
            "delivery_slice_id": "MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1",
            "status": "MERGED_EFFECTIVE",
            "outcome": "REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED",
            "implementation_pr_number": 2496,
            "implementation_exact_head": "762764074e62f186921e0aabd5251f53b5f7ce02",
            "merge_commit": BASELINE,
            "postmerge_probe_pr_number": 2497,
            "postmerge_workflow_run": 29418272690,
        },
        "p0": {
            "delivery_slice_id": "MCFT-CAP-06.P0.CAP-05-TERMINAL-SSOT-RECONCILIATION-AND-PROVISIONAL-SSOT-V1",
            "status": "CANDIDATE",
            "effective": False,
        },
        "next_repository_action": None,
        "next_repository_action_after_p0_effectiveness": "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1",
        "preserved_nonclaims": [
            "NO_RUNTIME_SOURCE_AUTHORIZATION",
            "NO_MIGRATION",
            "NO_CANONICAL_WRITE",
            "NO_CALIBRATION_CANDIDATE",
            "NO_SHADOW_EVALUATION",
            "NO_MODEL_ACTIVATION",
            "NO_ACTIVE_CONFIG_SWITCH",
            "NO_S0_EFFECTIVENESS",
            "NO_MCFT_CAP_07_AUTHORIZATION",
        ],
    }
    if cap06 is None:
        matrix["capability_lines"].append(cap06_value)
    else:
        cap06.clear()
        cap06.update(cap06_value)
    MATRIX_PATH.write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def replace_marked_section(text: str, begin: str, end: str, section: str) -> str:
    if begin in text and end in text:
        prefix = text.split(begin, 1)[0].rstrip()
        suffix = text.split(end, 1)[1].lstrip("\n")
        return prefix + section + ("\n" + suffix if suffix else "")
    return text.rstrip() + section


def materialize_map() -> None:
    implementation_map = MAP_PATH.read_text(encoding="utf-8")
    begin = "<!-- MCFT-CAP-06-P0-CURRENT-STATE-BEGIN -->"
    end = "<!-- MCFT-CAP-06-P0-CURRENT-STATE-END -->"
    section = f'''\n\n{begin}\n## MCFT-CAP-06 P-1 effectiveness and P0 provisional map\n\n```text\nbaseline merged main:\n{BASELINE}\n\nP-1 status:\nMERGED_EFFECTIVE\n\nP-1 outcome:\nREUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED\n\nP0 status:\nPROVISIONAL_SSOT_CANDIDATE\n\nauthorization effective:\nfalse\n\nruntime source authorized:\nfalse\n\nactive delivery slice:\nnull\n\nS0 status:\nBLOCKED_PENDING_P0_MERGED_MAIN_EFFECTIVENESS\n\nP-1A:\nOMITTED\n\nconditional S4:\nOMITTED\n\nS3 migration adjudication:\nEXACTLY_ONE_ADDITIVE_MIGRATION\n\nsuccessor MCFT-CAP-07 authorized:\nfalse\n```\n\nP0 reconciles CAP-05 terminal COMPLETE facts and adds the provisional MCFT-CAP-06 capability line. It grants no Runtime, migration, canonical-write, S0, Model Activation, active-binding, or successor authority.\n{end}\n'''
    MAP_PATH.write_text(replace_marked_section(implementation_map, begin, end, section), encoding="utf-8")


def materialize_task() -> None:
    task = TASK_PATH.read_text(encoding="utf-8")
    task = task.replace("CONDITIONAL_FROZEN_PENDING_P_MINUS_1", "CONDITIONAL_FROZEN_AFTER_P_MINUS_1")
    task = task.replace("P_MINUS_1_READY", "P_MINUS_1_COMPLETE")
    task = task.replace("UNDECIDED_PENDING_P_MINUS_1", "NOT_REQUIRED")
    task = task.replace("first_permitted_repository_action:\nMCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1", "first_permitted_repository_action:\nnull")
    task = task.replace("next_repository_action:\nMCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1", "next_repository_action:\nnull")
    task = task.replace("REUSE_PENDING_P_MINUS_1_CONFIRMATION", "REUSE_WITHOUT_AMENDMENT")
    task = task.replace(
        "本文件冻结 MCFT-CAP-06 的能力目标、边界、任务顺序和 P-1 裁决输入。它只授权开始 P-1 架构裁决，不授权 Runtime source、migration、runner、canonical write、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 或 Shadow-Online Runtime。",
        "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1 已 merged-main effective；当前 P0 只建立 provisional SSOT，不授权 S0、Runtime source、migration、runner、canonical write、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 或 Shadow-Online Runtime。",
    )
    begin = "<!-- MCFT-CAP-06-P0-CURRENT-STATE-BEGIN -->"
    end = "<!-- MCFT-CAP-06-P0-CURRENT-STATE-END -->"
    section = f'''\n\n{begin}\n# 49. P-1 merged-main effectiveness / P0 provisional state\n\n```text\nP-1 outcome:\nREUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED\n\nP-1 implementation PR:\n#2496\n\nP-1 implementation exact head:\n762764074e62f186921e0aabd5251f53b5f7ce02\n\nP-1 merge commit:\n{BASELINE}\n\nP-1 postmerge probe PR:\n#2497 CLOSED_WITHOUT_MERGE\n\nP-1 postmerge workflow:\n29418272690 SUCCESS\n\nP-1 status:\nMERGED_EFFECTIVE\n\nP-1A:\nOMITTED\n\nconditional S4:\nOMITTED\n\nP0 status:\nPROVISIONAL_SSOT_CANDIDATE\n\nauthorization_effective:\nfalse\n\nruntime_source_authorized:\nfalse\n\nactive_delivery_slice_id:\nnull\n\nS0 status:\nBLOCKED_PENDING_P0_MERGED_MAIN_EFFECTIVENESS\n\nnext_repository_action:\nnull\n```\n\nP0 不重开 CAP-05 closure，不创建 Runtime、migration、canonical object、Model Activation 或 active binding。P0 只有在合并、head-to-merge tree equivalence 和 merged-main P0 Gate 成功后，才使 S0 成为下一项可执行治理工作。\n{end}\n'''
    TASK_PATH.write_text(replace_marked_section(task, begin, end, section), encoding="utf-8")


def delete_temporary_assets() -> None:
    WORKFLOW_PATH.unlink()
    SELF_PATH.unlink()


materialize_matrix()
materialize_map()
materialize_task()
delete_temporary_assets()
