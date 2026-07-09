// apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts
// Purpose: validate one governed 200 mm point observation and derive its effective variance under the frozen H=1 operator.
// Boundary: pure domain mathematics only; no Evidence lookup, source release, persistence, I/O, clock, or Runtime orchestration.

import { requireFiniteNumberV1, validateObservationFractionV1 } from "../twin_runtime/physical_bounds_v1.js";

export const ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1 = "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1" as const;
export type ObservationQualityStatusV1 = "PASS" | "LIMITED" | "FAIL";

export type RootZoneObservationOperatorInputV1 = {
  observation_fraction: unknown;
  quality_status: unknown;
  sensor_measurement_stddev_fraction: unknown;
  point_to_zone_representativeness_stddev_fraction: unknown;
  quality_weights: Readonly<Record<ObservationQualityStatusV1, number>>;
};

export type RootZoneObservationOperatorResultV1 = {
  observation_operator_id: typeof ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1;
  observation_operator_h: 1;
  direct_state_equivalence: false;
  observation_fraction: number;
  quality_status: Exclude<ObservationQualityStatusV1, "FAIL">;
  quality_weight: number;
  sensor_variance: number;
  representativeness_variance: number;
  base_observation_variance: number;
  effective_observation_variance: number;
};

function validateQualityStatusV1(value: unknown): ObservationQualityStatusV1 {
  if (value !== "PASS" && value !== "LIMITED" && value !== "FAIL") throw new Error("INVALID_OBSERVATION_QUALITY_STATUS");
  return value;
}

export function buildRootZoneObservationOperatorV1(input: RootZoneObservationOperatorInputV1): RootZoneObservationOperatorResultV1 {
  const observation = validateObservationFractionV1(input.observation_fraction);
  const qualityStatus = validateQualityStatusV1(input.quality_status);
  if (qualityStatus === "FAIL") throw new Error("QUALITY_FAIL_OBSERVATION_REJECTED");
  const sensorStddev = requireFiniteNumberV1(input.sensor_measurement_stddev_fraction, "SENSOR_STDDEV_REQUIRED", "SENSOR_STDDEV_NON_FINITE");
  const representativenessStddev = requireFiniteNumberV1(input.point_to_zone_representativeness_stddev_fraction, "REPRESENTATIVENESS_STDDEV_REQUIRED", "REPRESENTATIVENESS_STDDEV_NON_FINITE");
  if (sensorStddev < 0) throw new Error("NEGATIVE_SENSOR_STDDEV");
  if (representativenessStddev < 0) throw new Error("NEGATIVE_REPRESENTATIVENESS_STDDEV");
  const qualityWeight = requireFiniteNumberV1(input.quality_weights?.[qualityStatus], "QUALITY_WEIGHT_REQUIRED", "QUALITY_WEIGHT_NON_FINITE");
  if (qualityWeight <= 0) throw new Error("INVALID_QUALITY_WEIGHT");
  const sensorVariance = sensorStddev ** 2;
  const representativenessVariance = representativenessStddev ** 2;
  const baseObservationVariance = sensorVariance + representativenessVariance;
  return {
    observation_operator_id: ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1,
    observation_operator_h: 1,
    direct_state_equivalence: false,
    observation_fraction: observation,
    quality_status: qualityStatus,
    quality_weight: qualityWeight,
    sensor_variance: sensorVariance,
    representativeness_variance: representativenessVariance,
    base_observation_variance: baseObservationVariance,
    effective_observation_variance: baseObservationVariance / qualityWeight,
  };
}
