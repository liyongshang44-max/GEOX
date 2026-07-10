// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS_NEGATIVE.ts
// Purpose: prove pure hourly Dynamics rejects conflicting duplicates, non-executed amounts, invalid geometry, invalid uncertainty, variance rederivation, invalid water inputs, and broken traces.
// Boundary: negative pure-domain acceptance only; no database, Evidence query, Runtime orchestration, canonical persistence, or Forecast success.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  executeHourlyWaterBalanceV1,
  type HourlyWaterBalanceConfigV1,
  type HourlyWaterBalanceInputV1,
} from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import { buildWaterMassBalanceTraceV1 } from "../../apps/server/src/domain/soil_water/water_mass_balance_trace_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

const expectedErrors = new Map(
  readJsonV1<{ cases: Array<{ case_id: string; expected_error: string }> }>(
    "fixtures/mcft/water_state/negative/MCFT_CAP_02_NEGATIVE_FIXTURES.json",
  ).cases.map((item) => [item.case_id, item.expected_error]),
);
const expectedFixture = readJsonV1<{
  config: HourlyWaterBalanceConfigV1;
  scope: Record<string, string>;
}>("fixtures/mcft/water_state/expected/MCFT_CAP_02_DYNAMICS_FIXTURES.json");

function baseInputV1(): HourlyWaterBalanceInputV1 {
  return {
    interval_start_exclusive: "2026-06-01T01:00:00.000Z",
    interval_end_inclusive: "2026-06-01T02:00:00.000Z",
    previous_storage_mm_decimal: "57.778512",
    previous_variance_basis: {
      basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
      source_posterior_ref: "twin_state_estimate_a411d678b1d79b7a58b31fd7",
      source_vwc_variance: "0.002678",
    },
    gross_rainfall_mm_decimal: "0.000000",
    historical_et0_mm_decimal: "0.085000",
    crop_stage_code: "INITIAL",
    kc_decimal: "0.300000",
    executed_irrigation_candidates: [],
    config: cloneV1(expectedFixture.config),
  };
}

function executionCandidateV1(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    binding_id: "irrigation_execution_binding_v1",
    origin_source_id: "executor_demo",
    scope: cloneV1(expectedFixture.scope),
    event_id: "execution_001",
    source_record_id: "execution_record_001",
    executed_at: "2026-06-01T01:30:00.000Z",
    ingested_at: "2026-06-01T01:31:00.000Z",
    executed_amount_mm: "10.000000",
    coverage_fraction: "0.500000",
    eligible_for_state_input: true,
    source_quality: "USABLE",
    execution_status: "EXECUTED",
    ...overrides,
  };
}

let pass = 0;
function rejects(caseId: string, fn: () => unknown): void {
  const expected = expectedErrors.get(caseId);
  if (!expected) throw new Error(`NEGATIVE_FIXTURE_NOT_FOUND:${caseId}`);
  assert.throws(fn, (error: unknown) => error instanceof Error && error.message.includes(expected));
  pass += 1;
  console.log(`PASS ${caseId}`);
}

rejects("CONFLICTING_EXECUTION_DUPLICATE", () => {
  const input = baseInputV1();
  input.executed_irrigation_candidates = [
    executionCandidateV1({ source_record_id: "record_a", ingested_at: "2026-06-01T01:31:00.000Z" }),
    executionCandidateV1({ source_record_id: "record_b", ingested_at: "2026-06-01T01:32:00.000Z", executed_amount_mm: "11.000000" }),
  ];
  executeHourlyWaterBalanceV1(input);
});

rejects("PLANNED_AMOUNT_FORBIDDEN", () => {
  const input = baseInputV1();
  input.executed_irrigation_candidates = [executionCandidateV1({ planned_amount_mm: "10.000000" })];
  executeHourlyWaterBalanceV1(input);
});

rejects("EXECUTION_COVERAGE_OUT_OF_RANGE", () => {
  const input = baseInputV1();
  input.executed_irrigation_candidates = [executionCandidateV1({ coverage_fraction: "1.100000" })];
  executeHourlyWaterBalanceV1(input);
});

rejects("DYNAMIC_ROOT_DEPTH_FORBIDDEN", () => {
  const input = baseInputV1();
  input.config.root_zone_depth_mm = "250.000000";
  executeHourlyWaterBalanceV1(input);
});

rejects("ZERO_STRUCTURAL_UNCERTAINTY_FORBIDDEN", () => {
  const input = baseInputV1();
  input.config.structural_process_stddev_mm_per_hour = "0.000000";
  executeHourlyWaterBalanceV1(input);
});

rejects("SUBSEQUENT_VARIANCE_REDERIVATION_FORBIDDEN", () => {
  const input = baseInputV1();
  input.previous_variance_basis = {
    basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
    previous_state_ref: "state_previous",
    previous_storage_variance_mm2_decimal: "100.000000000000",
    source_vwc_variance: "0.001111",
  } as any;
  executeHourlyWaterBalanceV1(input);
});

rejects("NEGATIVE_RAINFALL_FORBIDDEN", () => {
  const input = baseInputV1();
  input.gross_rainfall_mm_decimal = "-0.100000";
  executeHourlyWaterBalanceV1(input);
});

rejects("PREVIOUS_STORAGE_ABOVE_SATURATION", () => {
  const input = baseInputV1();
  input.previous_storage_mm_decimal = "135.000001";
  executeHourlyWaterBalanceV1(input);
});

rejects("TRACE_SELF_HASH_FORBIDDEN", () => {
  buildWaterMassBalanceTraceV1({
    previous_storage_mm: "1.000000",
    gross_rainfall_mm: "0.000000",
    surface_runoff_mm: "0.000000",
    effective_rainfall_mm: "0.000000",
    execution_events: [{ mass_balance_trace_hash: "sha256:forbidden" }] as any,
    effective_irrigation_mm: "0.000000",
    reference_et0_mm: "0.000000",
    crop_stage_code: "INITIAL",
    kc: "0.300000",
    requested_crop_et_mm: "0.000000",
    actual_crop_et_mm: "0.000000",
    unmet_crop_et_mm: "0.000000",
    storage_before_drainage_mm: "1.000000",
    drainage_mm: "0.000000",
    storage_after_drainage_mm: "1.000000",
    saturation_overflow_mm: "0.000000",
    next_storage_mm: "1.000000",
  });
});

rejects("MASS_BALANCE_TAMPER_REJECTED", () => {
  buildWaterMassBalanceTraceV1({
    previous_storage_mm: "1.000000",
    gross_rainfall_mm: "1.000000",
    surface_runoff_mm: "0.000000",
    effective_rainfall_mm: "1.000000",
    execution_events: [],
    effective_irrigation_mm: "0.000000",
    reference_et0_mm: "0.000000",
    crop_stage_code: "INITIAL",
    kc: "0.300000",
    requested_crop_et_mm: "0.000000",
    actual_crop_et_mm: "0.000000",
    unmet_crop_et_mm: "0.000000",
    storage_before_drainage_mm: "2.000000",
    drainage_mm: "0.000000",
    storage_after_drainage_mm: "2.000000",
    saturation_overflow_mm: "0.000000",
    next_storage_mm: "1.999999",
  });
});

console.log(`MCFT-CAP-02 dynamics negative: ${pass} PASS, 0 FAIL`);
