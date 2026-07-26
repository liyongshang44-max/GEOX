// Purpose: adapt frozen CAP-06 Candidate/Shadow envelopes to MCFT-CAP-08.S5 signed-excess and objective-eligibility authority.
// Boundary: pure draft construction and self-hash recomputation only; no persistence, active Config, State, checkpoint, approval, route, scheduler or Model Activation write.

import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import type { Cap06PairedShadowResultV1 } from "./contracts_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "./envelope_profiles_v1.js";
import {
  CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1,
  asCap06ComputeWindowV1,
  type Cap08S5BuiltCaseWindowV1,
} from "./cap08_s5_case_builder_v1.js";
import type { Cap08S5ObjectiveAttemptV1 } from "./cap08_s5_objective_grid_search_v1.js";

function rehashV1<T extends { determinism_hash: string }>(value: T): T {
  const draft = structuredClone(value);
  draft.determinism_hash = "";
  value.determinism_hash = semanticHashV1(draft);
  return value;
}

export function buildCap08S5CalibrationCandidateDraftV1(input: {
  calibrationWindow: Cap08S5BuiltCaseWindowV1;
  attempt: Cap08S5ObjectiveAttemptV1;
}): Cap06CalibrationCandidateDraftV1 {
  const draft = buildCap06CalibrationCandidateDraftV1({
    calibrationWindow: asCap06ComputeWindowV1(input.calibrationWindow),
    attempt: input.attempt,
  });
  draft.payload.calibration_case_builder_id = CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1;
  draft.payload.calibration_case_builder_version = 1;
  draft.payload.no_positive_excess_case_count = input.calibrationWindow.no_positive_excess_case_count;
  draft.payload.no_positive_excess_case_refs = [...input.calibrationWindow.no_positive_excess_case_refs];
  draft.payload.no_positive_excess_cases_parameter_excitation_eligible = false;
  draft.payload.objective_eligibility_policy_id = input.attempt.objective_policy_id;
  draft.payload.objective_eligibility_policy_hash = input.attempt.eligibility_policy_hash;
  draft.payload.calibration_window_case_count = input.attempt.calibration_window_case_count;
  draft.payload.objective_case_count = input.attempt.objective_case_count;
  draft.payload.diagnostic_only_case_count = input.attempt.diagnostic_only_case_count;
  draft.payload.objective_residual_refs = [...input.attempt.objective_residual_refs];
  draft.payload.diagnostic_only_residual_refs = [...input.attempt.diagnostic_only_residual_refs];
  draft.payload.diagnostic_only_observation_refs = [...input.attempt.diagnostic_only_observation_refs];
  draft.payload.business_outcome_anchor_in_parameter_objective = false;
  draft.limitations = [
    ...draft.limitations,
    "SIGNED_EXCESS_CASE_WINDOW",
    "NO_POSITIVE_EXCESS_CASES_ARE_ERROR_EVIDENCE_NOT_PARAMETER_EXCITATION",
    "FVO10_RETAINED_AS_CANONICAL_DIAGNOSTIC_ONLY_EVIDENCE",
    "OBJECTIVE_ELIGIBILITY_POLICY_APPLIED",
  ];
  return rehashV1(draft);
}

export function buildCap08S5ShadowEvaluationDraftV1(input: {
  holdoutWindow: Cap08S5BuiltCaseWindowV1;
  candidate: Cap06CalibrationCandidateDraftV1;
  shadow: Cap06PairedShadowResultV1;
}): Cap06ShadowEvaluationDraftV1 {
  const draft = buildCap06ShadowEvaluationDraftV1({
    holdoutWindow: asCap06ComputeWindowV1(input.holdoutWindow),
    candidate: input.candidate,
    shadow: input.shadow,
  });
  draft.payload.holdout_case_builder_id = CAP08_S5_CALIBRATION_CASE_BUILDER_ID_V1;
  draft.payload.holdout_case_builder_version = 1;
  draft.payload.no_positive_excess_case_count = input.holdoutWindow.no_positive_excess_case_count;
  draft.payload.no_positive_excess_case_refs = [...input.holdoutWindow.no_positive_excess_case_refs];
  draft.payload.objective_eligibility_policy_id =
    input.candidate.payload.objective_eligibility_policy_id;
  draft.payload.diagnostic_only_observation_refs =
    input.candidate.payload.diagnostic_only_observation_refs;
  draft.limitations = [
    ...draft.limitations,
    "SIGNED_EXCESS_CASE_WINDOW",
    "CANDIDATE_WAS_NOT_ACTIVE_DURING_HOLDOUT_REPLAY",
  ];
  return rehashV1(draft);
}
