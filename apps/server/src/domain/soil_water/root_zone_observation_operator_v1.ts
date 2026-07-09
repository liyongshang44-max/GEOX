// apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts
// Purpose: apply the frozen H=1 static observation operator from root-zone mean VWC to the expected 200 mm point observation.
// Boundary: pure deterministic mathematics; representativeness uncertainty remains separate and direct State equivalence remains false.

export const ROOT_ZONE_POINT_OBSERVATION_OPERATOR_ID_V1 = "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1" as const;
export const ROOT_ZONE_POINT_OBSERVATION_H_V1 = 1;

export type RootZoneObservationOperatorResultV1 = Readonly<{
  observation_operator_id: typeof ROOT_ZONE_POINT_OBSERVATION_OPERATOR_ID_V1;
  h: 1;
  direct_state_equivalence: false;
  predicted_observation: number;
}>;

export function applyRootZoneObservationOperatorV1(priorMean: number): RootZoneObservationOperatorResultV1 {
  if (!Number.isFinite(priorMean)) throw new Error("INVALID_PRIOR_MEAN");
  return {
    observation_operator_id: ROOT_ZONE_POINT_OBSERVATION_OPERATOR_ID_V1,
    h: ROOT_ZONE_POINT_OBSERVATION_H_V1,
    direct_state_equivalence: false,
    predicted_observation: ROOT_ZONE_POINT_OBSERVATION_H_V1 * priorMean,
  };
}
