// apps/server/src/domain/calibration/shadow_evaluation_v1.ts
// Purpose: compute the deterministic eight-case MCFT-CAP-06 paired historical replay metrics and review-eligibility disposition.
// Boundary: zero-write pure compute over an injected prediction port; no persistence, projection, Candidate/Evaluation append, approval, active Config, State, checkpoint, route, scheduler, or Model Activation authority.

import { compareIsoInstantV1, parseFixedDecimalV1 } from "../soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  CAP06_BASE_PARAMETER_VALUE_V1,
  CAP06_BIAS_TOLERANCE_VWC_V1,
  CAP06_HOLDOUT_CASE_COUNT_V1,
  CAP06_MAX_RESIDUAL_ADDITIVE_TOLERANCE_VWC_V1,
  CAP06_SHADOW_REASON_CODES_V1,
  type Cap06CalibrationCaseV1,
  type Cap06CalibrationPredictionPortV1,
  type Cap06PairedShadowResultV1,
  type Cap06PredictionResultV1,
  type Cap06ShadowCaseResultV1,
  type Cap06ShadowDispositionV1,
  type Cap06ShadowReasonCodeV1,
} from "./contracts_v1.js";
import {
  buildCap06ErrorMetricsV1,
  cap06AbsoluteMeanBiasWithinToleranceV1,
  cap06MaximumResidualWithinToleranceV1,
  cap06RmseRelativeImprovementAtLeastV1,
  formatCap06VwcMetricV1,
  parseCap06VwcMetricV1,
} from "./fixed_point_metric_v1.js";
import type { Cap06BuiltCaseWindowV1 } from "./case_builder_v1.js";

function residualV1(actualVwc: string, predictionVwc: string): string {
  return formatCap06VwcMetricV1(
    parseCap06VwcMetricV1(actualVwc, "CAP06_SHADOW_ACTUAL_VWC_REQUIRED")
    - parseCap06VwcMetricV1(predictionVwc, "CAP06_SHADOW_PREDICTION_VWC_REQUIRED"),
  );
}

async function pairedPredictionV1(input: {
  port: Cap06CalibrationPredictionPortV1;
  caseItem: Cap06CalibrationCaseV1;
  parameterValue: string;
}): Promise<{ result: Cap06PredictionResultV1; deterministic: boolean }> {
  const first = await input.port.predictCase(input.caseItem, input.parameterValue);
  const second = await input.port.predictCase(input.caseItem, input.parameterValue);
  parseCap06VwcMetricV1(first.prediction_vwc, "CAP06_SHADOW_PREDICTION_VWC_REQUIRED");
  return {
    result: structuredClone(first),
    deterministic: semanticHashV1(first) === semanticHashV1(second),
  };
}

function orderedReasonsV1(reasons: Iterable<Cap06ShadowReasonCodeV1>): Cap06ShadowReasonCodeV1[] {
  const set = new Set(reasons);
  return CAP06_SHADOW_REASON_CODES_V1.filter((reason) => set.has(reason));
}

function allEquivalentPredictionsV1(
  base: readonly Cap06PredictionResultV1[],
  candidate: readonly Cap06PredictionResultV1[],
): boolean {
  return base.length === candidate.length
    && base.every((item, index) => semanticHashV1(item) === semanticHashV1(candidate[index]));
}

export async function runCap06PairedHistoricalShadowV1(input: {
  holdoutWindow: Cap06BuiltCaseWindowV1;
  candidateParameterValue: string;
  predictionPort: Cap06CalibrationPredictionPortV1;
}): Promise<Cap06PairedShadowResultV1> {
  if (input.holdoutWindow.role !== "HOLDOUT") throw new Error("CAP06_SHADOW_HOLDOUT_WINDOW_REQUIRED");
  if (input.holdoutWindow.cases.length !== CAP06_HOLDOUT_CASE_COUNT_V1) {
    throw new Error(`CAP06_SHADOW_HOLDOUT_CASE_COUNT_REQUIRED:${input.holdoutWindow.cases.length}`);
  }
  parseFixedDecimalV1(input.candidateParameterValue, 6, "CAP06_SHADOW_CANDIDATE_PARAMETER_REQUIRED");

  const basePredictions: Cap06PredictionResultV1[] = [];
  const candidatePredictions: Cap06PredictionResultV1[] = [];
  const baseResiduals: string[] = [];
  const candidateResiduals: string[] = [];
  const caseResults: Cap06ShadowCaseResultV1[] = [];
  let deterministic = true;
  let futureLeakageCount = 0;
  let candidatePhysicalFailures = 0;
  let candidateMassBalanceFailures = 0;

  for (const caseItem of input.holdoutWindow.cases) {
    if (
      compareIsoInstantV1(caseItem.forecast_issued_at, caseItem.observation_available_to_runtime_at) >= 0
      || compareIsoInstantV1(caseItem.forecast_as_of, caseItem.observation_available_to_runtime_at) >= 0
      || compareIsoInstantV1(caseItem.forecast_evidence_cutoff, caseItem.forecast_as_of) > 0
    ) futureLeakageCount += 1;

    const base = await pairedPredictionV1({
      port: input.predictionPort,
      caseItem,
      parameterValue: CAP06_BASE_PARAMETER_VALUE_V1,
    });
    const candidate = await pairedPredictionV1({
      port: input.predictionPort,
      caseItem,
      parameterValue: input.candidateParameterValue,
    });
    deterministic = deterministic && base.deterministic && candidate.deterministic;
    basePredictions.push(base.result);
    candidatePredictions.push(candidate.result);
    const baseResidual = residualV1(caseItem.actual_observation_vwc, base.result.prediction_vwc);
    const candidateResidual = residualV1(caseItem.actual_observation_vwc, candidate.result.prediction_vwc);
    baseResiduals.push(baseResidual);
    candidateResiduals.push(candidateResidual);
    if (candidate.result.physical_invariant_status !== "PASS") candidatePhysicalFailures += 1;
    if (candidate.result.mass_balance_status !== "PASS") candidateMassBalanceFailures += 1;
    caseResults.push({
      case_index: caseItem.case_index,
      residual_ref: caseItem.residual_ref,
      residual_hash: caseItem.residual_hash,
      source_forecast_ref: caseItem.source_forecast_ref,
      source_forecast_hash: caseItem.source_forecast_hash,
      source_forecast_point_ref: caseItem.source_forecast_point_ref,
      source_posterior_ref: caseItem.source_posterior_ref,
      source_runtime_config_ref: caseItem.source_runtime_config_ref,
      forecast_issued_at: caseItem.forecast_issued_at,
      forecast_as_of: caseItem.forecast_as_of,
      forecast_target_time: caseItem.forecast_target_time,
      observation_ref: caseItem.actual_observation_ref,
      observation_observed_at: caseItem.observation_observed_at,
      observation_available_to_runtime_at: caseItem.observation_available_to_runtime_at,
      base_parameter_value: CAP06_BASE_PARAMETER_VALUE_V1,
      candidate_parameter_value: input.candidateParameterValue,
      base_prediction_vwc: base.result.prediction_vwc,
      candidate_prediction_vwc: candidate.result.prediction_vwc,
      actual_observation_vwc: caseItem.actual_observation_vwc,
      base_residual_vwc: baseResidual,
      candidate_residual_vwc: candidateResidual,
      base_normalized_residual: null,
      candidate_normalized_residual: null,
      base_mass_balance_hash: base.result.mass_balance_hash,
      candidate_mass_balance_hash: candidate.result.mass_balance_hash,
      base_invariant_status: base.result.physical_invariant_status,
      candidate_invariant_status: candidate.result.physical_invariant_status,
      base_mass_balance_status: base.result.mass_balance_status,
      candidate_mass_balance_status: candidate.result.mass_balance_status,
    });
  }

  const baselineMetrics = buildCap06ErrorMetricsV1(baseResiduals);
  const candidateMetrics = buildCap06ErrorMetricsV1(candidateResiduals);
  const reasons = new Set<Cap06ShadowReasonCodeV1>();
  let disposition: Cap06ShadowDispositionV1;

  const noOp = input.candidateParameterValue === CAP06_BASE_PARAMETER_VALUE_V1;
  const noOpEquivalent = noOp && allEquivalentPredictionsV1(basePredictions, candidatePredictions);
  const baselinePerfect = BigInt(baselineMetrics.sum_squared_error_scale_18) === 0n;
  const candidatePerfect = BigInt(candidateMetrics.sum_squared_error_scale_18) === 0n;
  const rmsePass = cap06RmseRelativeImprovementAtLeastV1(
    baselineMetrics,
    candidateMetrics,
    95n,
    100n,
  );
  const biasPass = cap06AbsoluteMeanBiasWithinToleranceV1(
    baselineMetrics,
    candidateMetrics,
    CAP06_BIAS_TOLERANCE_VWC_V1,
  );
  const maximumPass = cap06MaximumResidualWithinToleranceV1(
    baselineMetrics,
    candidateMetrics,
    110n,
    100n,
    CAP06_MAX_RESIDUAL_ADDITIVE_TOLERANCE_VWC_V1,
  );

  if (!deterministic || futureLeakageCount > 0 || (noOp && !noOpEquivalent)) {
    if (!deterministic) reasons.add("DETERMINISM_FAILURE");
    if (futureLeakageCount > 0) reasons.add("FUTURE_LEAKAGE_DETECTED");
    if (noOp && !noOpEquivalent) reasons.add("CASE_SET_MISMATCH");
    disposition = "INCONCLUSIVE";
  } else if (noOpEquivalent) {
    reasons.add("NO_OP_CONFIRMED");
    disposition = "BASE_PARAMETER_RETAINED";
  } else if (baselinePerfect && candidatePerfect) {
    reasons.add("BASELINE_PERFECT");
    disposition = "BASE_PARAMETER_RETAINED";
  } else if (baselinePerfect && !candidatePerfect) {
    reasons.add("BASELINE_PERFECT_CANDIDATE_REGRESSION");
    disposition = "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW";
  } else if (candidatePhysicalFailures > 0 || candidateMassBalanceFailures > 0) {
    if (candidatePhysicalFailures > 0) reasons.add("PHYSICAL_INVARIANT_FAILURE");
    if (candidateMassBalanceFailures > 0) reasons.add("MASS_BALANCE_FAILURE");
    disposition = "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW";
  } else if (rmsePass && biasPass && maximumPass) {
    reasons.add("ALL_THRESHOLDS_PASS");
    disposition = "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW";
  } else {
    if (!rmsePass) reasons.add("RMSE_IMPROVEMENT_BELOW_THRESHOLD");
    if (!biasPass) reasons.add("BIAS_REGRESSION");
    if (!maximumPass) reasons.add("MAX_ERROR_REGRESSION");
    disposition = "NOT_ELIGIBLE_FOR_ACTIVATION_REVIEW";
  }

  const caseResultsHash = semanticHashV1(caseResults);
  const semantic = {
    schema_version: "geox_mcft_cap_06_paired_shadow_compute_result_v1" as const,
    evaluation_kind: "PAIRED_HISTORICAL_REPLAY_SHADOW_EVALUATION" as const,
    candidate_parameter_value: input.candidateParameterValue,
    baseline_metrics: baselineMetrics,
    candidate_metrics: candidateMetrics,
    case_results: caseResults,
    case_results_hash: caseResultsHash,
    evaluation_disposition: disposition,
    reason_codes: orderedReasonsV1(reasons),
    source_s1_residual_set_hash: input.holdoutWindow.source_s1_residual_set_hash,
    source_s1_case_input_set_hash: input.holdoutWindow.source_s1_case_input_set_hash,
    holdout_window_ref_membership_hash: input.holdoutWindow.window_ref_membership_hash,
    window_hash_semantics: input.holdoutWindow.window_hash_semantics,
    holdout_purpose: input.holdoutWindow.holdout_purpose,
    holdout_generalization_claim: input.holdoutWindow.holdout_generalization_claim,
    eligible_for_human_activation_review: disposition === "ELIGIBLE_FOR_HUMAN_ACTIVATION_REVIEW",
    model_activation_created: false as const,
    active_config_switch_performed: false as const,
    approval_created: false as const,
    activation_authorized: false as const,
    uncertainty_model_changed: false as const,
    state_confidence_changed: false as const,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}
