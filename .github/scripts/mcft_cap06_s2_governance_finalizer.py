#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
S2 = "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1"
S3 = "MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1"
BASELINE = "9eff45605dc709a6001e6c1bed29fd1df76197ed"
S1_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs"
S2_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs"

EXPECTED_FILES = [
    "apps/server/src/domain/calibration/case_builder_v1.ts",
    "apps/server/src/domain/calibration/contracts_v1.ts",
    "apps/server/src/domain/calibration/envelope_profiles_v1.ts",
    "apps/server/src/domain/calibration/exact_ref_port_v1.ts",
    "apps/server/src/domain/calibration/fixed_point_metric_v1.ts",
    "apps/server/src/domain/calibration/grid_search_v1.ts",
    "apps/server/src/domain/calibration/shadow_evaluation_v1.ts",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "scripts/acceptance/run_acceptance.cjs",
    S1_GATE,
    S2_GATE,
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts",
]


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def write_json(relative: str, value) -> None:
    (ROOT / relative).write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def replace_once(text: str, old: str, new: str, code: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{code}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_current_state() -> None:
    relative = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
    data = load_json(relative)
    data["baseline_main_commit"] = BASELINE
    data["status"] = "S2_CONTRACTS_MATH_CANDIDATE"
    data["reconciliation_effective"] = False
    state = data["current_state"]
    state.update({
        "active_delivery_slice_id": S2,
        "s2": "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE",
        "s2_authorized": True,
        "s2_implementation_started": True,
        "calibration_contract_math_candidate_implemented": True,
        "calibration_contract_math_implemented": False,
        "candidate_runtime_implemented": False,
        "shadow_evaluation_runtime_implemented": False,
    })
    data["preserved_nonclaims"] = [
        "NO_CALIBRATION_CANDIDATE_APPEND",
        "NO_SHADOW_EVALUATION_APPEND",
        "NO_D_TRANSACTION_PERSISTENCE",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_PUBLIC_ROUTE",
        "NO_WEB",
        "NO_SCHEDULER",
        "NO_S3_AUTHORIZATION",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    data.pop("candidate_proof", None)
    data.pop("merged_main_effectiveness", None)
    data["s2_candidate_validation"] = {
        "materialization_workflow_run": 29499601843,
        "materializer_job_id": 87631836630,
        "runtime_acceptance": "PASS",
        "governance_prevalidation": "PASS_BEFORE_PHASE_GATE_HARDENING",
        "repository_typecheck": "PASS",
        "repository_build": "PASS",
        "exact_head_ci_status": "PENDING",
        "exact_permanent_changed_file_count": len(EXPECTED_FILES),
    }
    write_json(relative, data)


def patch_matrix() -> None:
    relative = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    data = load_json(relative)
    data["baseline"] = {
        "branch": "main",
        "commit": BASELINE,
        "meaning": (
            "MCFT-CAP-06 corrected S1 merged-main effective; "
            "S2 contracts/math candidate implemented but not effective; "
            "S3+ and MCFT-CAP-07 blocked"
        ),
    }
    lines = data.get("capability_lines") or data.get("capabilities")
    line = next(item for item in lines if item["capability_line_id"] == "MCFT-CAP-06")
    line["implementation_status"] = "S2_CONTRACTS_MATH_CANDIDATE"
    line["active_delivery_slice_id"] = S2
    line["next_delivery_slice_id"] = S2
    line["next_delivery_slice_authorized"] = True
    line["preserved_nonclaims"] = [
        "NO_MIGRATION",
        "NO_CALIBRATION_CANDIDATE_APPEND",
        "NO_SHADOW_EVALUATION_APPEND",
        "NO_D_TRANSACTION_PERSISTENCE",
        "NO_MODEL_ACTIVATION",
        "NO_ACTIVE_CONFIG_SWITCH",
        "NO_STATE_OR_CHECKPOINT_MUTATION",
        "NO_PUBLIC_ROUTE_OR_WEB_OR_SCHEDULER",
        "NO_S3_AUTHORIZATION",
        "NO_MCFT_CAP_07_AUTHORIZATION",
    ]
    line["next_authorized_slice_ids"] = []
    line["candidate_runtime_implemented"] = False
    line["shadow_evaluation_runtime_implemented"] = False
    line["calibration_contract_math_candidate_implemented"] = True
    line["calibration_contract_math_implemented"] = False
    s2 = next(item for item in line["delivery_slices"] if item["delivery_slice_id"] == S2)
    s2.update({
        "status": "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE",
        "implementation_started": True,
        "effectiveness_condition_satisfied": False,
        "runtime_source_authorized": True,
        "migration_authorized": False,
        "canonical_write_authorized": False,
    })
    data["latest_governance_update"] = "MCFT-CAP-06.S2.CONTRACTS-MATH-CANDIDATE-V1"
    write_json(relative, data)


def patch_s2_status() -> None:
    relative = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json"
    data = load_json(relative)
    data["candidate_tree_validation"]["exact_changed_file_count"] = len(EXPECTED_FILES)
    data["exact_changed_file_boundary"] = EXPECTED_FILES
    write_json(relative, data)


def patch_s1_gate() -> None:
    path = ROOT / S1_GATE
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "// Purpose: fail closed unless the additive S1 controlled-data erratum, regenerated runtime outputs and current SSOT agree exactly while S2 remains unauthorized.",
        "// Purpose: fail closed unless corrected S1 evidence remains exact while S2 is either authorized-not-started or candidate-implemented-not-effective, with S3 blocked.",
        "S1_GATE_PURPOSE_ANCHOR",
    )
    text = replace_once(
        text,
        f"const S2 = '{S2}';\n",
        f"const S2 = '{S2}';\nconst S3 = '{S3}';\n",
        "S1_GATE_S3_CONSTANT_ANCHOR",
    )
    start = text.index("  assert.equal(delivery.active_delivery_slice_id, S2);")
    end = text.index("  const runner = readText('scripts/acceptance/run_acceptance.cjs');", start)
    replacement = """  const s2CandidatePhase = delivery.candidate_slices.length === 1
    && delivery.candidate_slices[0] === S2;

  assert.equal(delivery.active_delivery_slice_id, S2);
  assert.equal(delivery.blocked_slices.includes(S2), false);
  assert.equal(delivery.blocked_slices.includes(S3), true);
  assert.equal(delivery.s1_effective, true);
  assert.equal(delivery.s1_successor_readiness_effective, true);
  assert.equal(delivery.s2_authorized, true);

  assert.equal(current.current_state.active_delivery_slice_id, S2);
  assert.equal(current.current_state.s1, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(current.current_state.controlled_residual_window_effective, true);
  assert.equal(current.current_state.s1_successor_readiness_effective, true);
  assert.equal(current.current_state.s2_authorized, true);
  assert.equal(current.current_state.calibration_contract_math_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S2);
  assert.equal(line.controlled_residual_window_effective, true);
  assert.equal(line.s1_successor_readiness_effective, true);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.calibration_contract_math_implemented, false);
  const matrixS1 = line.delivery_slices.find((item) => item.delivery_slice_id === S1);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS1.status, 'MERGED_EFFECTIVE_CORRECTED');
  assert.equal(matrixS1.effectiveness_condition_satisfied, true);

  if (s2CandidatePhase) {
    assert.deepEqual(delivery.authorized_not_started_slices, []);
    assert.equal(delivery.s2_implementation_started, true);
    assert.equal(delivery.s2_candidate_implemented, true);
    assert.equal(delivery.s2_effective, false);
    assert.equal(delivery.s3_authorized, false);

    assert.equal(current.status, 'S2_CONTRACTS_MATH_CANDIDATE');
    assert.equal(current.reconciliation_effective, false);
    assert.equal(current.current_state.s2, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(current.current_state.s2_implementation_started, true);
    assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);

    assert.deepEqual(line.next_authorized_slice_ids, []);
    assert.equal(line.calibration_contract_math_candidate_implemented, true);
    assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(matrixS2.implementation_started, true);
    assert.equal(matrixS2.effectiveness_condition_satisfied, false);
  } else {
    assert.deepEqual(delivery.candidate_slices, []);
    assert.deepEqual(delivery.authorized_not_started_slices, [S2]);
    assert.equal(delivery.s2_implementation_started, false);

    assert.equal(current.status, 'MERGED_EFFECTIVE');
    assert.equal(current.reconciliation_effective, true);
    assert.equal(current.current_state.s2, 'AUTHORIZED_NOT_STARTED');
    assert.equal(current.current_state.s2_implementation_started, false);

    assert.deepEqual(line.next_authorized_slice_ids, [S2]);
    assert.equal(matrixS2.status, 'AUTHORIZED_NOT_STARTED');
    assert.equal(matrixS2.implementation_started, false);
  }

"""
    text = text[:start] + replacement + text[end:]
    text = replace_once(
        text,
        "  console.log('PASS corrected S1 effectiveness preserves prior mechanical proof and authorizes S2 only');",
        "  console.log('PASS corrected S1 effectiveness remains exact across bounded S2 authorization and candidate phases');",
        "S1_GATE_LOG_ANCHOR",
    )
    path.write_text(text, encoding="utf-8", newline="\n")


def patch_s2_gate() -> None:
    path = ROOT / S2_GATE
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '  "scripts/acceptance/run_acceptance.cjs",\n  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs",',
        f'  "scripts/acceptance/run_acceptance.cjs",\n  "{S1_GATE}",\n  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs",',
        "S2_GATE_BOUNDARY_ANCHOR",
    )
    text = replace_once(
        text,
        "  '.github/workflows/mcft-cap-06-s2-corrected-finalizer.yml'\n];",
        "  '.github/workflows/mcft-cap-06-s2-corrected-finalizer.yml',\n"
        "  '.github/scripts/mcft_cap06_s2_governance_finalizer.py',\n"
        "  '.github/workflows/mcft-cap-06-s2-governance-finalizer.yml'\n];",
        "S2_GATE_TEMPORARY_PATHS_ANCHOR",
    )
    text = replace_once(
        text,
        "  const candidateTreeText = EXPECTED_FILES.map((relative) => readText(relative)).join('\\n');",
        "  const candidateTreeText = EXPECTED_FILES\n"
        "    .filter((relative) => relative !== 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs')\n"
        "    .map((relative) => readText(relative))\n"
        "    .join('\\n');",
        "S2_GATE_SELF_SCAN_ANCHOR",
    )
    text = replace_once(
        text,
        "  assert.equal(status.candidate_tree_validation.exact_changed_file_count, 17);",
        f"  assert.equal(status.candidate_tree_validation.exact_changed_file_count, {len(EXPECTED_FILES)});",
        "S2_GATE_COUNT_ANCHOR",
    )
    matrix_anchor = "  assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');\n"
    matrix_extra = matrix_anchor + (
        "  assert.equal(line.implementation_status, 'S2_CONTRACTS_MATH_CANDIDATE');\n"
        "  assert.equal(line.preserved_nonclaims.includes('NO_S2_IMPLEMENTATION'), false);\n"
        "  assert.equal(matrix.latest_governance_update, 'MCFT-CAP-06.S2.CONTRACTS-MATH-CANDIDATE-V1');\n"
        "  assert.equal(current.baseline_main_commit, '9eff45605dc709a6001e6c1bed29fd1df76197ed');\n"
        "  assert.equal(current.preserved_nonclaims.includes('NO_S2_IMPLEMENTATION'), false);\n"
        "  assert.equal(Object.hasOwn(current, 'candidate_proof'), false);\n"
        "  assert.equal(Object.hasOwn(current, 'merged_main_effectiveness'), false);\n"
        f"  assert.equal(current.s2_candidate_validation.exact_permanent_changed_file_count, {len(EXPECTED_FILES)});\n"
    )
    text = replace_once(text, matrix_anchor, matrix_extra, "S2_GATE_SSOT_HARDENING_ANCHOR")
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    patch_current_state()
    patch_matrix()
    patch_s2_status()
    patch_s1_gate()
    patch_s2_gate()

    for relative in (
        "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
        "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
        "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json",
    ):
        json.loads((ROOT / relative).read_text(encoding="utf-8"))
    print("MCFT-CAP-06 S2 governance phase correction: MATERIALIZED")


if __name__ == "__main__":
    main()
