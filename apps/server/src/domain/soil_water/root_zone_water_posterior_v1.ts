// apps/server/src/domain/soil_water/root_zone_water_posterior_v1.ts
// Purpose: compose the frozen weak prior, H=1 observation model, Gaussian assimilation, physical bounds, uncertainty, and derived root-zone water outputs.
// Boundary: pure S3B domain computation only; no Evidence selection, Runtime orchestration, canonical writes, persistence, I/O, clock, network, or mutable global state.

import { roundDecimalHalfAwayFromZeroV1 } from "../twin_runtime/canonical_json_v1.js";
import {
  ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1,
  ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1,
  ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1,
  clampUnitIntervalV1,
  deriveClippedGaussianIntervalV1,
  requireFiniteNumberV1,
  validatePosteriorMeanWithinBoundsV1,
  validateSoilHydraulicBoundsV1,
  type SoilHydraulicBoundsV1,
} from "../twin_runtime/physical_bounds_v1.js";
import { BOOTSTRAP_WATER_PRIOR_RULE_ID_V1, buildBootstrapWaterPriorV1 } from "./bootstrap_water_prior_v1.js";
import {
  ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1,
  buildRootZoneObservationOperatorV1,
  type ObservationQualityStatusV1,
} from "./root_zone_observation_operator_v1.js";
import { SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1, assimilateScalarGaussianV1 } from "./scalar_gaussian_assimilation_v1.js";

export const MCFT_BOOTSTRAP_WATER_POSTERIOR_SCHEMA_V1 = "mcft_bootstrap_water_posterior_v1" as const;
export const MCFT_BOOTSTRAP_WATER_MODEL_COMPONENT_ID_V1 = "mcft_static_gaussian_bootstrap_water_state_v1" as const;
export const MCFT_BOOTSTRAP_UNCERTAINTY_METHOD_ID_V1 = "GAUSSIAN_APPROXIMATION_95_INTERVAL_V1" as const;
export const MCFT_BOOTSTRAP_ROUNDING_RULE_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;

export type BootstrapWaterModelConfigV1 = {
  model_component_id: typeof MCFT_BOOTSTRAP_WATER_MODEL_COMPONENT_ID_V1;
  prior_rule_id: typeof BOOTSTRAP_WATER_PRIOR_RULE_ID_V1;
  observation_operator_id: typeof ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1;
  assimilation_method_id: typeof SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1;
  uncertainty_method_id: typeof MCFT_BOOTSTRAP_UNCERTAINTY_METHOD_ID_V1;
  numeric_output_decimals: 6;
  rounding_rule: typeof MCFT_BOOTSTRAP_ROUNDING_RULE_V1;
  physical_bound_version: typeof ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1;
  gaussian_interval_rule: typeof ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1;
  uncertainty_interval_clip_rule: typeof ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1;
  interval_clip_bounds: readonly [0, "saturation_fraction"];
  sensor_measurement_stddev_fraction: number;
  point_to_zone_representativeness_stddev_fraction: number;
  quality_weights: Readonly<Record<ObservationQualityStatusV1, number>>;
  truth_class: "CONTROLLED_SYNTHETIC";
  calibration_status: "NOT_FIELD_CALIBRATED";
};

export type RootZoneWaterPosteriorInputV1 = {
  observation_fraction: unknown;
  quality_status: unknown;
  hydraulic: SoilHydraulicBoundsV1;
  model_config: BootstrapWaterModelConfigV1;
};

export type RootZoneWaterPosteriorV1 = {
  schema_version: typeof MCFT_BOOTSTRAP_WATER_POSTERIOR_SCHEMA_V1;
  model_component_id: typeof MCFT_BOOTSTRAP_WATER_MODEL_COMPONENT_ID_V1;
  latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION";
  model_versions: {
    prior_rule_id: typeof BOOTSTRAP_WATER_PRIOR_RULE_ID_V1;
    observation_operator_id: typeof ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1;
    assimilation_method_id: typeof SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1;
    uncertainty_method_id: typeof MCFT_BOOTSTRAP_UNCERTAINTY_METHOD_ID_V1;
    physical_bound_version: typeof ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1;
    gaussian_interval_rule: typeof ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1;
    uncertainty_interval_clip_rule: typeof ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1;
    rounding_rule: typeof MCFT_BOOTSTRAP_ROUNDING_RULE_V1;
  };
  direct_state_equivalence: false;
  prior: {
    prior_kind: "CONFIGURED_WEAK_BOOTSTRAP_PRIOR";
    mean: number;
    stddev: number;
    variance: number;
  };
  observation_update: {
    observation_fraction: number;
    quality_status: Exclude<ObservationQualityStatusV1, "FAIL">;
    quality_weight: number;
    observation_operator_h: 1;
    predicted_observation: number;
    innovation: number;
    sensor_variance: number;
    representativeness_variance: number;
    base_observation_variance: number;
    effective_observation_variance: number;
    assimilation_gain: number;
  };
  posterior: {
    mean: number;
    variance: number;
    stddev: number;
    uncertainty: {
      distribution_family: "GAUSSIAN_APPROXIMATION";
      primary_measure: "STANDARD_DEVIATION";
      interval_level: 0.95;
      mean: number;
      variance: number;
      stddev: number;
      interval_low: number;
      interval_high: number;
      unclipped_interval: { low: number; high: number };
      interval_clipped: boolean;
      uncertainty_sources: readonly string[];
    };
  };
  derived_state: {
    root_zone_water_storage_mm: {
      mean: number;
      stddev: number;
      interval_low: number;
      interval_high: number;
    };
    available_water_fraction: number;
    depletion_from_field_capacity_mm: number;
  };
  unavailable_state: {
    surface_soil_moisture_state: "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION";
    water_stress_state: "NOT_ESTABLISHED_NO_STRESS_MODEL";
    drainage_state: "NOT_ESTABLISHED_MCFT_06_NOT_STARTED";
  };
  confidence: {
    status: "NOT_ESTABLISHED";
    reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL";
  };
  use_eligibility: {
    state_valid: true;
    posterior_chain_eligible: true;
    forecast_source_eligible: true;
    recommendation_input_eligible: false;
    action_input_eligible: false;
  };
  physical_bounds: {
    version: typeof ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1;
    wilting_point_fraction: number;
    field_capacity_fraction: number;
    saturation_fraction: number;
    root_zone_depth_mm: number;
  };
  limitations: readonly [
    "CONTROLLED_SYNTHETIC",
    "NOT_FIELD_CALIBRATED",
    "SINGLE_OBSERVATION_BOOTSTRAP",
    "POINT_TO_ZONE_REPRESENTATIVENESS_UNCERTAINTY",
    "NO_SURFACE_STATE_INFERENCE"
  ];
};

const UNCERTAINTY_SOURCES_V1 = [
  "weak configured prior",
  "sensor measurement uncertainty",
  "point-to-zone representativeness uncertainty",
  "controlled synthetic hydraulic configuration",
  "single-observation bootstrap limitation",
] as const;

function assertModelConfigV1(config: BootstrapWaterModelConfigV1): void {
  if (config?.model_component_id !== MCFT_BOOTSTRAP_WATER_MODEL_COMPONENT_ID_V1) throw new Error("MODEL_COMPONENT_ID_MISMATCH");
  if (config.prior_rule_id !== BOOTSTRAP_WATER_PRIOR_RULE_ID_V1) throw new Error("PRIOR_RULE_ID_MISMATCH");
  if (config.observation_operator_id !== ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1) throw new Error("OBSERVATION_OPERATOR_ID_MISMATCH");
  if (config.assimilation_method_id !== SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1) throw new Error("ASSIMILATION_METHOD_ID_MISMATCH");
  if (config.uncertainty_method_id !== MCFT_BOOTSTRAP_UNCERTAINTY_METHOD_ID_V1) throw new Error("UNCERTAINTY_METHOD_ID_MISMATCH");
  if (config.numeric_output_decimals !== 6 || config.rounding_rule !== MCFT_BOOTSTRAP_ROUNDING_RULE_V1) throw new Error("ROUNDING_CONFIG_MISMATCH");
  if (config.physical_bound_version !== ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1) throw new Error("PHYSICAL_BOUND_VERSION_MISMATCH");
  if (config.gaussian_interval_rule !== ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1) throw new Error("GAUSSIAN_INTERVAL_RULE_MISMATCH");
  if (config.uncertainty_interval_clip_rule !== ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1) throw new Error("INTERVAL_CLIP_RULE_MISMATCH");
  if (config.interval_clip_bounds?.[0] !== 0 || config.interval_clip_bounds?.[1] !== "saturation_fraction") throw new Error("INTERVAL_CLIP_BOUNDS_MISMATCH");
  if (config.truth_class !== "CONTROLLED_SYNTHETIC" || config.calibration_status !== "NOT_FIELD_CALIBRATED") throw new Error("MODEL_GOVERNANCE_MARKER_MISMATCH");
}

function roundV1(value: number): number {
  return roundDecimalHalfAwayFromZeroV1(value, 6);
}

export function buildRootZoneWaterPosteriorV1(input: RootZoneWaterPosteriorInputV1): RootZoneWaterPosteriorV1 {
  assertModelConfigV1(input.model_config);
  const hydraulic = validateSoilHydraulicBoundsV1(input.hydraulic);
  const prior = buildBootstrapWaterPriorV1(hydraulic);
  const observation = buildRootZoneObservationOperatorV1({
    observation_fraction: input.observation_fraction,
    quality_status: input.quality_status,
    sensor_measurement_stddev_fraction: input.model_config.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: input.model_config.point_to_zone_representativeness_stddev_fraction,
    quality_weights: input.model_config.quality_weights,
  });
  const assimilation = assimilateScalarGaussianV1({
    prior_mean: prior.mean,
    prior_variance: prior.variance,
    observation: observation.observation_fraction,
    observation_variance: observation.effective_observation_variance,
    observation_operator_h: observation.observation_operator_h,
  });
  validatePosteriorMeanWithinBoundsV1(assimilation.posterior_mean, hydraulic.saturation_fraction);
  const posteriorStddev = Math.sqrt(assimilation.posterior_variance);
  const interval = deriveClippedGaussianIntervalV1({
    mean: assimilation.posterior_mean,
    stddev: posteriorStddev,
    saturation_fraction: hydraulic.saturation_fraction,
  });
  const storageMean = assimilation.posterior_mean * hydraulic.root_zone_depth_mm;
  const storageStddev = posteriorStddev * hydraulic.root_zone_depth_mm;
  const storageIntervalLow = interval.interval_low * hydraulic.root_zone_depth_mm;
  const storageIntervalHigh = interval.interval_high * hydraulic.root_zone_depth_mm;
  const availableWaterFraction = clampUnitIntervalV1(
    (assimilation.posterior_mean - hydraulic.wilting_point_fraction) /
      (hydraulic.field_capacity_fraction - hydraulic.wilting_point_fraction),
  );
  const fieldCapacityStorage = hydraulic.field_capacity_fraction * hydraulic.root_zone_depth_mm;
  const depletion = Math.max(0, fieldCapacityStorage - storageMean);
  const output: RootZoneWaterPosteriorV1 = {
    schema_version: MCFT_BOOTSTRAP_WATER_POSTERIOR_SCHEMA_V1,
    model_component_id: MCFT_BOOTSTRAP_WATER_MODEL_COMPONENT_ID_V1,
    latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION",
    model_versions: {
      prior_rule_id: BOOTSTRAP_WATER_PRIOR_RULE_ID_V1,
      observation_operator_id: ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1,
      assimilation_method_id: SCALAR_GAUSSIAN_ASSIMILATION_METHOD_ID_V1,
      uncertainty_method_id: MCFT_BOOTSTRAP_UNCERTAINTY_METHOD_ID_V1,
      physical_bound_version: ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1,
      gaussian_interval_rule: ROOT_ZONE_WATER_GAUSSIAN_INTERVAL_RULE_V1,
      uncertainty_interval_clip_rule: ROOT_ZONE_WATER_INTERVAL_CLIP_RULE_V1,
      rounding_rule: MCFT_BOOTSTRAP_ROUNDING_RULE_V1,
    },
    direct_state_equivalence: false,
    prior: {
      prior_kind: "CONFIGURED_WEAK_BOOTSTRAP_PRIOR",
      mean: roundV1(prior.mean),
      stddev: roundV1(prior.stddev),
      variance: roundV1(prior.variance),
    },
    observation_update: {
      observation_fraction: roundV1(observation.observation_fraction),
      quality_status: observation.quality_status,
      quality_weight: roundV1(observation.quality_weight),
      observation_operator_h: 1,
      predicted_observation: roundV1(assimilation.predicted_observation),
      innovation: roundV1(assimilation.innovation),
      sensor_variance: roundV1(observation.sensor_variance),
      representativeness_variance: roundV1(observation.representativeness_variance),
      base_observation_variance: roundV1(observation.base_observation_variance),
      effective_observation_variance: roundV1(observation.effective_observation_variance),
      assimilation_gain: roundV1(assimilation.assimilation_gain),
    },
    posterior: {
      mean: roundV1(assimilation.posterior_mean),
      variance: roundV1(assimilation.posterior_variance),
      stddev: roundV1(posteriorStddev),
      uncertainty: {
        distribution_family: "GAUSSIAN_APPROXIMATION",
        primary_measure: "STANDARD_DEVIATION",
        interval_level: 0.95,
        mean: roundV1(assimilation.posterior_mean),
        variance: roundV1(assimilation.posterior_variance),
        stddev: roundV1(posteriorStddev),
        interval_low: roundV1(interval.interval_low),
        interval_high: roundV1(interval.interval_high),
        unclipped_interval: { low: roundV1(interval.unclipped_low), high: roundV1(interval.unclipped_high) },
        interval_clipped: interval.interval_clipped,
        uncertainty_sources: UNCERTAINTY_SOURCES_V1,
      },
    },
    derived_state: {
      root_zone_water_storage_mm: {
        mean: roundV1(storageMean),
        stddev: roundV1(storageStddev),
        interval_low: roundV1(storageIntervalLow),
        interval_high: roundV1(storageIntervalHigh),
      },
      available_water_fraction: roundV1(availableWaterFraction),
      depletion_from_field_capacity_mm: roundV1(depletion),
    },
    unavailable_state: {
      surface_soil_moisture_state: "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION",
      water_stress_state: "NOT_ESTABLISHED_NO_STRESS_MODEL",
      drainage_state: "NOT_ESTABLISHED_MCFT_06_NOT_STARTED",
    },
    confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
    use_eligibility: {
      state_valid: true,
      posterior_chain_eligible: true,
      forecast_source_eligible: true,
      recommendation_input_eligible: false,
      action_input_eligible: false,
    },
    physical_bounds: { version: ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1, ...hydraulic },
    limitations: [
      "CONTROLLED_SYNTHETIC",
      "NOT_FIELD_CALIBRATED",
      "SINGLE_OBSERVATION_BOOTSTRAP",
      "POINT_TO_ZONE_REPRESENTATIVENESS_UNCERTAINTY",
      "NO_SURFACE_STATE_INFERENCE",
    ],
  };
  validateRootZoneWaterPosteriorV1(output);
  return output;
}

function asRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

export function validateRootZoneWaterPosteriorV1(value: unknown): asserts value is RootZoneWaterPosteriorV1 {
  const output = asRecordV1(value, "POSTERIOR_OUTPUT_REQUIRED");
  if (output.schema_version !== MCFT_BOOTSTRAP_WATER_POSTERIOR_SCHEMA_V1) throw new Error("POSTERIOR_SCHEMA_MISMATCH");
  if (output.direct_state_equivalence !== false) throw new Error("DIRECT_STATE_EQUIVALENCE_FORBIDDEN");
  const confidence = asRecordV1(output.confidence, "CONFIDENCE_REQUIRED");
  if ("score" in confidence || typeof confidence.numeric_score === "number") throw new Error("NUMERIC_CONFIDENCE_FORBIDDEN");
  if (confidence.status !== "NOT_ESTABLISHED" || confidence.reason_code !== "NO_CALIBRATED_CONFIDENCE_MODEL") throw new Error("CONFIDENCE_STATUS_MISMATCH");
  const eligibility = asRecordV1(output.use_eligibility, "USE_ELIGIBILITY_REQUIRED");
  if (eligibility.state_valid !== true || eligibility.posterior_chain_eligible !== true || eligibility.forecast_source_eligible !== true) throw new Error("STATE_ELIGIBILITY_MISMATCH");
  if (eligibility.recommendation_input_eligible !== false) throw new Error("RECOMMENDATION_ELIGIBILITY_FORBIDDEN");
  if (eligibility.action_input_eligible !== false) throw new Error("ACTION_ELIGIBILITY_FORBIDDEN");
  const bounds = asRecordV1(output.physical_bounds, "PHYSICAL_BOUNDS_REQUIRED");
  const hydraulic = validateSoilHydraulicBoundsV1(bounds as unknown as SoilHydraulicBoundsV1);
  if (bounds.version !== ROOT_ZONE_WATER_PHYSICAL_BOUND_VERSION_V1) throw new Error("PHYSICAL_BOUND_VERSION_MISMATCH");
  const posterior = asRecordV1(output.posterior, "POSTERIOR_REQUIRED");
  const posteriorMean = validatePosteriorMeanWithinBoundsV1(posterior.mean, hydraulic.saturation_fraction);
  const posteriorVariance = requireFiniteNumberV1(posterior.variance, "POSTERIOR_VARIANCE_REQUIRED", "POSTERIOR_VARIANCE_NON_FINITE");
  const posteriorStddev = requireFiniteNumberV1(posterior.stddev, "POSTERIOR_STDDEV_REQUIRED", "POSTERIOR_STDDEV_NON_FINITE");
  if (posteriorVariance < 0) throw new Error("NEGATIVE_POSTERIOR_VARIANCE");
  if (posteriorStddev < 0) throw new Error("NEGATIVE_POSTERIOR_STDDEV");
  if (Math.abs(posteriorStddev ** 2 - posteriorVariance) > 0.000002) throw new Error("POSTERIOR_STDDEV_VARIANCE_MISMATCH");
  const derived = asRecordV1(output.derived_state, "DERIVED_STATE_REQUIRED");
  const storage = asRecordV1(derived.root_zone_water_storage_mm, "ROOT_ZONE_STORAGE_REQUIRED");
  const storageMean = requireFiniteNumberV1(storage.mean, "STORAGE_MEAN_REQUIRED", "STORAGE_MEAN_NON_FINITE");
  const storageTolerance = hydraulic.root_zone_depth_mm * 0.0000005 + 0.000001;
  if (Math.abs(storageMean - posteriorMean * hydraulic.root_zone_depth_mm) > storageTolerance) throw new Error("STORAGE_MEAN_MISMATCH");
  const available = requireFiniteNumberV1(derived.available_water_fraction, "AVAILABLE_WATER_REQUIRED", "AVAILABLE_WATER_NON_FINITE");
  const depletion = requireFiniteNumberV1(derived.depletion_from_field_capacity_mm, "DEPLETION_REQUIRED", "DEPLETION_NON_FINITE");
  if (available < 0 || available > 1) throw new Error("AVAILABLE_WATER_OUT_OF_BOUNDS");
  if (depletion < 0) throw new Error("NEGATIVE_DEPLETION");
  const unavailable = asRecordV1(output.unavailable_state, "UNAVAILABLE_STATE_REQUIRED");
  if (unavailable.surface_soil_moisture_state !== "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION") throw new Error("SURFACE_STATE_INFERENCE_FORBIDDEN");
  if (unavailable.water_stress_state !== "NOT_ESTABLISHED_NO_STRESS_MODEL") throw new Error("WATER_STRESS_STATE_NOT_ESTABLISHED");
  if (unavailable.drainage_state !== "NOT_ESTABLISHED_MCFT_06_NOT_STARTED") throw new Error("DRAINAGE_STATE_NOT_ESTABLISHED");
}
