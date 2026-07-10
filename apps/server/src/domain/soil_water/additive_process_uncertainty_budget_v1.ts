// apps/server/src/domain/soil_water/additive_process_uncertainty_budget_v1.ts
// Purpose: propagate the frozen MCFT-CAP-02 additive process uncertainty budget with exact fixed-point variance authority.
// Boundary: pure domain math only; no observation assimilation, covariance estimation, persistence, I/O, or Runtime orchestration.

import {
  WATER_AMOUNT_SCALE_V1,
  WATER_VARIANCE_SCALE_V1,
  clampFixedUnitsV1,
  divideFixedUnitsV1,
  formatFixedDecimalV1,
  multiplyFixedUnitsV1,
  parseFixedDecimalV1,
  requireNonNegativeFixedUnitsV1,
  squareScale6ToScale12V1,
  sqrtScale12ToScale6V1,
} from "./fixed_point_water_decimal_v1.js";

export const ADDITIVE_PROCESS_UNCERTAINTY_POLICY_ID_V1 = "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1" as const;
export const ADDITIVE_PROCESS_UNCERTAINTY_COVARIANCE_POLICY_V1 = "ZERO_COVARIANCE_CONTROLLED_ASSUMPTION_V1" as const;
export const GAUSSIAN_APPROXIMATION_INTERVAL_POLICY_V1 = "GAUSSIAN_APPROXIMATION_95_INTERVAL_CLIPPED_TO_PHYSICAL_VWC_V1" as const;

export type PreviousStorageVarianceBasisV1 =
  | {
      basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1";
      source_posterior_ref: string;
      source_vwc_variance: string;
    }
  | {
      basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE";
      previous_state_ref: string;
      previous_storage_variance_mm2_decimal: string;
    };

export type AdditiveProcessUncertaintyInputV1 = {
  previous_variance_basis: PreviousStorageVarianceBasisV1;
  root_zone_depth_mm: string;
  saturation_fraction: string;
  next_storage_mean_mm: string;
  gross_rainfall_mm: string;
  requested_crop_et_mm: string;
  effective_irrigation_mm: string;
  rainfall_relative_stddev: string;
  crop_et_relative_stddev: string;
  executed_irrigation_relative_stddev: string;
  structural_process_stddev_mm_per_hour: string;
};

export type AdditiveProcessUncertaintyBudgetV1 = {
  policy_id: typeof ADDITIVE_PROCESS_UNCERTAINTY_POLICY_ID_V1;
  policy_version: 1;
  covariance_policy: typeof ADDITIVE_PROCESS_UNCERTAINTY_COVARIANCE_POLICY_V1;
  physical_clipping_reduces_latent_variance: false;
  previous_variance_basis: PreviousStorageVarianceBasisV1;
  previous_storage_variance_mm2: string;
  rainfall_variance_mm2: string;
  crop_et_variance_mm2: string;
  irrigation_variance_mm2: string;
  structural_variance_mm2: string;
  next_storage_variance_mm2: string;
  next_storage_stddev_mm: string;
  next_vwc_variance: string;
  next_vwc_stddev: string;
  interval: {
    interval_level: "0.950000";
    interval_policy_id: typeof GAUSSIAN_APPROXIMATION_INTERVAL_POLICY_V1;
    raw_lower: string;
    raw_upper: string;
    published_lower: string;
    published_upper: string;
    clipping_applied: boolean;
    clipping_lower_bound: "0.000000";
    clipping_upper_bound: string;
  };
};

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export function resolvePreviousStorageVarianceV1(
  basis: PreviousStorageVarianceBasisV1,
  rootZoneDepthMm: string,
): bigint {
  const rootDepthUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(rootZoneDepthMm, WATER_AMOUNT_SCALE_V1, "UNCERTAINTY_ROOT_DEPTH_REQUIRED"),
    "UNCERTAINTY_ROOT_DEPTH_NEGATIVE",
  );
  if (rootDepthUnits === 0n) throw new Error("UNCERTAINTY_ROOT_DEPTH_ZERO");

  if (basis.basis_origin === "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1") {
    requireStringV1(basis.source_posterior_ref, "UNCERTAINTY_SOURCE_POSTERIOR_REF_REQUIRED");
    const sourceVwcVarianceUnits = requireNonNegativeFixedUnitsV1(
      parseFixedDecimalV1(basis.source_vwc_variance, WATER_VARIANCE_SCALE_V1, "UNCERTAINTY_SOURCE_VWC_VARIANCE_REQUIRED"),
      "UNCERTAINTY_SOURCE_VWC_VARIANCE_NEGATIVE",
    );
    const rootDepthSquaredUnits = squareScale6ToScale12V1(rootDepthUnits);
    return multiplyFixedUnitsV1(
      sourceVwcVarianceUnits,
      WATER_VARIANCE_SCALE_V1,
      rootDepthSquaredUnits,
      WATER_VARIANCE_SCALE_V1,
      WATER_VARIANCE_SCALE_V1,
    );
  }

  requireStringV1(basis.previous_state_ref, "UNCERTAINTY_PREVIOUS_STATE_REF_REQUIRED");
  if (Object.prototype.hasOwnProperty.call(basis, "source_vwc_variance")) {
    throw new Error("CONTINUATION_SUBSEQUENT_TICK_VARIANCE_REDERIVATION_FORBIDDEN");
  }
  return requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(
      basis.previous_storage_variance_mm2_decimal,
      WATER_VARIANCE_SCALE_V1,
      "UNCERTAINTY_PREVIOUS_STORAGE_VARIANCE_REQUIRED",
    ),
    "UNCERTAINTY_PREVIOUS_STORAGE_VARIANCE_NEGATIVE",
  );
}

function varianceFromRelativeStddevV1(amount: string, relativeStddev: string): bigint {
  const amountUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(amount, WATER_AMOUNT_SCALE_V1),
    "UNCERTAINTY_INPUT_AMOUNT_NEGATIVE",
  );
  const relativeUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(relativeStddev, WATER_AMOUNT_SCALE_V1),
    "UNCERTAINTY_RELATIVE_STDDEV_NEGATIVE",
  );
  const standardDeviationUnits = multiplyFixedUnitsV1(
    amountUnits,
    WATER_AMOUNT_SCALE_V1,
    relativeUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  return squareScale6ToScale12V1(standardDeviationUnits);
}

export function buildAdditiveProcessUncertaintyBudgetV1(
  input: AdditiveProcessUncertaintyInputV1,
): AdditiveProcessUncertaintyBudgetV1 {
  const rootDepthUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.root_zone_depth_mm, WATER_AMOUNT_SCALE_V1, "UNCERTAINTY_ROOT_DEPTH_REQUIRED"),
    "UNCERTAINTY_ROOT_DEPTH_NEGATIVE",
  );
  if (rootDepthUnits === 0n) throw new Error("UNCERTAINTY_ROOT_DEPTH_ZERO");
  const saturationUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.saturation_fraction, WATER_AMOUNT_SCALE_V1, "UNCERTAINTY_SATURATION_REQUIRED"),
    "UNCERTAINTY_SATURATION_NEGATIVE",
  );
  const nextStorageUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(input.next_storage_mean_mm, WATER_AMOUNT_SCALE_V1, "UNCERTAINTY_NEXT_STORAGE_REQUIRED"),
    "UNCERTAINTY_NEXT_STORAGE_NEGATIVE",
  );
  const previousVarianceUnits = resolvePreviousStorageVarianceV1(input.previous_variance_basis, input.root_zone_depth_mm);
  const rainfallVarianceUnits = varianceFromRelativeStddevV1(input.gross_rainfall_mm, input.rainfall_relative_stddev);
  const cropEtVarianceUnits = varianceFromRelativeStddevV1(input.requested_crop_et_mm, input.crop_et_relative_stddev);
  const irrigationVarianceUnits = varianceFromRelativeStddevV1(input.effective_irrigation_mm, input.executed_irrigation_relative_stddev);
  const structuralStddevUnits = requireNonNegativeFixedUnitsV1(
    parseFixedDecimalV1(
      input.structural_process_stddev_mm_per_hour,
      WATER_AMOUNT_SCALE_V1,
      "UNCERTAINTY_STRUCTURAL_STDDEV_REQUIRED",
    ),
    "UNCERTAINTY_STRUCTURAL_STDDEV_NEGATIVE",
  );
  if (structuralStddevUnits === 0n) throw new Error("UNCERTAINTY_STRUCTURAL_STDDEV_ZERO_FORBIDDEN");
  const structuralVarianceUnits = squareScale6ToScale12V1(structuralStddevUnits);
  const nextVarianceUnits = previousVarianceUnits
    + rainfallVarianceUnits
    + cropEtVarianceUnits
    + irrigationVarianceUnits
    + structuralVarianceUnits;
  if (nextVarianceUnits <= previousVarianceUnits) throw new Error("UNCERTAINTY_VARIANCE_MUST_INCREASE_WITHOUT_ASSIMILATION");

  const rootDepthSquaredUnits = squareScale6ToScale12V1(rootDepthUnits);
  const nextVwcVarianceUnits = divideFixedUnitsV1(
    nextVarianceUnits,
    WATER_VARIANCE_SCALE_V1,
    rootDepthSquaredUnits,
    WATER_VARIANCE_SCALE_V1,
    WATER_VARIANCE_SCALE_V1,
  );
  const storageStddevUnits = sqrtScale12ToScale6V1(nextVarianceUnits);
  const vwcStddevUnits = sqrtScale12ToScale6V1(nextVwcVarianceUnits);
  const nextVwcMeanUnits = divideFixedUnitsV1(
    nextStorageUnits,
    WATER_AMOUNT_SCALE_V1,
    rootDepthUnits,
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const marginUnits = multiplyFixedUnitsV1(
    vwcStddevUnits,
    WATER_AMOUNT_SCALE_V1,
    parseFixedDecimalV1("1.960000", WATER_AMOUNT_SCALE_V1),
    WATER_AMOUNT_SCALE_V1,
    WATER_AMOUNT_SCALE_V1,
  );
  const rawLowerUnits = nextVwcMeanUnits - marginUnits;
  const rawUpperUnits = nextVwcMeanUnits + marginUnits;
  const publishedLowerUnits = clampFixedUnitsV1(rawLowerUnits, 0n, saturationUnits);
  const publishedUpperUnits = clampFixedUnitsV1(rawUpperUnits, 0n, saturationUnits);

  return {
    policy_id: ADDITIVE_PROCESS_UNCERTAINTY_POLICY_ID_V1,
    policy_version: 1,
    covariance_policy: ADDITIVE_PROCESS_UNCERTAINTY_COVARIANCE_POLICY_V1,
    physical_clipping_reduces_latent_variance: false,
    previous_variance_basis: { ...input.previous_variance_basis },
    previous_storage_variance_mm2: formatFixedDecimalV1(previousVarianceUnits, WATER_VARIANCE_SCALE_V1),
    rainfall_variance_mm2: formatFixedDecimalV1(rainfallVarianceUnits, WATER_VARIANCE_SCALE_V1),
    crop_et_variance_mm2: formatFixedDecimalV1(cropEtVarianceUnits, WATER_VARIANCE_SCALE_V1),
    irrigation_variance_mm2: formatFixedDecimalV1(irrigationVarianceUnits, WATER_VARIANCE_SCALE_V1),
    structural_variance_mm2: formatFixedDecimalV1(structuralVarianceUnits, WATER_VARIANCE_SCALE_V1),
    next_storage_variance_mm2: formatFixedDecimalV1(nextVarianceUnits, WATER_VARIANCE_SCALE_V1),
    next_storage_stddev_mm: formatFixedDecimalV1(storageStddevUnits, WATER_AMOUNT_SCALE_V1),
    next_vwc_variance: formatFixedDecimalV1(nextVwcVarianceUnits, WATER_VARIANCE_SCALE_V1),
    next_vwc_stddev: formatFixedDecimalV1(vwcStddevUnits, WATER_AMOUNT_SCALE_V1),
    interval: {
      interval_level: "0.950000",
      interval_policy_id: GAUSSIAN_APPROXIMATION_INTERVAL_POLICY_V1,
      raw_lower: formatFixedDecimalV1(rawLowerUnits, WATER_AMOUNT_SCALE_V1),
      raw_upper: formatFixedDecimalV1(rawUpperUnits, WATER_AMOUNT_SCALE_V1),
      published_lower: formatFixedDecimalV1(publishedLowerUnits, WATER_AMOUNT_SCALE_V1),
      published_upper: formatFixedDecimalV1(publishedUpperUnits, WATER_AMOUNT_SCALE_V1),
      clipping_applied: rawLowerUnits !== publishedLowerUnits || rawUpperUnits !== publishedUpperUnits,
      clipping_lower_bound: "0.000000",
      clipping_upper_bound: formatFixedDecimalV1(saturationUnits, WATER_AMOUNT_SCALE_V1),
    },
  };
}
