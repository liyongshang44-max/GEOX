// apps/server/src/domain/soil_water/root_zone_water_posterior_v1.ts
// Purpose: compute and emit one first-class-ready bootstrap posterior water State from a configured weak prior and one usable point observation.
// Boundary: pure Domain calculation only; no canonical object identity, persistence, Evidence selection, Forecast logic, Runtime orchestration, or clock.

import { roundDecimalHalfAwayFromZeroV1 } from "../twin_runtime/canonical_json_v1.js";
import { MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1 } from "../twin_runtime/runtime_config_v1.js";
import {
  buildClippedGaussianIntervalV1,
  clampUnitIntervalV1,
  validateObservationFractionV1,
  validatePosteriorPhysicalStateV1,
  validateSoilHydraulicConfigurationV1,
  validateWaterPhysicalBoundPolicyV1,
  type SoilHydraulicConfigurationV1,
  type WaterPhysicalBoundPolicyV1,
} from "../twin_runtime/physical_bounds_v1.js";
import { computeWeakBootstrapWaterPriorV1 } from "./bootstrap_water_prior_v1.js";
import { applyRootZoneObservationOperatorV1 } from "./root_zone_observation_operator_v1.js";
import { assimilateScalarGaussianObservationV1, type ObservationQualityStatusV1 } from "./scalar_gaussian_assimilation_v1.js";

export type BootstrapWaterModelConfigV1 = Readonly<{
  model_component_id: "mcft_static_gaussian_bootstrap_water_state_v1";
  prior_rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1";
  observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
  assimilation_method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1";
  uncertainty_method_id: "GAUSSIAN_APPROXIMATION_95_INTERVAL_V1";
  numeric_output_decimals: number;
  rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1";
  physical_bound_version: "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1";
  gaussian_interval_rule: "NORMAL_95_Z_1_96_V1";
  uncertainty_interval_clip_rule: "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1";
  interval_clip_bounds: readonly [number, number];
  sensor_measurement_stddev_fraction: number;
  point_to_zone_representativeness_stddev_fraction: number;
  quality_weights: Readonly<Record<ObservationQualityStatusV1, number>>;
  truth_class: "CONTROLLED_SYNTHETIC";
  calibration_status: "NOT_FIELD_CALIBRATED";
}>;

export type BootstrapWaterObservationV1 = Readonly<{
  observation_ref: string;
  value_fraction: number;
  quality_status: ObservationQualityStatusV1;
  direct_state_equivalence: false;
}>;

export type BootstrapWaterPosteriorInputV1 = Readonly<{
  hydraulic_configuration: SoilHydraulicConfigurationV1;
  observation: BootstrapWaterObservationV1 | null;
  model_config?: BootstrapWaterModelConfigV1;
}>;

export type BootstrapWaterPosteriorOutputV1 = Readonly<{
  model_component_id: "mcft_static_gaussian_bootstrap_water_state_v1";
  latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION";
  bootstrap_prior: Readonly<{
    rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1";
    distribution_family: "GAUSSIAN_APPROXIMATION";
    mean: number;
    variance: number;
    stddev: number;
  }>;
  observation_operator: Readonly<{
    observation_operator_id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
    h: 1;
    direct_state_equivalence: false;
  }>;
  assimilation_update: Readonly<Record<string, string | number>>;
  posterior_state: Readonly<{
    root_zone_volumetric_water_content_fraction: Readonly<Record<string, unknown>>;
    root_zone_water_storage_mm: Readonly<Record<string, unknown>>;
    available_water_fraction: number;
    root_zone_depletion_from_field_capacity_mm: number;
    surface_soil_moisture_state: Readonly<{ status: "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION" }>;
    water_stress_state: Readonly<{ status: "NOT_ESTABLISHED_NO_STRESS_MODEL" }>;
    drainage_state: Readonly<{ status: "NOT_ESTABLISHED_MCFT_06_NOT_STARTED" }>;
    confidence: Readonly<{ status: "NOT_ESTABLISHED"; reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" }>;
    use_eligibility: Readonly<{
      state_valid: true;
      posterior_chain_eligible: true;
      forecast_source_eligible: true;
      recommendation_input_eligible: false;
      action_input_eligible: false;
    }>;
  }>;
  limitations: readonly string[];
}>;

const UNCERTAINTY_SOURCES_V1 = [
  "WEAK_CONFIGURED_PRIOR",
  "SENSOR_MEASUREMENT_UNCERTAINTY",
  "POINT_TO_ZONE_REPRESENTATIVENESS_UNCERTAINTY",
  "CONTROLLED_SYNTHETIC_HYDRAULIC_CONFIGURATION",
  "SINGLE_OBSERVATION_BOOTSTRAP_LIMITATION",
] as const;

function round(value: number, decimals: number): number {
  return roundDecimalHalfAwayFromZeroV1(value, decimals);
}

function validateModelConfigV1(modelConfig: BootstrapWaterModelConfigV1, hydraulic: SoilHydraulicConfigurationV1): WaterPhysicalBoundPolicyV1 {
  if (modelConfig.model_component_id !== "mcft_static_gaussian_bootstrap_water_state_v1") throw new Error("MODEL_COMPONENT_ID_MISMATCH");
  if (modelConfig.prior_rule_id !== "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1") throw new Error("PRIOR_RULE_ID_MISMATCH");
  if (modelConfig.observation_operator_id !== "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1") throw new Error("OBSERVATION_OPERATOR_ID_MISMATCH");
  if (modelConfig.assimilation_method_id !== "SCALAR_GAUSSIAN_ASSIMILATION_V1") throw new Error("ASSIMILATION_METHOD_ID_MISMATCH");
  if (modelConfig.uncertainty_method_id !== "GAUSSIAN_APPROXIMATION_95_INTERVAL_V1") throw new Error("UNCERTAINTY_METHOD_ID_MISMATCH");
  if (modelConfig.rounding_rule !== "DECIMAL_HALF_AWAY_FROM_ZERO_V1") throw new Error("ROUNDING_RULE_MISMATCH");
  if (!Number.isInteger(modelConfig.numeric_output_decimals) || modelConfig.numeric_output_decimals < 0 || modelConfig.numeric_output_decimals > 12) throw new Error("INVALID_DECIMAL_SCALE");
  if (modelConfig.truth_class !== "CONTROLLED_SYNTHETIC" || modelConfig.calibration_status !== "NOT_FIELD_CALIBRATED") throw new Error("BOOTSTRAP_MODEL_EPISTEMIC_CLASS_MISMATCH");
  const policy: WaterPhysicalBoundPolicyV1 = {
    physical_bound_version: modelConfig.physical_bound_version,
    gaussian_interval_rule: modelConfig.gaussian_interval_rule,
    uncertainty_interval_clip_rule: modelConfig.uncertainty_interval_clip_rule,
    interval_clip_bounds: modelConfig.interval_clip_bounds,
  };
  validateWaterPhysicalBoundPolicyV1(policy, hydraulic.saturation_fraction);
  return policy;
}

export function validateBootstrapWaterPosteriorOutputV1(output: BootstrapWaterPosteriorOutputV1): void {
  const confidence = output.posterior_state.confidence as Readonly<Record<string, unknown>>;
  if (
    confidence.status !== "NOT_ESTABLISHED"
    || confidence.reason_code !== "NO_CALIBRATED_CONFIDENCE_MODEL"
    || "score" in confidence
  ) throw new Error("STATE_CONFIDENCE_CONTRACT_VIOLATION");
  const eligibility = output.posterior_state.use_eligibility as Readonly<Record<string, unknown>>;
  if (
    eligibility.state_valid !== true
    || eligibility.posterior_chain_eligible !== true
    || eligibility.forecast_source_eligible !== true
    || eligibility.recommendation_input_eligible !== false
    || eligibility.action_input_eligible !== false
  ) throw new Error("STATE_ELIGIBILITY_CONTRACT_VIOLATION");
  if (output.observation_operator.direct_state_equivalence !== false) throw new Error("DIRECT_STATE_EQUIVALENCE_FORBIDDEN");
  const vwc = output.posterior_state.root_zone_volumetric_water_content_fraction as Readonly<Record<string, unknown>>;
  const uncertainty = vwc.uncertainty as Readonly<Record<string, unknown>> | undefined;
  if (!uncertainty || uncertainty.physical_bound_version !== "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1") throw new Error("PHYSICAL_BOUND_VERSION_MISMATCH");
  if (uncertainty.gaussian_interval_rule !== "NORMAL_95_Z_1_96_V1") throw new Error("GAUSSIAN_INTERVAL_RULE_MISMATCH");
  if (uncertainty.uncertainty_interval_clip_rule !== "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1") throw new Error("UNCERTAINTY_INTERVAL_CLIP_RULE_MISMATCH");
}

export function computeRootZoneWaterBootstrapPosteriorV1(input: BootstrapWaterPosteriorInputV1): BootstrapWaterPosteriorOutputV1 {
  if (input.observation === null) throw new Error("MISSING_OBSERVATION");
  validateSoilHydraulicConfigurationV1(input.hydraulic_configuration);
  validateObservationFractionV1(input.observation.value_fraction);
  if (input.observation.direct_state_equivalence !== false) throw new Error("DIRECT_STATE_EQUIVALENCE_FORBIDDEN");
  const modelConfig = input.model_config ?? MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1;
  const physicalBoundPolicy = validateModelConfigV1(modelConfig, input.hydraulic_configuration);
  const prior = computeWeakBootstrapWaterPriorV1(input.hydraulic_configuration);
  const operator = applyRootZoneObservationOperatorV1(prior.mean);
  const assimilation = assimilateScalarGaussianObservationV1({
    prior_mean: prior.mean,
    prior_variance: prior.variance,
    observation: input.observation.value_fraction,
    h: operator.h,
    sensor_measurement_stddev_fraction: modelConfig.sensor_measurement_stddev_fraction,
    point_to_zone_representativeness_stddev_fraction: modelConfig.point_to_zone_representativeness_stddev_fraction,
    quality_status: input.observation.quality_status,
    quality_weights: modelConfig.quality_weights,
  });
  const posteriorStddev = Math.sqrt(assimilation.posterior_variance);
  validatePosteriorPhysicalStateV1({
    posterior_mean: assimilation.posterior_mean,
    posterior_variance: assimilation.posterior_variance,
    posterior_stddev: posteriorStddev,
    saturation_fraction: input.hydraulic_configuration.saturation_fraction,
  });
  const decimals = modelConfig.numeric_output_decimals;
  const interval = buildClippedGaussianIntervalV1({
    mean: assimilation.posterior_mean,
    stddev: posteriorStddev,
    saturation_fraction: input.hydraulic_configuration.saturation_fraction,
    decimals,
    policy: physicalBoundPolicy,
  });
  const storageMean = assimilation.posterior_mean * input.hydraulic_configuration.root_zone_depth_mm;
  const storageStddev = posteriorStddev * input.hydraulic_configuration.root_zone_depth_mm;
  const storageIntervalLow = Math.max(0, assimilation.posterior_mean - 1.96 * posteriorStddev) * input.hydraulic_configuration.root_zone_depth_mm;
  const storageIntervalHigh = Math.min(input.hydraulic_configuration.saturation_fraction, assimilation.posterior_mean + 1.96 * posteriorStddev) * input.hydraulic_configuration.root_zone_depth_mm;
  const availableWaterFractionRaw = (
    assimilation.posterior_mean - input.hydraulic_configuration.wilting_point_fraction
  ) / (
    input.hydraulic_configuration.field_capacity_fraction - input.hydraulic_configuration.wilting_point_fraction
  );
  const fieldCapacityStorage = input.hydraulic_configuration.field_capacity_fraction * input.hydraulic_configuration.root_zone_depth_mm;
  const depletion = Math.max(0, fieldCapacityStorage - storageMean);
  const uncertainty = {
    distribution_family: "GAUSSIAN_APPROXIMATION",
    primary_measure: "STANDARD_DEVIATION",
    interval_level: interval.interval_level,
    mean: round(assimilation.posterior_mean, decimals),
    variance: round(assimilation.posterior_variance, decimals),
    stddev: round(posteriorStddev, decimals),
    interval_low: interval.interval_low,
    interval_high: interval.interval_high,
    unclipped_interval: interval.unclipped_interval,
    interval_clipped: interval.interval_clipped,
    clipping_metadata: interval.clipping_metadata,
    physical_bound_version: modelConfig.physical_bound_version,
    gaussian_interval_rule: modelConfig.gaussian_interval_rule,
    uncertainty_interval_clip_rule: modelConfig.uncertainty_interval_clip_rule,
    uncertainty_sources: [...UNCERTAINTY_SOURCES_V1],
  } as const;
  const output: BootstrapWaterPosteriorOutputV1 = {
    model_component_id: modelConfig.model_component_id,
    latent_variable: "ROOT_ZONE_VOLUMETRIC_WATER_CONTENT_FRACTION",
    bootstrap_prior: {
      rule_id: prior.rule_id,
      distribution_family: prior.distribution_family,
      mean: round(prior.mean, decimals),
      variance: round(prior.variance, decimals),
      stddev: round(prior.stddev, decimals),
    },
    observation_operator: {
      observation_operator_id: operator.observation_operator_id,
      h: operator.h,
      direct_state_equivalence: operator.direct_state_equivalence,
    },
    assimilation_update: {
      method_id: assimilation.method_id,
      observation_ref: input.observation.observation_ref,
      quality_status: assimilation.quality_status,
      disposition: assimilation.disposition,
      prior_mean: round(prior.mean, decimals),
      prior_variance: round(prior.variance, decimals),
      predicted_observation: round(assimilation.predicted_observation, decimals),
      actual_observation: round(assimilation.actual_observation, decimals),
      innovation: round(assimilation.innovation, decimals),
      sensor_variance: round(assimilation.sensor_variance, decimals),
      representativeness_variance: round(assimilation.representativeness_variance, decimals),
      base_observation_variance: round(assimilation.base_observation_variance, decimals),
      quality_weight: round(assimilation.quality_weight, decimals),
      effective_observation_variance: round(assimilation.effective_observation_variance, decimals),
      assimilation_gain: round(assimilation.assimilation_gain, decimals),
      posterior_mean: round(assimilation.posterior_mean, decimals),
      posterior_variance: round(assimilation.posterior_variance, decimals),
    },
    posterior_state: {
      root_zone_volumetric_water_content_fraction: {
        quantity_kind: "VOLUMETRIC_WATER_CONTENT",
        unit: "fraction",
        mean: round(assimilation.posterior_mean, decimals),
        variance: round(assimilation.posterior_variance, decimals),
        stddev: round(posteriorStddev, decimals),
        interval_low: interval.interval_low,
        interval_high: interval.interval_high,
        uncertainty,
      },
      root_zone_water_storage_mm: {
        quantity_kind: "ROOT_ZONE_WATER_STORAGE",
        unit: "mm",
        mean: round(storageMean, decimals),
        stddev: round(storageStddev, decimals),
        interval_low: round(storageIntervalLow, decimals),
        interval_high: round(storageIntervalHigh, decimals),
        unclipped_interval: {
          low: round((assimilation.posterior_mean - 1.96 * posteriorStddev) * input.hydraulic_configuration.root_zone_depth_mm, decimals),
          high: round((assimilation.posterior_mean + 1.96 * posteriorStddev) * input.hydraulic_configuration.root_zone_depth_mm, decimals),
        },
        interval_clipped: interval.interval_clipped,
      },
      available_water_fraction: round(clampUnitIntervalV1(availableWaterFractionRaw), decimals),
      root_zone_depletion_from_field_capacity_mm: round(depletion, decimals),
      surface_soil_moisture_state: { status: "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION" },
      water_stress_state: { status: "NOT_ESTABLISHED_NO_STRESS_MODEL" },
      drainage_state: { status: "NOT_ESTABLISHED_MCFT_06_NOT_STARTED" },
      confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
      use_eligibility: {
        state_valid: true,
        posterior_chain_eligible: true,
        forecast_source_eligible: true,
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    },
    limitations: [
      "CONTROLLED_SYNTHETIC",
      "NOT_FIELD_CALIBRATED",
      "SINGLE_OBSERVATION_BOOTSTRAP",
      "POINT_TO_ZONE_REPRESENTATIVENESS_UNCERTAINTY_RETAINED",
      "NO_SURFACE_STATE",
      "NO_STRESS_MODEL",
      "NO_PROPAGATION_MODEL",
    ],
  };
  validateBootstrapWaterPosteriorOutputV1(output);
  return output;
}
