// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.ts
// Purpose: prove exact fixed-point hourly water balance, irrigation aggregation, mass-balance closure, uncertainty propagation, and governed Runtime Config consumption.
// Boundary: pure-domain acceptance only; no Evidence query, database, continuation persistence, checkpoint advancement, Runtime orchestration, or successful Forecast.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJsonV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import {
  executeHourlyWaterBalanceV1,
  buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1,
  type HourlyWaterBalanceConfigV1,
} from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import {
  normalizeFixedDecimalV1,
  WATER_AMOUNT_SCALE_V1,
} from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import {
  compileContinuationRuntimeConfigFromAuthorityV1,
  type Mcft00ConfigurationMatrixForContinuationV1,
  type Mcft00RealityArtifactForContinuationV1,
  type Mcft00SourceMatrixForContinuationV1,
  type McftCap02PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PATH = "fixtures/mcft/water_state/expected/MCFT_CAP_02_DYNAMICS_FIXTURES.json";

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function prepareCandidatesV1(candidates: Array<Record<string, unknown>>, scope: Record<string, string>): unknown[] {
  return candidates.map((candidate) => {
    const output = { ...candidate, scope: cloneV1(scope) };
    delete (output as Record<string, unknown>).scope_ref;
    return output;
  });
}

async function main(): Promise<void> {
  const fixture = readJsonV1<{
    config: HourlyWaterBalanceConfigV1;
    scope: Record<string, string>;
    scenarios: Array<{
      scenario_id: string;
      input: Record<string, unknown> & { executed_irrigation_candidates: Array<Record<string, unknown>> };
      expected: Record<string, unknown>;
    }>;
  }>(FIXTURE_PATH);
  const lock = readJsonV1<McftCap02PredecessorLockV1>(
    "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json",
  );
  const reality = readJsonV1<Mcft00RealityArtifactV1 & Mcft00RealityArtifactForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
  );
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1 & Mcft00SourceMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const configurationMatrix = readJsonV1<Mcft00ConfigurationMatrixArtifactV1 & Mcft00ConfigurationMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  );
  const parentRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  const continuationConfig = compileContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: lock,
    parent_runtime_config: parentRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: lock.next_logical_tick_time,
    created_at: "2026-07-10T00:00:00.000Z",
  });
  const governedConfig = buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1(continuationConfig.payload);
  assert.deepEqual(governedConfig, fixture.config);
  ok("pure Dynamics config is derived from the canonical continuation Runtime Config payload");

  assert.equal(normalizeFixedDecimalV1("1.2345675", WATER_AMOUNT_SCALE_V1), "1.234568");
  assert.equal(normalizeFixedDecimalV1("-1.2345675", WATER_AMOUNT_SCALE_V1), "-1.234568");
  ok("fixed-point rounding is decimal half away from zero for both signs");

  const results = new Map<string, ReturnType<typeof executeHourlyWaterBalanceV1>>();
  for (const scenario of fixture.scenarios) {
    const result = executeHourlyWaterBalanceV1({
      ...(scenario.input as any),
      config: governedConfig,
      executed_irrigation_candidates: prepareCandidatesV1(scenario.input.executed_irrigation_candidates, fixture.scope),
    });
    const rerun = executeHourlyWaterBalanceV1({
      ...(scenario.input as any),
      config: governedConfig,
      executed_irrigation_candidates: prepareCandidatesV1(scenario.input.executed_irrigation_candidates, fixture.scope),
    });
    assert.equal(canonicalJsonV1(result), canonicalJsonV1(rerun));
    assert.equal(result.mass_balance_trace.mass_balance_error_mm, "0.000000");
    assert.equal(result.truth_class, "CONTROLLED_SYNTHETIC");
    assert.equal(result.calibration_status, "NOT_FIELD_CALIBRATED");
    results.set(scenario.scenario_id, result);
    ok(`${scenario.scenario_id} rerun is byte-equivalent and mass balance closes`);
  }

  const dry = results.get("DRY_ET_ONLY_FIRST_CONTINUATION")!;
  const dryExpected = fixture.scenarios.find((scenario) => scenario.scenario_id === "DRY_ET_ONLY_FIRST_CONTINUATION")!.expected;
  assert.equal(dry.mass_balance_trace.surface_runoff_mm, dryExpected.surface_runoff_mm);
  assert.equal(dry.mass_balance_trace.effective_rainfall_mm, dryExpected.effective_rainfall_mm);
  assert.equal(dry.mass_balance_trace.requested_crop_et_mm, dryExpected.requested_crop_et_mm);
  assert.equal(dry.mass_balance_trace.actual_crop_et_mm, dryExpected.actual_crop_et_mm);
  assert.equal(dry.mass_balance_trace.next_storage_mm, dryExpected.next_storage_mm);
  assert.equal(dry.uncertainty_budget.previous_storage_variance_mm2, dryExpected.previous_storage_variance_mm2);
  assert.equal(dry.uncertainty_budget.crop_et_variance_mm2, dryExpected.crop_et_variance_mm2);
  assert.equal(dry.uncertainty_budget.next_storage_variance_mm2, dryExpected.next_storage_variance_mm2);
  assert.equal(dry.uncertainty_budget.next_vwc_variance, dryExpected.next_vwc_variance);
  assert.equal(dry.published_state.root_zone_vwc_fraction.mean, dryExpected.root_zone_vwc_mean);
  assert.equal(dry.published_state.available_water_fraction, dryExpected.available_water_fraction);
  assert.equal(dry.published_state.depletion_from_field_capacity_mm, dryExpected.depletion_from_field_capacity_mm);
  assert.equal(dry.published_state.confidence_interval.published_lower, dryExpected.interval_lower);
  assert.equal(dry.published_state.confidence_interval.published_upper, dryExpected.interval_upper);
  assert.equal(dry.computation_basis.basis_origin, "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1");
  assert.equal(dry.computation_basis.storage_mean_mm_decimal.scale, 6);
  assert.equal(dry.computation_basis.storage_variance_mm2_decimal.scale, 12);
  ok("standard first continuation tick matches frozen storage, variance, interval, AWF, and depletion values");

  const rainfall = results.get("RAINFALL_AND_DRAINAGE")!;
  const rainfallExpected = fixture.scenarios.find((scenario) => scenario.scenario_id === "RAINFALL_AND_DRAINAGE")!.expected;
  assert.equal(rainfall.mass_balance_trace.surface_runoff_mm, rainfallExpected.surface_runoff_mm);
  assert.equal(rainfall.mass_balance_trace.effective_rainfall_mm, rainfallExpected.effective_rainfall_mm);
  assert.equal(rainfall.mass_balance_trace.storage_before_drainage_mm, rainfallExpected.storage_before_drainage_mm);
  assert.equal(rainfall.mass_balance_trace.drainage_mm, rainfallExpected.drainage_mm);
  assert.equal(rainfall.mass_balance_trace.next_storage_mm, rainfallExpected.next_storage_mm);
  assert.equal(rainfall.uncertainty_budget.rainfall_variance_mm2, rainfallExpected.rainfall_variance_mm2);
  assert.equal(rainfall.uncertainty_budget.next_storage_variance_mm2, rainfallExpected.next_storage_variance_mm2);
  assert.equal(rainfall.published_state.available_water_fraction, rainfallExpected.available_water_fraction);
  assert.equal(rainfall.published_state.available_water_fraction_trace.clipping_applied, rainfallExpected.available_water_clipping_applied);
  ok("rainfall, runoff, ET, drainage, uncertainty, and AWF clipping match the frozen fixture");

  const irrigation = results.get("EXECUTED_IRRIGATION_COVERAGE_WEIGHTED")!;
  const irrigationExpected = fixture.scenarios.find((scenario) => scenario.scenario_id === "EXECUTED_IRRIGATION_COVERAGE_WEIGHTED")!.expected;
  assert.equal(irrigation.irrigation_aggregation.effective_irrigation_mm, irrigationExpected.effective_irrigation_mm);
  assert.equal(irrigation.mass_balance_trace.next_storage_mm, irrigationExpected.next_storage_mm);
  assert.equal(irrigation.uncertainty_budget.irrigation_variance_mm2, irrigationExpected.irrigation_variance_mm2);
  assert.equal(irrigation.uncertainty_budget.next_storage_variance_mm2, irrigationExpected.next_storage_variance_mm2);
  ok("executed amount and coverage are the only irrigation amount inputs consumed by Dynamics");

  const saturation = results.get("SATURATION_OVERFLOW")!;
  const saturationExpected = fixture.scenarios.find((scenario) => scenario.scenario_id === "SATURATION_OVERFLOW")!.expected;
  assert.equal(saturation.mass_balance_trace.storage_after_drainage_mm, saturationExpected.storage_after_drainage_mm);
  assert.equal(saturation.mass_balance_trace.saturation_overflow_mm, saturationExpected.saturation_overflow_mm);
  assert.equal(saturation.mass_balance_trace.next_storage_mm, "135.000000");
  assert.equal(saturation.published_state.confidence_interval.published_upper, saturationExpected.interval_upper);
  assert.equal(saturation.published_state.confidence_interval.clipping_applied, saturationExpected.interval_clipping_applied);
  ok("saturation overflow is explicit while final storage and published interval remain physically bounded");

  const multiple = results.get("MULTIPLE_EXECUTION_EVENTS_WITH_IDENTICAL_DUPLICATE")!;
  const multipleExpected = fixture.scenarios.find((scenario) => scenario.scenario_id === "MULTIPLE_EXECUTION_EVENTS_WITH_IDENTICAL_DUPLICATE")!.expected;
  assert.deepEqual(
    multiple.irrigation_aggregation.selected_events.map((event) => event.source_record_id),
    multipleExpected.selected_source_record_ids,
  );
  assert.deepEqual(multiple.irrigation_aggregation.identical_duplicate_record_ids, multipleExpected.identical_duplicate_record_ids);
  assert.equal(multiple.irrigation_aggregation.effective_irrigation_mm, multipleExpected.effective_irrigation_mm);
  assert.equal(multiple.mass_balance_trace.next_storage_mm, multipleExpected.next_storage_mm);
  assert.equal(multiple.uncertainty_budget.irrigation_variance_mm2, multipleExpected.irrigation_variance_mm2);
  ok("multiple execution events retain deterministic order and identical duplicates are deduplicated");

  assert.ok(dry.uncertainty_budget.next_storage_variance_mm2 > dry.uncertainty_budget.previous_storage_variance_mm2);
  assert.equal(dry.uncertainty_budget.physical_clipping_reduces_latent_variance, false);
  ok("no-observation Dynamics strictly increases latent variance and interval clipping does not reduce it");

  console.log(`MCFT-CAP-02 dynamics: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
