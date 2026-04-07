import {
  inferFertilityFromObservationAggregateV1 as inferFertilityCoreV1,
  type FertilityInferenceV1Result,
  type FertilityLevelV1,
  type RecommendationBiasV1,
  type SalinityRiskV1,
  type SensingObservationAggregateV1,
} from "@geox/device-skills";

export type {
  FertilityInferenceV1Result,
  FertilityLevelV1,
  RecommendationBiasV1,
  SalinityRiskV1,
  SensingObservationAggregateV1,
};

export function inferFertilityFromObservationAggregateV1(input: SensingObservationAggregateV1): FertilityInferenceV1Result {
  return inferFertilityCoreV1(input);
}
