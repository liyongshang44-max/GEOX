import {
  TELEMETRY_METRIC_CATALOG_V1,
  isTelemetryMetricNameV1,
  isValidTelemetryUnitV1,
  toCanonicalTelemetryMetricNameV1,
  type TelemetryMetricNameV1,
} from "@geox/contracts";

/**
 * B-04a shared physical-QC classifier.
 *
 * Authority boundary:
 * - Reuses TELEMETRY_METRIC_CATALOG_V1 as the existing metric/unit/hard-bound source.
 * - Does not invent agronomic plausible ranges.
 * - Does not mutate or discard raw evidence.
 * - Does not decide freshness/source/spatial/conflict authority.
 * - Does not emit Decision Eligibility or action-level BLOCK/PASS.
 */

export type PhysicalQcMeasurementHealthV1 = "VALID" | "INVALID" | "UNKNOWN";
export type PhysicalQcValidityV1 = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
export type PhysicalQcCatalogStatusV1 = "CATALOGUED" | "UNSUPPORTED_METRIC";

export type PhysicalQcReasonCodeV1 =
  | "PHYSICAL_QC_OK"
  | "PHYSICAL_QC_MISSING_VALUE"
  | "PHYSICAL_QC_NON_NUMERIC_VALUE"
  | "PHYSICAL_QC_NON_FINITE_VALUE"
  | "PHYSICAL_QC_UNSUPPORTED_METRIC"
  | "PHYSICAL_QC_UNIT_REQUIRED"
  | "PHYSICAL_QC_UNIT_UNQUALIFIED"
  | "PHYSICAL_QC_BELOW_HARD_MIN"
  | "PHYSICAL_QC_ABOVE_HARD_MAX";

export type PhysicalQcResultV1 = {
  input_metric: string;
  canonical_metric: TelemetryMetricNameV1 | null;
  catalog_status: PhysicalQcCatalogStatusV1;
  input_value: unknown;
  numeric_value: number | null;
  input_unit: string | null;
  canonical_unit: string | null;
  hard_min: number | null;
  hard_max: number | null;
  measurement_health: PhysicalQcMeasurementHealthV1;
  physical_validity: PhysicalQcValidityV1;
  reason_codes: PhysicalQcReasonCodeV1[];
};

function normalizeMetricInput(metric: unknown): string {
  return String(metric ?? "").trim();
}

function normalizeUnitInput(unit: unknown): string | null {
  if (typeof unit !== "string") return null;
  const normalized = unit.trim();
  return normalized ? normalized : null;
}

function baseUnsupportedResult(metric: string, value: unknown, unit: string | null): PhysicalQcResultV1 {
  return {
    input_metric: metric,
    canonical_metric: null,
    catalog_status: "UNSUPPORTED_METRIC",
    input_value: value,
    numeric_value: null,
    input_unit: unit,
    canonical_unit: null,
    hard_min: null,
    hard_max: null,
    measurement_health: "UNKNOWN",
    physical_validity: "NOT_APPLICABLE",
    reason_codes: ["PHYSICAL_QC_UNSUPPORTED_METRIC"],
  };
}

/**
 * Classify only hard physical/contract validity dimensions that are provable
 * from the existing telemetry metric catalog.
 *
 * Unknown metric/unit cases remain UNKNOWN rather than being guessed into a
 * canonical measurement. Missing values remain missing; no fallback number is
 * introduced by this function.
 */
export function classifyPhysicalMeasurementV1(input: {
  metric: unknown;
  value: unknown;
  unit?: unknown;
}): PhysicalQcResultV1 {
  const inputMetric = normalizeMetricInput(input.metric);
  const inputUnit = normalizeUnitInput(input.unit);
  const normalizedMetric = toCanonicalTelemetryMetricNameV1(inputMetric);

  if (!isTelemetryMetricNameV1(normalizedMetric)) {
    return baseUnsupportedResult(inputMetric, input.value, inputUnit);
  }

  const metric = normalizedMetric;
  const spec = TELEMETRY_METRIC_CATALOG_V1[metric];
  const base = {
    input_metric: inputMetric,
    canonical_metric: metric,
    catalog_status: "CATALOGUED" as const,
    input_value: input.value,
    input_unit: inputUnit,
    canonical_unit: spec.unit,
    hard_min: spec.min,
    hard_max: spec.max,
  };

  if (input.value == null || (typeof input.value === "string" && !input.value.trim())) {
    return {
      ...base,
      numeric_value: null,
      measurement_health: "UNKNOWN",
      physical_validity: "UNKNOWN",
      reason_codes: ["PHYSICAL_QC_MISSING_VALUE"],
    };
  }

  let numericValue: number;
  if (typeof input.value === "number") {
    if (!Number.isFinite(input.value)) {
      return {
        ...base,
        numeric_value: null,
        measurement_health: "INVALID",
        physical_validity: "FAIL",
        reason_codes: ["PHYSICAL_QC_NON_FINITE_VALUE"],
      };
    }
    numericValue = input.value;
  } else if (typeof input.value === "string") {
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) {
      return {
        ...base,
        numeric_value: null,
        measurement_health: "INVALID",
        physical_validity: "FAIL",
        reason_codes: ["PHYSICAL_QC_NON_NUMERIC_VALUE"],
      };
    }
    numericValue = parsed;
  } else {
    return {
      ...base,
      numeric_value: null,
      measurement_health: "INVALID",
      physical_validity: "FAIL",
      reason_codes: ["PHYSICAL_QC_NON_NUMERIC_VALUE"],
    };
  }

  if (inputUnit == null) {
    return {
      ...base,
      numeric_value: numericValue,
      measurement_health: "UNKNOWN",
      physical_validity: "UNKNOWN",
      reason_codes: ["PHYSICAL_QC_UNIT_REQUIRED"],
    };
  }

  if (!isValidTelemetryUnitV1(metric, inputUnit)) {
    return {
      ...base,
      numeric_value: numericValue,
      measurement_health: "UNKNOWN",
      physical_validity: "UNKNOWN",
      reason_codes: ["PHYSICAL_QC_UNIT_UNQUALIFIED"],
    };
  }

  if (numericValue < spec.min) {
    return {
      ...base,
      numeric_value: numericValue,
      measurement_health: "INVALID",
      physical_validity: "FAIL",
      reason_codes: ["PHYSICAL_QC_BELOW_HARD_MIN"],
    };
  }

  if (numericValue > spec.max) {
    return {
      ...base,
      numeric_value: numericValue,
      measurement_health: "INVALID",
      physical_validity: "FAIL",
      reason_codes: ["PHYSICAL_QC_ABOVE_HARD_MAX"],
    };
  }

  return {
    ...base,
    numeric_value: numericValue,
    measurement_health: "VALID",
    physical_validity: "PASS",
    reason_codes: ["PHYSICAL_QC_OK"],
  };
}
