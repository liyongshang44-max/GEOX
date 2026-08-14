// Purpose: preserve signed canonical ET0 while projecting it into the nonnegative water-loss demand consumed by bounded Stage-1B soil-water kernels.
// Boundary: pure External Formal model-consumption adapter only; no source/canonical mutation, persistence, provider fetch, clock, crop authority, or condensation/dew water-gain modeling.

export const MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1 =
  "MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1" as const;

export const MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1 =
  "NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED" as const;

export type ExternalFormalEt0ConsumptionProjectionV1 = {
  canonical_signed_et0_mm: number;
  model_water_loss_demand_mm: number;
  transformation_applied: boolean;
  transformation_ref: typeof MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1;
  limitations: Array<typeof MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1>;
};

export function projectSignedEt0ToNonnegativeWaterLossDemandV1(
  canonicalSignedEt0Mm: unknown,
  code = "EXTERNAL_FORMAL_SIGNED_ET0_REQUIRED",
): ExternalFormalEt0ConsumptionProjectionV1 {
  if (typeof canonicalSignedEt0Mm !== "number" || !Number.isFinite(canonicalSignedEt0Mm)) throw new Error(code);
  const negative = canonicalSignedEt0Mm < 0;
  return {
    canonical_signed_et0_mm: canonicalSignedEt0Mm,
    model_water_loss_demand_mm: negative ? 0 : canonicalSignedEt0Mm,
    transformation_applied: negative,
    transformation_ref: MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1,
    limitations: negative ? [MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1] : [],
  };
}