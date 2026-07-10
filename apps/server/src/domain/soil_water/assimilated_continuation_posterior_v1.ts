// apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.ts
// Purpose: compute one deterministic CAP-03 observation-assimilation disposition from a propagated prior and an already-selected canonical observation.
// Boundary: pure continuation mathematics only; no Evidence selection, database, persistence, Runtime orchestration, filesystem, network, wall clock, or model activation.

import type { AssimilatedObservationCandidateV1 } from "../twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1,
  ASSIMILATED_CONTINUATION_METHOD_ID_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
  ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1,
  ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1,
} from "../twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { roundDecimalHalfAwayFromZeroV1 } from "../twin_runtime/canonical_json_v1.js";
import { buildRootZoneObservationOperatorV1 } from "./root_zone_observation_operator_v1.js";
import { assimilateScalarGaussianV1 } from "./scalar_gaussian_assimilation_v1.js";

export const ASSIMILATED_CONTINUATION_POSTERIOR_SCHEMA_V1 =
  "mcft_cap_03_assimilated_continuation_posterior_v1" as const;
export const ASSIMILATED_CONTINUATION_THRESHOLD_DECISION_BASIS_V1 =
  "INNOVATION_SQUARED_LE_16_TIMES_VARIANCE" as const;
export const ASSIMILATED_CONTINUATION_ROUNDING_RULE_V1 =
  "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;

export type CanonicalDecimalV1 = {
  value: string;
  scale: number;
};

export type AssimilatedContinuationPosteriorV1 = {
  schema_version: typeof ASSIMILATED_CONTINUATION_POSTERIOR_SCHEMA_V1;
  status: "APPLIED" | "NOT_APPLIED";
  disposition: "ACCEPTED" | "DOWNWEIGHTED" | "REJECTED_OUTLIER" | "NO_USABLE_OBSERVATION";
  selected_observation_ref: string | null;
  evaluated_observation_refs: string[];
  applied_observation_refs: string[];
  consumed_observation_refs: string[];
  observation_operator: {
    id: typeof ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1;
    h: 1;
    direct_state_equivalence: false;
  };
  assimilation_method_id: typeof ASSIMILATED_CONTINUATION_METHOD_ID_V1;
  outlier_policy_id: typeof ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1;
  threshold_decision_basis: typeof ASSIMILATED_CONTINUATION_THRESHOLD_DECISION_BASIS_V1;
  prior_mean: number;
  prior_variance: number;
  quality_weight: number | null;
  sensor_variance: number | null;
  representativeness_variance: number | null;
  base_observation_variance: number | null;
  observation_variance: number | null;
  predicted_observation: number | null;
  actual_observation: number | null;
  innovation: number | null;
  residual: number | null;
  residual_kind: "STATE_OBSERVATION_INNOVATION";
  innovation_variance: number | null;
  normalized_innovation: number | null;
  squared_normalized_innovation: number | null;
  candidate_assimilation_gain: number | null;
  applied_assimilation_gain: number | null;
  candidate_unclipped_posterior_mean: number | null;
  candidate_posterior_variance: number | null;
  published_posterior_mean: number;
  published_posterior_variance: number;
  state_correction_vwc: number;
  state_correction_storage_mm: number;
  clipping: {
    policy_id: typeof ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1;
    applied: boolean;
    lower_bound: 0;
    upper_bound: number;
    delta: number;
    physical_clipping_reduces_latent_variance: false;
  };
  canonical_decimal_basis: {
    propagated_prior_vwc_decimal: CanonicalDecimalV1;
    propagated_prior_vwc_variance_decimal: CanonicalDecimalV1;
    posterior_vwc_decimal: CanonicalDecimalV1;
    posterior_vwc_variance_decimal: CanonicalDecimalV1;
    storage_mean_mm_decimal: CanonicalDecimalV1;
    storage_variance_mm2_decimal: CanonicalDecimalV1;
  };
  reason_codes: string[];
};

function finiteV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function nonNegativeV1(value: unknown, code: string): number {
  const number = finiteV1(value, code);
  if (number < 0) throw new Error(code);
  return number;
}

function positiveV1(value: unknown, code: string): number {
  const number = finiteV1(value, code);
  if (!(number > 0)) throw new Error(code);
  return number;
}

function canonicalDecimalV1(value: number, scale: number): CanonicalDecimalV1 {
  const rounded = roundDecimalHalfAwayFromZeroV1(value, scale);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return { value: normalized.toFixed(scale), scale };
}

function baseResultV1(input: {
  prior_mean: number;
  prior_variance: number;
  saturation_fraction: number;
  root_zone_depth_mm: number;
}): Pick<AssimilatedContinuationPosteriorV1,
  "schema_version" | "observation_operator" | "assimilation_method_id" | "outlier_policy_id" |
  "threshold_decision_basis" | "prior_mean" | "prior_variance" | "clipping"> {
  return {
    schema_version: ASSIMILATED_CONTINUATION_POSTERIOR_SCHEMA_V1,
    observation_operator: {
      id: ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
      h: 1,
      direct_state_equivalence: false,
    },
    assimilation_method_id: ASSIMILATED_CONTINUATION_METHOD_ID_V1,
    outlier_policy_id: ASSIMILATED_CONTINUATION_OUTLIER_POLICY_ID_V1,
    threshold_decision_basis: ASSIMILATED_CONTINUATION_THRESHOLD_DECISION_BASIS_V1,
    prior_mean: input.prior_mean,
    prior_variance: input.prior_variance,
    clipping: {
      policy_id: ASSIMILATED_CONTINUATION_POSTERIOR_CLIP_POLICY_V1,
      applied: false,
      lower_bound: 0,
      upper_bound: input.saturation_fraction,
      delta: 0,
      physical_clipping_reduces_latent_variance: false,
    },
  };
}

function decimalBasisV1(input: {
  prior_mean: number;
  prior_variance: number;
  posterior_mean: number;
  posterior_variance: number;
  root_zone_depth_mm: number;
}): AssimilatedContinuationPosteriorV1["canonical_decimal_basis"] {
  return {
    propagated_prior_vwc_decimal: canonicalDecimalV1(input.prior_mean, 12),
    propagated_prior_vwc_variance_decimal: canonicalDecimalV1(input.prior_variance, 12),
    posterior_vwc_decimal: canonicalDecimalV1(input.posterior_mean, 12),
    posterior_vwc_variance_decimal: canonicalDecimalV1(input.posterior_variance, 12),
    storage_mean_mm_decimal: canonicalDecimalV1(input.posterior_mean * input.root_zone_depth_mm, 6),
    storage_variance_mm2_decimal: canonicalDecimalV1(input.posterior_variance * input.root_zone_depth_mm ** 2, 12),
  };
}

export function composeAssimilatedContinuationPosteriorV1(input: {
  prior_mean: unknown;
  prior_variance: unknown;
  selected_observation: AssimilatedObservationCandidateV1 | null;
  saturation_fraction: unknown;
  root_zone_depth_mm: unknown;
  sensor_measurement_stddev_fraction: unknown;
  point_to_zone_representativeness_stddev_fraction: unknown;
  quality_weights: Readonly<{ PASS: number; LIMITED: number; FAIL: 0 }>;
}): AssimilatedContinuationPosteriorV1 {
  const priorMean = finiteV1(input.prior_mean, "ASSIMILATION_PRIOR_MEAN_NON_FINITE");
  const priorVariance = nonNegativeV1(input.prior_variance, "ASSIMILATION_PRIOR_VARIANCE_INVALID");
  const saturation = positiveV1(input.saturation_fraction, "ASSIMILATION_SATURATION_INVALID");
  const depth = positiveV1(input.root_zone_depth_mm, "ASSIMILATION_ROOT_ZONE_DEPTH_INVALID");
  if (priorMean < 0 || priorMean > saturation) throw new Error("ASSIMILATION_PRIOR_MEAN_OUT_OF_PHYSICAL_BOUNDS");
  if (input.quality_weights.FAIL !== 0) throw new Error("ASSIMILATION_FAIL_QUALITY_WEIGHT_MUST_BE_ZERO");

  const base = baseResultV1({
    prior_mean: priorMean,
    prior_variance: priorVariance,
    saturation_fraction: saturation,
    root_zone_depth_mm: depth,
  });

  if (input.selected_observation === null) {
    return {
      ...base,
      status: "NOT_APPLIED",
      disposition: "NO_USABLE_OBSERVATION",
      selected_observation_ref: null,
      evaluated_observation_refs: [],
      applied_observation_refs: [],
      consumed_observation_refs: [],
      quality_weight: null,
      sensor_variance: null,
      representativeness_variance: null,
      base_observation_variance: null,
      observation_variance: null,
      predicted_observation: null,
      actual_observation: null,
      innovation: null,
      residual: null,
      residual_kind: "STATE_OBSERVATION_INNOVATION",
      innovation_variance: null,
      normalized_innovation: null,
      squared_normalized_innovation: null,
      candidate_assimilation_gain: null,
      applied_assimilation_gain: null,
      candidate_unclipped_posterior_mean: null,
      candidate_posterior_variance: null,
      published_posterior_mean: priorMean,
      published_posterior_variance: priorVariance,
      state_correction_vwc: 0,
      state_correction_storage_mm: 0,
      canonical_decimal_basis: decimalBasisV1({
        prior_mean: priorMean,
        prior_variance: priorVariance,
        posterior_mean: priorMean,
        posterior_variance: priorVariance,
        root_zone_depth_mm: depth,
      }),
      reason_codes: ["NO_USABLE_OBSERVATION"],
    };
  }

  const selected = input.selected_observation;
  if (selected.candidate_assessment !== "SELECTED") throw new Error("ASSIMILATION_SELECTED_CANDIDATE_REQUIRED");
  const operator = buildRootZoneObservationOperatorV1({
    observation_fraction: selected.canonical_value,
    quality_status: selected.quality_status,
    sensor_measurement_stddev_fraction: input.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: input.point_to_zone_representativeness_stddev_fraction,
    quality_weights: input.quality_weights,
  });
  const innovation = operator.observation_fraction - priorMean;
  const innovationVariance = priorVariance + operator.effective_observation_variance;
  if (!(innovationVariance > 0)) throw new Error("ASSIMILATION_INNOVATION_VARIANCE_NON_POSITIVE");
  const squaredNormalizedInnovation = innovation ** 2 / innovationVariance;
  const normalizedInnovation = innovation / Math.sqrt(innovationVariance);
  const candidateGain = priorVariance / innovationVariance;
  const selectedRef = selected.observation_ref;

  if (squaredNormalizedInnovation > ASSIMILATED_CONTINUATION_MAX_SQUARED_NORMALIZED_INNOVATION_V1) {
    return {
      ...base,
      status: "NOT_APPLIED",
      disposition: "REJECTED_OUTLIER",
      selected_observation_ref: selectedRef,
      evaluated_observation_refs: [selectedRef],
      applied_observation_refs: [],
      consumed_observation_refs: [],
      quality_weight: operator.quality_weight,
      sensor_variance: operator.sensor_variance,
      representativeness_variance: operator.representativeness_variance,
      base_observation_variance: operator.base_observation_variance,
      observation_variance: operator.effective_observation_variance,
      predicted_observation: priorMean,
      actual_observation: operator.observation_fraction,
      innovation,
      residual: innovation,
      residual_kind: "STATE_OBSERVATION_INNOVATION",
      innovation_variance: innovationVariance,
      normalized_innovation: normalizedInnovation,
      squared_normalized_innovation: squaredNormalizedInnovation,
      candidate_assimilation_gain: candidateGain,
      applied_assimilation_gain: null,
      candidate_unclipped_posterior_mean: null,
      candidate_posterior_variance: null,
      published_posterior_mean: priorMean,
      published_posterior_variance: priorVariance,
      state_correction_vwc: 0,
      state_correction_storage_mm: 0,
      canonical_decimal_basis: decimalBasisV1({
        prior_mean: priorMean,
        prior_variance: priorVariance,
        posterior_mean: priorMean,
        posterior_variance: priorVariance,
        root_zone_depth_mm: depth,
      }),
      reason_codes: ["INNOVATION_OUTLIER_REJECTED"],
    };
  }

  const assimilation = assimilateScalarGaussianV1({
    prior_mean: priorMean,
    prior_variance: priorVariance,
    observation: operator.observation_fraction,
    observation_variance: operator.effective_observation_variance,
    observation_operator_h: 1,
  });
  const unclippedMean = assimilation.posterior_mean;
  const clippedMean = Math.min(saturation, Math.max(0, unclippedMean));
  const clippingDelta = clippedMean - unclippedMean;
  const applied = {
    ...base,
    clipping: {
      ...base.clipping,
      applied: clippingDelta !== 0,
      delta: clippingDelta,
    },
    status: "APPLIED" as const,
    disposition: selected.quality_status === "PASS" ? "ACCEPTED" as const : "DOWNWEIGHTED" as const,
    selected_observation_ref: selectedRef,
    evaluated_observation_refs: [selectedRef],
    applied_observation_refs: [selectedRef],
    consumed_observation_refs: [selectedRef],
    quality_weight: operator.quality_weight,
    sensor_variance: operator.sensor_variance,
    representativeness_variance: operator.representativeness_variance,
    base_observation_variance: operator.base_observation_variance,
    observation_variance: operator.effective_observation_variance,
    predicted_observation: assimilation.predicted_observation,
    actual_observation: operator.observation_fraction,
    innovation: assimilation.innovation,
    residual: assimilation.innovation,
    residual_kind: "STATE_OBSERVATION_INNOVATION" as const,
    innovation_variance: innovationVariance,
    normalized_innovation: normalizedInnovation,
    squared_normalized_innovation: squaredNormalizedInnovation,
    candidate_assimilation_gain: candidateGain,
    applied_assimilation_gain: assimilation.assimilation_gain,
    candidate_unclipped_posterior_mean: unclippedMean,
    candidate_posterior_variance: assimilation.posterior_variance,
    published_posterior_mean: clippedMean,
    published_posterior_variance: assimilation.posterior_variance,
    state_correction_vwc: clippedMean - priorMean,
    state_correction_storage_mm: (clippedMean - priorMean) * depth,
    canonical_decimal_basis: decimalBasisV1({
      prior_mean: priorMean,
      prior_variance: priorVariance,
      posterior_mean: clippedMean,
      posterior_variance: assimilation.posterior_variance,
      root_zone_depth_mm: depth,
    }),
    reason_codes: selected.quality_status === "PASS" ? ["PASS_OBSERVATION_ACCEPTED"] : ["LIMITED_OBSERVATION_DOWNWEIGHTED"],
  };
  return applied;
}
