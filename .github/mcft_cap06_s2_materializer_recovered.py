from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
OLD_S2 = "f173186f8cd2940bd7082042d0d053e5a874f7c0"
S2 = "MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1"
S3 = "MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1"
WINDOW_SEMANTICS = "ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1"
HOLDOUT_PURPOSE = "HIGH_EXCESS_STRESS_HOLDOUT_ONLY"
HOLDOUT_GENERALIZATION = "NOT_ESTABLISHED"
S1_RESIDUAL_SET_HASH = "sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60"
S1_CASE_INPUT_SET_HASH = "sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3"
S1_CALIBRATION_WINDOW_HASH = "sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d"
S1_HOLDOUT_WINDOW_HASH = "sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a"
OBJECTIVE_EPSILON = "1000000"
MARGIN_EPSILON = "1000000"

SOURCE_FILES = [
    "apps/server/src/domain/calibration/contracts_v1.ts",
    "apps/server/src/domain/calibration/fixed_point_metric_v1.ts",
    "apps/server/src/domain/calibration/exact_ref_port_v1.ts",
    "apps/server/src/domain/calibration/case_builder_v1.ts",
    "apps/server/src/domain/calibration/grid_search_v1.ts",
    "apps/server/src/domain/calibration/shadow_evaluation_v1.ts",
    "apps/server/src/domain/calibration/envelope_profiles_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts",
]

PERMANENT_FILES = sorted([
    *SOURCE_FILES,
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs",
    "scripts/acceptance/run_acceptance.cjs",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
    "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
    "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
    "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
])


def path(relative: str) -> Path:
    return ROOT / relative


def read(relative: str) -> str:
    return path(relative).read_text(encoding="utf-8")


def write(relative: str, content: str) -> None:
    target = path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + "\n", encoding="utf-8")


def read_json(relative: str):
    return json.loads(read(relative))


def write_json(relative: str, value) -> None:
    write(relative, json.dumps(value, indent=2, ensure_ascii=False))


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_contracts() -> None:
    p = "apps/server/src/domain/calibration/contracts_v1.ts"
    text = read(p)
    anchor = 'export const CAP06_MAX_RESIDUAL_ADDITIVE_TOLERANCE_VWC_V1 = "0.000001000" as const;\n'
    addition = anchor + f'''export const CAP06_WINDOW_HASH_SEMANTICS_V1 = "{WINDOW_SEMANTICS}" as const;\nexport const CAP06_HOLDOUT_PURPOSE_V1 = "{HOLDOUT_PURPOSE}" as const;\nexport const CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1 = "{HOLDOUT_GENERALIZATION}" as const;\n\nexport type Cap06SourceDatasetIdentityV1 = {{\n  residual_set_hash: string;\n  case_id0ut_set_hash: string;\n  calibration_window_hash: string;\n  holdout_window_hash: string;\n  window_hash_semantics: typeof CAP06_WINDOW_HASH_SEMANTICS_V1;\n  holdout_purpose: typeof CAP06_HOLDOUT_PURPOSE_V1;\n  holdout_generalization_claim: typeof CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1;\n}};\n'''
    text = replace_once(text, anchor, addition, "contracts identity constants")

    old = '''  evaluation_disposition: Cap06ShadowDispositionV1;\n  reason_codes: Cap06ShadowReasonCodeV1[];\n  eligible_for_human_activation_review: boolean;'''
    new = '''  evaluation_disposition: Cap06ShadowDispositionV1;\n  reason_codes: Cap06ShadowReasonCodeV1[];\n  source_s1_residual_set_hash: string;\n  source_s1_case_id0ut_set_hash: string;\n  holdout_window_ref_membership_hash: string;\n  window_hash_semantics: typeof CAP06_WINDOW_HASH_SEMANTICS_V1;\n  holdout_purpose: typeof CAP06_HOLDOUT_PURPOSE_V1;\n  holdout_generalization_claim: typeof CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1;\n  eligible_for_human_activation_review: boolean;'''
    text = replace_once(text, old, new, "shadow identity fields")
    write(p, text)


def patch_case_builder() -> None:
    p = "apps/server/src/domain/calibration/case_builder_v1.ts"
    text = read(p)
    old = '''  CAP06_HOLDOUT_CASE_COUNT_V1,\n  type Cap06CalibrationCaseSourceV1,'''
    new = '''  CAP06_HOLDOUT_CASE_COUNT_V1,\n  CAP06_WINDOW_HASH_SEMANTICS_V1,\n  type Cap06SourceDatasetIdentityV1,\n  type Cap06CalibrationCaseSourceV1,'''
    text = replace_once(text, old, new, "case builder imports")

    old = '''  case_id0ut_set_hash: string;\n  determinism_hash: string;\n};'''
    new = '''  case_id0ut_set_hash: string;\n  window_ref_membership_hash: string;\n  window_residual_set_hash: string;\n  source_s1_residual_set_hash: string;\n  source_s1_case_id0ut_set_hash: string;\n  source_s1_calibration_window_hash: string;\n  source_s1_holdout_window_hash: string;\n  window_hash_semantics: typeof CAP06_WINDOW_HASH_SEMANTICS_V1;\n  holdout_purpose: Cap06SourceDatasetIdentityV1["holdout_purpose"];\n  holdout_generalization_claim: Cap06SourceDatasetIdentityV1["holdout_generalization_claim"];\n  determinism_hash: string;\n};'''
    text = replace_once(text, old, new, "built window identity fields")

    old = '''  minimum_holdout_availability: string;\n  determinism_hash: string;\n};'''
    new = '''  minimum_holdout_availability: string;\n  source_s1_residual_set_hash: string;\n  source_s1_case_id0ut_set_hash: string;\n  calibration_window_ref_membership_hash: string;\n  holdout_window_ref_membership_hash: string;\n  window_hash_semantics: typeof CAP06_WINDOW_HASH_SEMANTICS_V1;\n  holdout_purpose: Cap06SourceDatasetIdentityV1["holdout_purpose"];\n  holdout_generalization_claim: Cap06SourceDatasetIdentityV1["holdout_generalization_claim"];\n  determinism_hash: string;\n};'''
    text = replace_once(text, old, new, "built windows identity fields")

    old = '''export function buildCap06CaseWindowV1(id0ut: {\n  role: Cap06CaseWindowRoleV1;\n  orderedResidualRefs: readonly string[];\n  loadedCases: readonly Cap06CaseBuilderSourceV1[];\n}): Cap06BuiltCaseWindowV1 {'''
    new = '''export function buildCap06CaseWindowV1(id0ut: {\n  role: Cap06CaseWindowRoleV1;\n  orderedResidualRefs: readonly string[];\n  loadedCases: readonly Cap06CaseBuilderSourceV1[];\n  sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;\n}): Cap06BuiltCaseWindowV1 {\n  if (id0ut.sourceDatasetIdentity.window_hash_semantics !== CAP06_WINDOW_HASH_SEMANTICS_V1) {\n    throw new Error("CAP06_WINDOW_HASH_SEMANTICS_MISMATCH");\n  }'''
    text = replace_once(text, old, new, "case window id0ut identity")

    old = '''  const caseId0utSetHash = semanticHashV1(cases.map((item) => ({\n    residual_ref: item.residual_ref,\n    residual_hash: item.residual_hash,\n    case_id0ut_hash: item.case_id0ut_hash,\n    forecast_point_ref: item.source_forecast_point_ref,\n    forecast_point_hash: item.source_forecast_point_hash,\n    observation_ref: item.actual_observation_ref,\n    observation_hash: item.actual_observation_hash,\n  })));\n  const semantic = {'''
    new = '''  const caseId0utSetHash = semanticHashV1(cases.map((item) => ({\n    residual_ref: item.residual_ref,\n    residual_hash: item.residual_hash,\n    case_id0ut_hash: item.case_id0ut_hash,\n    forecast_point_ref: item.source_forecast_point_ref,\n    forecast_point_hash: item.source_forecast_point_hash,\n    observation_ref: item.actual_observation_ref,\n    observation_hash: item.actual_observation_hash,\n  })));\n  const windowRefMembershipHash = semanticHashV1(cases.map((item) => item.residual_ref));\n  const expectedWindowHash = id0ut.role === "CALIBRATION"\n    ? id0ut.sourceDatasetIdentity.calibration_window_hash\n    : id0ut.sourceDatasetIdentity.holdout_window_hash;\n  if (windowRefMembershipHash !== expectedWindowHash) {\n    throw new Error(`CAP06_${id0ut.role}_WINDOW_REF_MEMBERSHIP_HASH_MISMATCH`);\n  }\n  const windowResidualSetHash = semanticHashV1(cases.map((item) => ({\n    ref: item.residual_ref,\n    hash: item.residual_hash,\n  })));\n  const semantic = {'''
    text = replace_once(text, old, new, "case window identity calculation")

    old = '''    as_of: asOf,\n    case_id0ut_set_hash: caseId0utSetHash,\n  };'''
    new = '''    as_of: asOf,\n    case_id0ut_set_hash: caseId0utSetHash,\n    window_ref_membership_hash: windowRefMembershipHash,\n    window_residual_set_hash: windowResidualSetHash,\n    source_s1_residual_set_hash: id0ut.sourceDatasetIdentity.residual_set_hash,\n    source_s1_case_id0ut_set_hash: id0ut.sourceDatasetIdentity.case_id0ut_set_hash,\n    source_s1_calibration_window_hash: id0ut.sourceDatasetIdentity.calibration_window_hash,\n    source_s1_holdout_window_hash: id0ut.sourceDatasetIdentity.holdout_window_hash,\n    window_hash_semantics: id0ut.sourceDatasetIdentity.window_hash_semantics,\n    holdout_purpose: id0ut.sourceDatasetIdentity.holdout_purpose,\n    holdout_generalization_claim: id0ut.sourceDatasetIdentity.holdout_generalization_claim,\n  };'''
    text = replace_once(text, old, new, "case window identity semantic")

    old = '''export function buildCap06CaseWindowsV1(id0ut: {\n  calibration: Cap06BuiltCaseWindowV1;\n  holdout: Cap06BuiltCaseWindowV1;\n}): Cap06BuiltCaseWindowsV1 {'''
    new = '''export function buildCap06CaseWindowsV1(id0ut: {\n  calibration: Cap06BuiltCaseWindowV1;\n  holdout: Cap06BuiltCaseWindowV1;\n}): Cap06BuiltCaseWindowsV1 {'''
    # signature idtentionally unchanged; keep exact anchor as validation
    if text.count(old) != 1:
        raise RuntimeError(f"case windows signature: expected 1 occurrence, found {text.count(old)}")

    old = '''  const calibrationRefs = new Set(id0ut.calibration.ordered_residual_refs);'''
    new = '''  for (const key of [\n    "source_s1_residual_set_hash",\n    "source_s1_case_id0ut_set_hash",\n    "source_s1_calibration_window_hash",\n    "source_s1_holdout_window_hash",\n    "window_hash_semantics",\n    "holdout_purpose",\n    "holdout_generalization_claim",\n  ] as const) {\n    if (id0ut.calibration[key] !== id0ut.holdout[key]) {\n      throw new Error(`CAP06_CALIBRATION_HOLDOUT_SOURCE_IDENTITY_MISMATCH:${key}`);\n    }\n  }\n  const combinedCases = [...id0ut.calibration.cases, ...id0ut.holdout.cases];\n  const fullResidualSetHash = semanticHashV1(combinedCases.map((item) => ({\n    ref: item.residual_ref,\n    hash: item.residual_hash,\n  })));\n  if (fullResidualSetHash !== id0ut.calibration.source_s1_residual_set_hash) {\n    throw new Error("CAP06_SOURCE_S1_RESIDUAL_SET_HASH_MISMATCH");\n  }\n  const fullCaseId0utSetHash = semanticHashV1(combinedCases.map((item) => ({\n    residual_ref: item.residual_ref,\n    residual_hash: item.residual_hash,\n    forecast_point_ref: item.source_forecast_point_ref,\n    forecast_point_hash: item.source_forecast_point_hash,\n    observation_ref: item.actual_observation_ref,\n    observation_hash: item.actual_observation_hash,\n  })));\n  if (fullCaseId0utSetHash !== id0ut.calibration.source_s1_case_id0ut_set_hash) {\n    throw new Error("CAP06_SOURCE_S1_CASE_INPUT_SET_HASH_MISMATCH");\n  }\n  const calibrationRefs = new Set(id0ut.calibration.ordered_residual_refs);'''
    text = replace_once(text, old, new, "full S1 identity verification")

    old = '''    candidate_as_of: id0ut.calibration.as_of,\n    minimum_holdout_availability: minimumHoldoutAvailability,\n  };'''
    new = '''    candidate_as_of: id0ut.calibration.as_of,\n    minimum_holdout_availability: minimumHoldoutAvailability,\n    source_s1_residual_set_hash: fullResidualSetHash,\n    source_s1_case_id0ut_set_hash: fullCaseId0utSetHash,\n    calibration_window_ref_membership_hash: id0ut.calibration.window_ref_membership_hash,\n    holdout_window_ref_membership_hash: id0ut.holdout.window_ref_membership_hash,\n    window_hash_semantics: id0ut.calibration.window_hash_semantics,\n    holdout_purpose: id0ut.calibration.holdout_purpose,\n    holdout_generalization_claim: id0ut.calibration.holdout_generalization_claim,\n  };'''
    text = replace_once(text, old, new, "case windows source identity semantic")
    write(p, text)


def patch_grid_search() -> None:
    p = "apps/server/src/domain/calibration/grid_search_v1.ts"
    text = read(p)
    text = replace_once(
        text,
        "export const CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1 = 1n as const;\nexport const CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1 = 1n as const;",
        "export const CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1 = 1_000_000n as const;\nexport const CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1 = 1_000_000n as const;",
        "grid-search exact thresholds",
    )
    write(p, text)


def patch_shadow() -> None:
    p = "apps/server/src/domain/calibration/shadow_evaluation_v1.ts"
    text = read(p)
    old = '''    evaluation_disposition: disposition,\n    reason_codes: orderedReasonsV1(reasons),\n    eligible_for_human_activation_review: disposition === "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW",'''
    new = '''    evaluation_disposition: disposition,\n    reason_codes: orderedReasonsV1(reasons),\n    source_s1_residual_set_hash: id0ut.holdoutWindow.source_s1_residual_set_hash,\n    source_s1_case_id0ut_set_hash: id0ut.holdoutWindow.source_s1_case_id0ut_set_hash,\n    holdout_window_ref_membership_hash: id0ut.holdoutWindow.window_ref_membership_hash,\n    window_hash_semantics: id0ut.holdoutWindow.window_hash_semantics,\n    holdout_purpose: id0ut.holdoutWindow.holdout_purpose,\n    holdout_generalization_claim: id0ut.holdoutWindow.holdout_generalization_claim,\n    eligible_for_human_activation_review: disposition === "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW",'''
    text = replace_once(text, old, new, "shadow source identity")
    write(p, text)


def patch_envelopes() -> None:
    p = "apps/server/src/domain/calibration/envelope_profiles_v1.ts"
    text = read(p)
    old = '''      residual_refs: [...id0ut.calibrationWindow.ordered_residual_refs],\n      residual_set_hash: semanticHashV1(\n        id0ut.calibrationWindow.ordered_residual_refs.map((ref, index) => ({\n          ref,\n          hash: id0ut.calibrationWindow.ordered_residual_hashes[index],\n        })),\n      ),\n      base_config_ref: id0ut.calibrationWindow.base_config_ref,'''
    new = '''      residual_refs: [...id0ut.calibrationWindow.ordered_residual_refs],\n      residual_set_hash: id0ut.calibrationWindow.window_residual_set_hash,\n      residual_set_hash_scope: "CALIBRATION_WINDOW_ONLY",\n      calibration_residual_set_hash: id0ut.calibrationWindow.window_residual_set_hash,\n      calibration_window_ref_membership_hash: id0ut.calibrationWindow.window_ref_membership_hash,\n      source_s1_residual_set_hash: id0ut.calibrationWindow.source_s1_residual_set_hash,\n      source_s1_case_id0ut_set_hash: id0ut.calibrationWindow.source_s1_case_id0ut_set_hash,\n      source_s1_calibration_window_hash: id0ut.calibrationWindow.source_s1_calibration_window_hash,\n      source_s1_holdout_window_hash: id0ut.calibrationWindow.source_s1_holdout_window_hash,\n      window_hash_semantics: id0ut.calibrationWindow.window_hash_semantics,\n      base_config_ref: id0ut.calibrationWindow.base_config_ref,'''
    text = replace_once(text, old, new, "candidate dataset identity")

    old = '''      evaluation_dataset_refs: [...id0ut.holdoutWindow.ordered_residual_refs],\n      evaluation_dataset_hash: id0ut.holdoutWindow.case_id0ut_set_hash,\n      base_config_ref: id0ut.candidate.runtime_config_ref,'''
    new = '''      evaluation_dataset_refs: [...id0ut.holdoutWindow.ordered_residual_refs],\n      evaluation_dataset_hash: id0ut.holdoutWindow.case_id0ut_set_hash,\n      evaluation_dataset_hash_scope: "HOLDOUT_CASE_INPUT_SET",\n      holdout_residual_set_hash: id0ut.holdoutWindow.window_residual_set_hash,\n      holdout_window_ref_membership_hash: id0ut.holdoutWindow.window_ref_membership_hash,\n      source_s1_residual_set_hash: id0ut.holdoutWindow.source_s1_residual_set_hash,\n      source_s1_case_id0ut_set_hash: id0ut.holdoutWindow.source_s1_case_id0ut_set_hash,\n      window_hash_semantics: id0ut.holdoutWindow.window_hash_semantics,\n      holdout_purpose: id0ut.holdoutWindow.holdout_purpose,\n      holdout_generalization_claim: id0ut.holdoutWindow.holdout_generalization_claim,\n      base_config_ref: id0ut.candidate.runtime_config_ref,'''
    text = replace_once(text, old, new, "evaluation dataset identity")
    write(p, text)


def patch_acceptance() -> None:
    p = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts"
    text = read(p)
    text = replace_once(
        text,
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport path from "node:path";\n',
        "acceptance fs imports",
    )
    old = '''  CAP06_HOLDOUT_CASE_COUNT_V1,\n  type Cap06CalibrationCaseSourceV1,'''
    new = '''  CAP06_HOLDOUT_CASE_COUNT_V1,\n  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,\n  CAP06_HOLDOUT_PURPOSE_V1,\n  CAP06_WINDOW_HASH_SEMANTICS_V1,\n  type Cap06SourceDatasetIdentityV1,\n  type Cap06CalibrationCaseSourceV1,'''
    text = replace_once(text, old, new, "acceptance contract imports")
    old = '''  buildCap06ParameterGridV1,\n  runCap06CalibrationGridSearchV1,\n} from "../../apps/server/src/domain/calibration/grid_search_v1.js";'''
    new = '''  CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1,\n  CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1,\n  buildCap06ParameterGridV1,\n  runCap06CalibrationGridSearchV1,\n} from "../../apps/server/src/domain/calibration/grid_search_v1.js";'''
    text = replace_once(text, old, new, "acceptance grid imports")

    old = '''function fixed6V1(value: unknown, code: string): string {\n  const number = Number(value);\n  if (!Number.isFinite(number)) throw new Error(code);\n  return number.toFixed(6);\n}'''
    new = '''function fixed6V1(value: unknown, code: string): string {\n  return formatFixedDecimalV1(parseFixedDecimalV1(value, 6, code), 6);\n}'''
    text = replace_once(text, old, new, "fixed-point config authority")

    insert_anchor = '''function cloneAsNoOpV1(source: Cap06CaseBuilderSourceV1): Cap06CaseBuilderSourceV1 {'''
    helper = '''function sourceDatasetIdentityV1(\n  sources: readonly Cap06CaseBuilderSourceV1[],\n  calibrationRefs: readonly string[],\n  holdoutRefs: readonly string[],\n): Cap06SourceDatasetIdentityV1 {\n  return {\n    residual_set_hash: semanticHashV1(sources.map((item) => ({\n      ref: item.residual_ref,\n      hash: item.residual_hash,\n    }))),\n    case_id0ut_set_hash: semanticHashV1(sources.map((item) => ({\n      residual_ref: item.residual_ref,\n      residual_hash: item.residual_hash,\n      forecast_point_ref: item.source_forecast_point_ref,\n      forecast_point_hash: item.source_forecast_point_hash,\n      observation_ref: item.actual_observation_ref,\n      observation_hash: item.actual_observation_hash,\n    }))),\n    calibration_window_hash: semanticHashV1(calibrationRefs),\n    holdout_window_hash: semanticHashV1(holdoutRefs),\n    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,\n    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,\n    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,\n  };\n}\n\n'''
    text = replace_once(text, insert_anchor, helper + insert_anchor, "source identity helper")

    old = '''  const calibrationLoaded = await loader.loadExactCalibrationResiduals(controlled.calibration_window_refs);\n  const holdoutLoaded = await loader.loadExactCalibrationResiduals(controlled.holdout_window_refs);'''
    new = '''  assert.equal(controlled.residual_set_hash, "''' + S1_RESIDUAL_SET_HASH + '''");\n  assert.equal(controlled.case_id0ut_set_hash, "''' + S1_CASE_INPUT_SET_HASH + '''");\n  assert.equal(controlled.calibration_window_hash, "''' + S1_CALIBRATION_WINDOW_HASH + '''");\n  assert.equal(controlled.holdout_window_hash, "''' + S1_HOLDOUT_WINDOW_HASH + '''");\n  const controlledIdentity: Cap06SourceDatasetIdentityV1 = {\n    residual_set_hash: controlled.residual_set_hash,\n    case_id0ut_set_hash: controlled.case_id0ut_set_hash,\n    calibration_window_hash: controlled.calibration_window_hash,\n    holdout_window_hash: controlled.holdout_window_hash,\n    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,\n    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,\n    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,\n  };\n\n  const calibrationLoaded = await loader.loadExactCalibrationResiduals(controlled.calibration_window_refs);\n  const holdoutLoaded = await loader.loadExactCalibrationResiduals(controlled.holdout_window_refs);'''
    text = replace_once(text, old, new, "controlled identity pin")

    text = replace_once(
        text,
        '''    orderedResidualRefs: controlled.calibration_window_refs,\n    loadedCases: calibrationLoaded as Cap06CaseBuilderSourceV1[],\n  });''',
        '''    orderedResidualRefs: controlled.calibration_window_refs,\n    loadedCases: calibrationLoaded as Cap06CaseBuilderSourceV1[],\n    sourceDatasetIdentity: controlledIdentity,\n  });''',
        "calibration identity id0ut",
    )
    text = replace_once(
        text,
        '''    orderedResidualRefs: controlled.holdout_window_refs,\n    loadedCases: holdoutLoaded as Cap06CaseBuilderSourceV1[],\n  });''',
        '''    orderedResidualRefs: controlled.holdout_window_refs,\n    loadedCases: holdoutLoaded as Cap06CaseBuilderSourceV1[],\n    sourceDatasetIdentity: controlledIdentity,\n  });''',
        "holdout identity id0ut",
    )

    old = '''  assert.equal(windows.calibration.as_of < windows.minimum_holdout_availability, true);\n\n  const grid = buildCap06ParameterGridV1();'''
    new = '''  assert.equal(windows.calibration.as_of < windows.minimum_holdout_availability, true);\n  assert.equal(windows.source_s1_residual_set_hash, controlled.residual_set_hash);\n  assert.equal(windows.source_s1_case_id0ut_set_hash, controlled.case_id0ut_set_hash);\n  assert.equal(windows.calibration_window_ref_membership_hash, controlled.calibration_window_hash);\n  assert.equal(windows.holdout_window_ref_membership_hash, controlled.holdout_window_hash);\n  assert.equal(windows.window_hash_semantics, CAP06_WINDOW_HASH_SEMANTICS_V1);\n  assert.equal(windows.holdout_purpose, CAP06_HOLDOUT_PURPOSE_V1);\n  assert.equal(windows.holdout_generalization_claim, CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1);\n\n  const grid = buildCap06ParameterGridV1();'''
    text = replace_once(text, old, new, "window identity assertions")

    old = '''  assert.equal(grid[20], "0.040000");\n\n  const realPort = realPredictionPortV1(runtimeByResidual);'''
    new = '''  assert.equal(grid[20], "0.040000");\n  assert.equal(CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1, 1_000_000n);\n  assert.equal(CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1, 1_000_000n);\n\n  const realPort = realPredictionPortV1(runtimeByResidual);'''
    text = replace_once(text, old, new, "threshold assertions")

    old = '''  assert.equal(candidateDraft.payload.eligible_for_runtime_config_use, false);'''
    new = '''  assert.equal(candidateDraft.payload.eligible_for_runtime_config_use, false);\n  assert.equal(candidateDraft.payload.residual_set_hash_scope, "CALIBRATION_WINDOW_ONLY");\n  assert.equal(candidateDraft.payload.source_s1_residual_set_hash, controlled.residual_set_hash);\n  assert.equal(candidateDraft.payload.source_s1_case_id0ut_set_hash, controlled.case_id0ut_set_hash);\n  assert.equal(candidateDraft.payload.calibration_window_ref_membership_hash, controlled.calibration_window_hash);\n  assert.equal(candidateDraft.payload.window_hash_semantics, CAP06_WINDOW_HASH_SEMANTICS_V1);'''
    text = replace_once(text, old, new, "candidate identity assertions")

    old = '''  assert.equal(evaluationDraft.payload.active_config_switch_performed, false);'''
    new = '''  assert.equal(evaluationDraft.payload.active_config_switch_performed, false);\n  assert.equal(evaluationDraft.payload.source_s1_residual_set_hash, controlled.residual_set_hash);\n  assert.equal(evaluationDraft.payload.source_s1_case_id0ut_set_hash, controlled.case_id0ut_set_hash);\n  assert.equal(evaluationDraft.payload.holdout_window_ref_membership_hash, controlled.holdout_window_hash);\n  assert.equal(evaluationDraft.payload.holdout_purpose, CAP06_HOLDOUT_PURPOSE_V1);\n  assert.equal(evaluationDraft.payload.holdout_generalization_claim, CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1);'''
    text = replace_once(text, old, new, "evaluation identity assertions")

    old = '''  const noOpCalibration = buildCap06CaseWindowV1({\n    role: "CALIBRATION",\n    orderedResidualRefs: noOpCalibrationRefs,\n    loadedCases: noOpSources.slice(0, 16),\n  });\n  const noOpHoldout = buildCap06CaseWindowV1({\n    role: "HOLDOUT",\n    orderedResidualRefs: noOpHoldoutRefs,\n    loadedCases: noOpSources.slice(16),\n  });'''
    new = '''  const noOpIdentity = sourceDatasetIdentityV1(noOpSources, noOpCalibrationRefs, noOpHoldoutRefs);\n  const noOpCalibration = buildCap06CaseWindowV1({\n    role: "CALIBRATION",\n    orderedResidualRefs: noOpCalibrationRefs,\n    loadedCases: noOpSources.slice(0, 16),\n    sourceDatasetIdentity: noOpIdentity,\n  });\n  const noOpHoldout = buildCap06CaseWindowV1({\n    role: "HOLDOUT",\n    orderedResidualRefs: noOpHoldoutRefs,\n    loadedCases: noOpSources.slice(16),\n    sourceDatasetIdentity: noOpIdentity,\n  });'''
    text = replace_once(text, old, new, "no-op identity")

    # Add identity to negative build calls (two occurrences)
    text = text.replace(
        '''      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 3\n        ? { ...item.source, context_revision_ref: "conflicting_revision" }\n        : item.source),\n    }),''',
        '''      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 3\n        ? { ...item.source, context_revision_ref: "conflicting_revision" }\n        : item.source),\n      sourceDatasetIdentity: controlledIdentity,\n    }),''',
        1,
    )
    text = text.replace(
        '''      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 2\n        ? { ...item.source, observation_available_to_runtime_at: item.source.forecast_as_of }\n        : item.source),\n    }),''',
        '''      loadedCases: runtimeCases.slice(0, 16).map((item, index) => index === 2\n        ? { ...item.source, observation_available_to_runtime_at: item.source.forecast_as_of }\n        : item.source),\n      sourceDatasetIdentity: controlledIdentity,\n    }),''',
        1,
    )

    negative_anchor = '''  await assert.rejects(\n    () => loader.loadExactCalibrationResiduals(['''
    identity_negative = '''  assert.throws(\n    () => buildCap06CaseWindowV1({\n      role: "CALIBRATION",\n      orderedResidualRefs: controlled.calibration_window_refs,\n      loadedCases: runtimeCases.slice(0, 16).map((item) => item.source),\n      sourceDatasetIdentity: {\n        ...controlledIdentity,\n        calibration_window_hash: semanticHashV1(["wrong-window"]),\n      },\n    }),\n    /CAP06_CALIBRATION_WINDOW_REF_MEMBERSHIP_HASH_MISMATCH/,\n  );\n  assert.throws(\n    () => buildCap06CaseWindowsV1({\n      calibration: { ...structuredClone(calibrationWindow), source_s1_residual_set_hash: semanticHashV1(["wrong-set"]) },\n      holdout: { ...structuredClone(holdoutWindow), source_s1_residual_set_hash: semanticHashV1(["wrong-set"]) },\n    }),\n    /CAP06_SOURCE_S1_RESIDUAL_SET_HASH_MISMATCH/,\n  );\n\n'''
    text = replace_once(text, negative_anchor, identity_negative + negative_anchor, "identity negative tests")

    old = '''    grid_count: grid.length,\n    selected_parameter_value: positiveFirst.selected_parameter_value,'''
    new = '''    grid_count: grid.length,\n    source_s1_residual_set_hash: windows.source_s1_residual_set_hash,\n    source_s1_case_id0ut_set_hash: windows.source_s1_case_id0ut_set_hash,\n    calibration_window_ref_membership_hash: windows.calibration_window_ref_membership_hash,\n    holdout_window_ref_membership_hash: windows.holdout_window_ref_membership_hash,\n    window_hash_semantics: windows.window_hash_semantics,\n    holdout_purpose: windows.holdout_purpose,\n    holdout_generalization_claim: windows.holdout_generalization_claim,\n    objective_mse_range_epsilon_sse_scale_18: CAP06_OBJECTIVE_MSE_RANGE_EPSILON_SSE_SCALE_18_V1.toString(),\n    best_second_mse_margin_epsilon_sse_scale_18: CAP06_BEST_SECOND_MSE_MARGIN_EPSILON_SSE_SCALE_18_V1.toString(),\n    objective_mse_range_sse_scale_18: positiveFirst.objective_mse_range_sse_scale_18,\n    best_vs_second_mse_margin_sse_scale_18: positiveFirst.best_vs_second_mse_margin_sse_scale_18,\n    sensitive_case_count: positiveFirst.excitation_summary?.sensitive_case_count ?? 0,\n    represented_sensitive_wetness_regimes: positiveFirst.excitation_summary?.represented_sensitive_wetness_regimes ?? [],\n    selected_parameter_value: positiveFirst.selected_parameter_value,'''
    text = replace_once(text, old, new, "result identity and thresholds")

    old = '''  console.log("PASS S2 Candidate/Evaluation drafts remain non-lineage, inactive and zero-write");\n  console.log(`${S2_RESULT_PREFIX}${JSON.stringify(result)}`);'''
    new = '''  console.log("PASS S2 Candidate/Evaluation drafts remain non-lineage, inactive and zero-write");\n  const out0utDir = path.resolve(process.cwd(), "acceptance-out0ut");\n  fs.mkdirSync(out0utDir, { recursive: true });\n  fs.writeFileSync(\n    path.join(out0utDir, "MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json"),\n    `${JSON.stringify(result, null, 2)}\\n`,\n    "utf8",\n  );\n  console.log(`${S2_RESULT_PREFIX}${JSON.stringify(result)}`);'''
    text = replace_once(text, old, new, "result artifact")
    write(p, text)


def patch_source() -> None:
    patch_contracts()
    patch_case_builder()
    patch_grid_search()
    patch_shadow()
    patch_envelopes()
    patch_acceptance()
    print(json.dumps({"source_patch": "PASS", "files": SOURCE_FILES}, indent=2))


def create_governance_gate(result: dict) -> None:
    expected_files_json = json.dumps(PERMANENT_FILES, indent=2)
    gate = f'''#!/usr/bin/env node\n'use strict';\n\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst ROOT = path.resolve(__dirname, '../..');\nconst S2 = '{S2}';\nconst S3 = '{S3}';\nconst EXPECTED_FILES = {expected_files_json};\nconst readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));\nconst readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');\n\nfunction main() {{\n  const result = readJson('acceptance-out0ut/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');\n  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json');\n  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json');\n  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');\n  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');\n  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');\n  const task = readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');\n  const runner = readText('scripts/acceptance/run_acceptance.cjs');\n  const acceptance = readText('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts');\n  const grid = readText('apps/server/src/domain/calibration/grid_search_v1.ts');\n\n  assert.equal(result.status, 'PASS');\n  assert.equal(result.source_residual_count, 24);\n  assert.equal(result.calibration_case_count, 16);\n  assert.equal(result.holdout_case_count, 8);\n  assert.equal(result.grid_count, 21);\n  assert.equal(result.selected_parameter_value, '0.034000');\n  assert.equal(result.source_s1_residual_set_hash, '{S1_RESIDUAL_SET_HASH}');\n  assert.equal(result.source_s1_case_id0ut_set_hash, '{S1_CASE_INPUT_SET_HASH}');\n  assert.equal(result.calibration_window_ref_membership_hash, '{S1_CALIBRATION_WINDOW_HASH}');\n  assert.equal(result.holdout_window_ref_membership_hash, '{S1_HOLDOUT_WINDOW_HASH}');\n  assert.equal(result.window_hash_semantics, '{WINDOW_SEMANTICS}');\n  assert.equal(result.holdout_purpose, '{HOLDOUT_PURPOSE}');\n  assert.equal(result.holdout_generalization_claim, '{HOLDOUT_GENERALIZATION}');\n  assert.equal(result.objective_mse_range_epsilon_sse_scale_18, '{OBJECTIVE_EPSILON}');\n  assert.equal(result.best_second_mse_margin_epsilon_sse_scale_18, '{MARGIN_EPSILON}');\n  assert.equal(result.sensitive_case_count >= 4, true);\n  assert.equal(result.represented_sensitive_wetness_regimes.length >= 2, true);\n  assert.equal(result.canonical_write_count, 0);\n  assert.equal(result.projection_write_count, 0);\n  assert.equal(result.migration_count, 0);\n  assert.equal(result.model_activation_count, 0);\n\n  assert.equal(contract.status, 'S2_CONTRACTS_MATH_CANDIDATE');\n  assert.equal(contract.canonical_write_count, 0);\n  assert.equal(contract.migration_count, 0);\n  assert.equal(contract.model_activation_count, 0);\n  assert.equal(contract.source_dataset_identity.residual_set_hash, result.source_s1_residual_set_hash);\n  assert.equal(contract.source_dataset_identity.case_id0ut_set_hash, result.source_s1_case_id0ut_set_hash);\n  assert.equal(contract.window_hash_semantics, '{WINDOW_SEMANTICS}');\n  assert.equal(contract.holdout_purpose, '{HOLDOUT_PURPOSE}');\n  assert.equal(contract.holdout_generalization_claim, '{HOLDOUT_GENERALIZATION}');\n\n  assert.equal(status.delivery_slice_id, S2);\n  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');\n  assert.equal(status.s2_effective, false);\n  assert.equal(status.s3_authorized, false);\n  assert.deepEqual(status.exact_changed_file_boundary, EXPECTED_FILES);\n  assert.equal(status.candidate_tree_validation.exact_changed_file_count, 17);\n\n  assert.equal(current.current_state.active_delivery_slice_id, S2);\n  assert.equal(current.current_state.s2, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');\n  assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);\n  assert.equal(current.current_state.calibration_contract_math_implemented, false);\n  assert.equal(current.current_state.candidate_runtime_implemented, false);\n  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);\n\n  assert.equal(delivery.active_delivery_slice_id, S2);\n  assert.deepEqual(delivery.candidate_slices, [S2]);\n  assert.deepEqual(delivery.authorized_not_started_slices, []);\n  assert.equal(delivery.blocked_slices.includes(S3), true);\n  assert.equal(delivery.s2_effective, false);\n  assert.equal(delivery.s3_authorized, false);\n\n  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;\n  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');\n  assert.ok(line);\n  assert.equal(line.active_delivery_slice_id, S2);\n  assert.equal(line.calibration_contract_math_candidate_implemented, true);\n  assert.equal(line.calibration_contract_math_implemented, false);\n  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);\n  assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');\n\n  assert.match(task, /S2_CONTRACTS_MATH_CANDIDATE/);\n  assert.match(task, /NO_CALIBRATION_CANDIDATE_APPEND/);\n  assert.match(task, /NO_SHADOW_EVALUATION_APPEND/);\n  assert.match(runner, /MCFT_CAP_06_S2_CONTRACTS_MATH/);\n  assert.match(runner, /MCFT_CAP_06_S2_CONTRACTS_MATH_GOVERNANCE/);\n  assert.doesNotMatch(acceptance, /Number\\(value\\)/);\n  assert.doesNotMatch(acceptance, /number\\.toFixed/);\n  assert.match(grid, /1_000_000n as const/);\n\n  for (const forbidden of ['twin_calibration_candidate_v1', 'twin_shadow_evaluation_v1', 'twin_model_activation_v1']) {{\n    assert.equal(result[forbidden], undefined);\n  }}\n  console.log('MCFT-CAP-06 S2 contracts/math governance: PASS');\n}}\n\nmain();\n'''
    write("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs", gate)


def patch_acceptance_runner() -> None:
    p = "scripts/acceptance/run_acceptance.cjs"
    text = read(p)
    anchor = '''    {\n      id: 'MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION_GOVERNANCE',\n      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs',\n      logFile: 'MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION_GOVERNANCE.log',\n      notes: 'Cross-checks regenerated S1 runtime and wetness-regime evidence against the additive erratum and current SSOT while S2 remains blocked.'\n    }'''
    replacement = anchor + ''',\n    {\n      id: 'MCFT_CAP_06_S2_CONTRACTS_MATH',\n      command: 'pnpm -w exec tsx scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts',\n      logFile: 'MCFT_CAP_06_S2_CONTRACTS_MATH.log',\n      notes: 'Proves exact-ref-only corrected S1 identity binding, fixed-point 21-point calibration search, paired historical shadow math, deterministic drafts, and zero writes.'\n    },\n    {\n      id: 'MCFT_CAP_06_S2_CONTRACTS_MATH_GOVERNANCE',\n      command: 'node scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs',\n      logFile: 'MCFT_CAP_06_S2_CONTRACTS_MATH_GOVERNANCE.log',\n      notes: 'Cross-checks S2 runtime evidence, frozen numeric policies, exact source dataset identity, zero-write boundary, and S3 blocking.'\n    }'''
    text = replace_once(text, anchor, replacement, "acceptance runner S2 wiring")
    write(p, text)


def materialize_docs(result: dict) -> None:
    contract = {
        "schema_version": "geox_mcft_cap_06_s2_contracts_math_v1",
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S2,
        "status": "S2_CONTRACTS_MATH_CANDIDATE",
        "effective": False,
        "runtime_mode": "REPLAY",
        "source_profile_id": result["source_profile_id"],
        "source_dataset_identity": {
            "residual_set_hash": result["source_s1_residual_set_hash"],
            "case_id0ut_set_hash": result["source_s1_case_id0ut_set_hash"],
            "calibration_window_ref_membership_hash": result["calibration_window_ref_membership_hash"],
            "holdout_window_ref_membership_hash": result["holdout_window_ref_membership_hash"],
        },
        "window_hash_semantics": result["window_hash_semantics"],
        "holdout_purpose": result["holdout_purpose"],
        "holdout_generalization_claim": result["holdout_generalization_claim"],
        "numeric_policy": {
            "parameter_scale": 6,
            "vwc_metric_scale": 9,
            "sse_scale": 18,
            "rounding": "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
            "host_floating_point_authority": False,
            "idteger_square_root": "BIGINT_NEAREST_INTEGER_SQRT_V1",
        },
        "search_policy": {
            "minimum": "0.020000",
            "maximum": "0.040000",
            "step": "0.001000",
            "grid_count": 21,
            "base_parameter": "0.030000",
            "selected_parameter": result["selected_parameter_value"],
            "objective_mse_range_epsilon_sse_scale_18": result["objective_mse_range_epsilon_sse_scale_18"],
            "best_second_mse_margin_epsilon_sse_scale_18": result["best_second_mse_margin_epsilon_sse_scale_18"],
            "objective_mse_range_sse_scale_18": result["objective_mse_range_sse_scale_18"],
            "best_vs_second_mse_margin_sse_scale_18": result["best_vs_second_mse_margin_sse_scale_18"],
            "tie_break_order": ["MSE", "ABSOLUTE_MEAN_BIAS", "MAXIMUM_ABSOLUTE_RESIDUAL", "SMALLEST_DELTA_FROM_BASE", "LOWER_PARAMETER_VALUE"],
        },
        "successor_readiness": {
            "sensitive_case_count": result["sensitive_case_count"],
            "minimum_sensitive_case_count": 4,
            "represented_sensitive_wetness_regimes": result["represented_sensitive_wetness_regimes"],
            "minimum_sensitive_wetness_regime_count": 2,
            "positive_disposition": result["positive_disposition"],
            "positive_shadow_disposition": result["positive_shadow_disposition"],
        },
        "negative_dispositions": {
            "no_op": result["no_op_disposition"],
            "boundary": result["boundary_disposition"],
            "flat": result["flat_disposition"],
            "margin": result["margin_disposition"],
            "excitation": result["excitation_disposition"],
            "base_mismatch": result["base_mismatch_disposition"],
            "determinism": result["determinism_disposition"],
            "physical": result["physical_disposition"],
            "mass_balance": result["mass_balance_disposition"],
        },
        "determinism_hashes": {
            "calibration_window": result["calibration_window_determinism_hash"],
            "holdout_window": result["holdout_window_determinism_hash"],
            "positive_attempt": result["positive_attempt_determinism_hash"],
            "positive_shadow": result["positive_shadow_determinism_hash"],
            "candidate_draft": result["candidate_draft_determinism_hash"],
            "evaluation_draft": result["evaluation_draft_determinism_hash"],
        },
        "canonical_write_count": 0,
        "projection_write_count": 0,
        "migration_count": 0,
        "model_activation_count": 0,
        "preserved_nonclaims": [
            "NO_CALIBRATION_CANDIDATE_APPEND",
            "NO_SHADOW_EVALUATION_APPEND",
            "NO_D_TRANSACTION_PERSISTENCE",
            "NO_MODEL_ACTIVATION",
            "NO_ACTIVE_CONFIG_SWITCH",
            "NO_RUNTIME_AUTHORITY_CHANGE",
            "NO_GENERALIZATION_CLAIM",
            "NO_S3_AUTHORIZATION",
        ],
    }
    write_json("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json", contract)

    status = {
        "schema_version": "geox_mcft_cap_06_s2_status_v1",
        "capability_line_id": "MCFT-CAP-06",
        "delivery_slice_id": S2,
        "status": "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE",
        "baseline_main_commit": "9eff45605dc709a6001e6c1bed29fd1df76197ed",
        "implementation_branch": "agent/mcft-cap-06-s2-contracts-math-corrected-v1",
        "candidate_tree_validation": {
            "s2_runtime_acceptance": "PASS",
            "repository_typecheck": "PASS_MATERIALIZER_PENDING_EXACT_HEAD_CI",
            "repository_build": "PASS_MATERIALIZER_PENDING_EXACT_HEAD_CI",
            "source_s1_identity_binding": "PASS",
            "host_floating_point_authority_absent": True,
            "exact_changed_file_count": 17,
            "temporary_workflows_retained": False,
            "generated_acceptance_artifacts_retained": False,
        },
        "result_summary": contract,
        "s2_effective": False,
        "s3_authorized": False,
        "effectiveness_condition": "S2_EXACT_HEAD_CI_PASS_AND_MERGE_AND_TREE_EQUIVALENCE_AND_EXACT_MERGED_MAIN_PROOF_AND_SEPARATE_EFFECTIVENESS_WRITEBACK",
        "exact_changed_file_boundary": PERMANENT_FILES,
        "preserved_nonclaims": contract["preserved_nonclaims"],
    }
    write_json("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json", status)

    current_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json"
    current = read_json(current_path)
    current["status"] = "S2_CONTRACTS_MATH_CANDIDATE"
    current["reconciliation_effective"] = False
    current["effectiveness_condition"] = status["effectiveness_condition"]
    current["next_repository_action"] = S2
    cs = current["current_state"]
    cs["active_delivery_slice_id"] = S2
    cs["s2"] = "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE"
    cs["s2_authorized"] = True
    cs["s2_implementation_started"] = True
    cs["calibration_contract_math_candidate_implemented"] = True
    cs["calibration_contract_math_implemented"] = False
    cs["candidate_runtime_implemented"] = False
    cs["shadow_evaluation_runtime_implemented"] = False
    current["proof"]["s2_candidate"] = {
        "status": "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE",
        "status_ref": "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json",
        "contract_ref": "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json",
        "runtime_acceptance": "PASS",
        "canonical_write_count": 0,
        "migration_count": 0,
        "effective": False,
    }
    write_json(current_path, current)

    delivery_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json"
    delivery = read_json(delivery_path)
    delivery["implementation_status"] = "S2_CONTRACTS_MATH_CANDIDATE"
    delivery["active_delivery_slice_id"] = S2
    delivery["candidate_slices"] = [S2]
    delivery["authorized_not_started_slices"] = []
    delivery["next_repository_action"] = S2
    delivery["s2_authorized"] = True
    delivery["s2_implementation_started"] = True
    delivery["s2_candidate_implemented"] = True
    delivery["s2_effective"] = False
    delivery["s3_authorized"] = False
    if S3 not in delivery["blocked_slices"]:
        delivery["blocked_slices"].append(S3)
    write_json(delivery_path, delivery)

    matrix_path = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json"
    matrix = read_json(matrix_path)
    lines = matrix.get("capability_lines") or matrix.get("capabilities")
    line = next(item for item in lines if item.get("capability_line_id") == "MCFT-CAP-06")
    line["status"] = "IMPLEMENTATION_IN_PROGRESS"
    line["active_delivery_slice_id"] = S2
    line["next_authorized_slice_ids"] = []
    line["calibration_contract_math_candidate_implemented"] = True
    line["calibration_contract_math_implemented"] = False
    line["candidate_runtime_implemented"] = False
    line["shadow_evaluation_runtime_implemented"] = False
    for item in line["delivery_slices"]:
        if item.get("delivery_slice_id") == S2:
            item["status"] = "CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE"
            item["implementation_started"] = True
            item["effectiveness_condition_satisfied"] = False
            item["status_ref"] = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json"
    write_json(matrix_path, matrix)

    task_path = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md"
    task = read(task_path)
    task = replace_once(task, "S1_CORRECTION_MERGED_EFFECTIVE_S2_AUTHORIZED_NOT_STARTED", "S2_CONTRACTS_MATH_CANDIDATE", "task implementation status")
    task = replace_once(task, "S1_CORRECTED_SUCCESSOR_READINESS_EFFECTIVE_S2_NOT_STARTED", "S2_CONTRACTS_MATH_IMPLEMENTED_NOT_EFFECTIVE", "task runtime status")
    task = replace_once(
        task,
        "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0、S0 与 corrected S1 已 merged-main effective；当前唯一 active slice 为 S2 contracts/math，状态 AUTHORIZED_NOT_STARTED。S3 及其后续、Calibration Candidate、Shadow Evaluation、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 均保持未授权。",
        "本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1、P0、S0 与 corrected S1 已 merged-main effective；当前唯一 active slice 为 S2 contracts/math，候选实现已完成但尚未 effective。S3 及其后续、Calibration Candidate canonical append、Shadow Evaluation canonical append、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 均保持未授权。",
        "task state paragraph",
    )
    marker = "<!-- MCFT-CAP-06-S2-CONTRACTS-MATH-CANDIDATE-V1 -->"
    if marker not in task:
        task += f'''\n\n{marker}\n## S2 contracts/math candidate\n\n```text\nstatus: CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE\nsource residual set: {result["source_s1_residual_set_hash"]}\nsource case-id0ut set: {result["source_s1_case_id0ut_set_hash"]}\nwindow hash semantics: {result["window_hash_semantics"]}\nholdout purpose: {result["holdout_purpose"]}\nholdout generalization: {result["holdout_generalization_claim"]}\nparameter grid: 0.020000..0.040000 step 0.001000 (21)\nselected controlled parameter: {result["selected_parameter_value"]}\nobjective range threshold scale18: {result["objective_mse_range_epsilon_sse_scale_18"]}\nbest-second margin threshold scale18: {result["best_second_mse_margin_epsilon_sse_scale_18"]}\ncanonical writes: 0\nNO_CALIBRATION_CANDIDATE_APPEND\nNO_SHADOW_EVALUATION_APPEND\nNO_MODEL_ACTIVATION\nS3 authorization: false\n```\n'''
    write(task_path, task)

    map_path = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md"
    implementation_map = read(map_path)
    marker = "<!-- MCFT-CAP-06-S2-CONTRACTS-MATH-CANDIDATE-V1 -->"
    if marker not in implementation_map:
        implementation_map += f'''\n\n{marker}\n## MCFT-CAP-06 S2 contracts/math candidate\n\n```text\nactive slice: {S2}\nstatus: CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE\ncorrected S1 identity binding: PASS\nfixed-point 21-point search: PASS\npaired historical shadow com0ute: PASS\nCandidate/Evaluation drafts: pure, non-lineage, zero-write\nD transaction persistence: not implemented\nS3+: blocked\n```\n'''
    write(map_path, implementation_map)

    patch_acceptance_runner()
    create_governance_gate(result)


def materialize() -> None:
    result_path = "acceptance-out0ut/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json"
    result = read_json(result_path)
    if result.get("status") != "PASS":
        raise RuntimeError("S2 acceptance result must PASS before SSOT materialization")
    materialize_docs(result)
    print(json.dumps({"materialization": "PASS", "permanent_files": PERMANENT_FILES}, indent=2))


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"source", "materialize"}:
        raise SystemExit("usage: materializer.py source|materialize")
    if sys.argv[1] == "source":
        patch_source()
    else:
        materialize()


if __name__ == "__main__":
    main()
