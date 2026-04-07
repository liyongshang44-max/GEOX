import {
  inferFertilityFromDeviceObservationV1 as inferFertilityFromDeviceObservationCoreV1,
  inferFertilityFromObservationAggregateV1 as inferFertilityFromObservationAggregateCoreV1,
  type DeviceObservationV1Input,
  type SensingObservationAggregateV1,
} from "@geox/device-skills";
import type {
  FertilityInferenceV1Result,
  FertilityLevelV1,
  RecommendationBiasV1,
  SalinityRiskV1,
} from "@geox/contracts";

export type {
  DeviceObservationV1Input,
  FertilityInferenceV1Result,
  FertilityLevelV1,
  RecommendationBiasV1,
  SalinityRiskV1,
  SensingObservationAggregateV1,
};

/**
 * Server entry keeps a thin boundary to device-skills to avoid rule forks.
 */
export function inferFertilityFromDeviceObservationV1(input: DeviceObservationV1Input): FertilityInferenceV1Result {
  return inferFertilityFromDeviceObservationCoreV1(input);
}

/**
 * Aggregate entry is preserved for route-level callers that already normalize inputs.
 */
export function inferFertilityFromObservationAggregateV1(input: SensingObservationAggregateV1): FertilityInferenceV1Result {
  return inferFertilityFromObservationAggregateCoreV1(input);
}
