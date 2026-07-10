// apps/server/src/domain/soil_water/water_mass_balance_trace_v1.ts
// Purpose: construct, validate, and hash the exact MCFT-CAP-02 hourly water mass-balance trace.
// Boundary: pure domain trace logic only; no persistence, Evidence selection, Runtime orchestration, or canonical object write.

import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  formatFixedDecimalV1,
  parseFixedDecimalV1,
} from "./fixed_point_water_decimal_v1.js";
import type { ExecutedIrrigationTraceEventV1 } from "./executed_irrigation_input_v1.js";

export const WATER_MASS_BALANCE_TRACE_SCHEMA_V1 = "mcft_cap_02_water_mass_balance_trace_v1" as const;

export type WaterMassBalanceTraceV1 = {
  schema_version: typeof WATER_MASS_BALANCE_TRACE_SCHEMA_V1;
  previous_storage_mm: string;
  gross_rainfall_mm: string;
  surface_runoff_mm: string;
  effective_rainfall_mm: string;
  execution_events: ExecutedIrrigationTraceEventV1[];
  effective_irrigation_mm: string;
  reference_et0_mm: string;
  crop_stage_code: string;
  kc: string;
  requested_crop_et_mm: string;
  actual_crop_et_mm: string;
  unmet_crop_et_mm: string;
  storage_before_drainage_mm: string;
  drainage_mm: string;
  storage_after_drainage_mm: string;
  saturation_overflow_mm: string;
  next_storage_mm: string;
  mass_balance_error_mm: "0.000000";
};

const FORBIDDEN_SELF_HASH_KEYS_V1 = new Set([
  "trace_determinism_hash",
  "mass_balance_trace_hash",
  "self_hash",
]);

function rejectRecursiveSelfHashV1(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(rejectRecursiveSelfHashV1);
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SELF_HASH_KEYS_V1.has(key)) throw new Error(`WATER_MASS_BALANCE_TRACE_SELF_HASH_FORBIDDEN:${key}`);
    rejectRecursiveSelfHashV1(nested);
  }
}

function normalizeAmountV1(value: unknown, code: string): string {
  return formatFixedDecimalV1(parseFixedDecimalV1(value, WATER_AMOUNT_SCALE_V1, code), WATER_AMOUNT_SCALE_V1);
}

export function buildWaterMassBalanceTraceV1(input: Omit<WaterMassBalanceTraceV1, "schema_version" | "mass_balance_error_mm">): {
  trace: WaterMassBalanceTraceV1;
  mass_balance_trace_hash: string;
} {
  rejectRecursiveSelfHashV1(input);
  const trace: WaterMassBalanceTraceV1 = {
    schema_version: WATER_MASS_BALANCE_TRACE_SCHEMA_V1,
    previous_storage_mm: normalizeAmountV1(input.previous_storage_mm, "TRACE_PREVIOUS_STORAGE_REQUIRED"),
    gross_rainfall_mm: normalizeAmountV1(input.gross_rainfall_mm, "TRACE_GROSS_RAINFALL_REQUIRED"),
    surface_runoff_mm: normalizeAmountV1(input.surface_runoff_mm, "TRACE_SURFACE_RUNOFF_REQUIRED"),
    effective_rainfall_mm: normalizeAmountV1(input.effective_rainfall_mm, "TRACE_EFFECTIVE_RAINFALL_REQUIRED"),
    execution_events: input.execution_events.map((event) => ({ ...event })),
    effective_irrigation_mm: normalizeAmountV1(input.effective_irrigation_mm, "TRACE_EFFECTIVE_IRRIGATION_REQUIRED"),
    reference_et0_mm: normalizeAmountV1(input.reference_et0_mm, "TRACE_REFERENCE_ET0_REQUIRED"),
    crop_stage_code: input.crop_stage_code,
    kc: normalizeAmountV1(input.kc, "TRACE_KC_REQUIRED"),
    requested_crop_et_mm: normalizeAmountV1(input.requested_crop_et_mm, "TRACE_REQUESTED_CROP_ET_REQUIRED"),
    actual_crop_et_mm: normalizeAmountV1(input.actual_crop_et_mm, "TRACE_ACTUAL_CROP_ET_REQUIRED"),
    unmet_crop_et_mm: normalizeAmountV1(input.unmet_crop_et_mm, "TRACE_UNMET_CROP_ET_REQUIRED"),
    storage_before_drainage_mm: normalizeAmountV1(input.storage_before_drainage_mm, "TRACE_STORAGE_BEFORE_DRAINAGE_REQUIRED"),
    drainage_mm: normalizeAmountV1(input.drainage_mm, "TRACE_DRAINAGE_REQUIRED"),
    storage_after_drainage_mm: normalizeAmountV1(input.storage_after_drainage_mm, "TRACE_STORAGE_AFTER_DRAINAGE_REQUIRED"),
    saturation_overflow_mm: normalizeAmountV1(input.saturation_overflow_mm, "TRACE_SATURATION_OVERFLOW_REQUIRED"),
    next_storage_mm: normalizeAmountV1(input.next_storage_mm, "TRACE_NEXT_STORAGE_REQUIRED"),
    mass_balance_error_mm: "0.000000",
  };

  const left = parseFixedDecimalV1(trace.previous_storage_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.gross_rainfall_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.effective_irrigation_mm, WATER_AMOUNT_SCALE_V1);
  const right = parseFixedDecimalV1(trace.next_storage_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.surface_runoff_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.actual_crop_et_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.drainage_mm, WATER_AMOUNT_SCALE_V1)
    + parseFixedDecimalV1(trace.saturation_overflow_mm, WATER_AMOUNT_SCALE_V1);
  if (left !== right) {
    throw new Error(`WATER_MASS_BALANCE_NOT_CLOSED:${formatFixedDecimalV1(left - right, WATER_AMOUNT_SCALE_V1)}`);
  }

  rejectRecursiveSelfHashV1(trace);
  return {
    trace,
    mass_balance_trace_hash: semanticHashV1(trace as unknown as Record<string, unknown>),
  };
}
