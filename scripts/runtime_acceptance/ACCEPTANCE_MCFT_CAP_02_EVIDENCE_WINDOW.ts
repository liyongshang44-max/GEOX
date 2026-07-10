// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.ts
// Purpose: prove deterministic continuation Evidence Window selection, exact-hour rainfall/ET0 cardinality, consumption trace semantics, identical duplicate handling, execution selection, crop-stage resolution, and semantic digest stability.
// Boundary: pure application acceptance only; no database, continuation persistence, checkpoint advancement, Runtime tick orchestration, observation assimilation, or successful Forecast.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJsonV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import {
  buildContinuationEvidenceWindowV1,
  type ContinuationCropStageConfigurationContextV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PATH = "fixtures/mcft/water_state/expected/MCFT_CAP_02_EVIDENCE_WINDOW_FIXTURES.json";
const CONTEXT_PATH = "fixtures/mcft/water_state/replay_v1/configuration_context.json";

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

async function main(): Promise<void> {
  const fixture = readJsonV1<{
    scope: TwinScopeKeyV1;
    logical_time: string;
    crop_stage_context_ref: string;
    crop_stage_context_hash: string;
    candidate_records: CanonicalReplayEvidenceRecordV1[];
    expected: {
      window_start_exclusive: string;
      window_end_inclusive: string;
      rainfall_record_ref: string;
      historical_et0_record_ref: string;
      irrigation_execution_count: number;
      selected_record_count: number;
      consumed_record_count: number;
      context_only_record_count: number;
      deduplicated_record_count: number;
      excluded_record_count: number;
      crop_stage_code: string;
      kc: number;
      non_consumed_crop_root_depth_mm: number;
      non_consumed_effective_model_root_depth_mm: number;
      exclusion_counts: Record<string, number>;
    };
  }>(FIXTURE_PATH);
  const cropStageContext = readJsonV1<ContinuationCropStageConfigurationContextV1>(CONTEXT_PATH);

  const input = {
    scope: fixture.scope,
    logical_time: fixture.logical_time,
    candidate_records: fixture.candidate_records,
    crop_stage_context_ref: fixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.crop_stage_context_hash,
    crop_stage_context: cropStageContext,
  };
  const window = buildContinuationEvidenceWindowV1(input);
  const rerun = buildContinuationEvidenceWindowV1(cloneV1(input));
  assert.equal(canonicalJsonV1(window), canonicalJsonV1(rerun));
  assert.equal(window.semantic_digest, rerun.semantic_digest);
  assert.match(window.semantic_digest, /^sha256:[0-9a-f]{64}$/);
  ok("continuation Evidence Window rerun is byte-equivalent with stable semantic digest");

  assert.equal(window.window_start_exclusive, fixture.expected.window_start_exclusive);
  assert.equal(window.window_end_inclusive, fixture.expected.window_end_inclusive);
  assert.equal(window.logical_time, fixture.logical_time);
  assert.equal(window.frozen, true);
  ok("Replay logical hour is frozen as the open-start closed-end PT1H window");

  assert.equal(window.rainfall_record.source_record_id, fixture.expected.rainfall_record_ref);
  assert.equal(window.historical_et0_record.source_record_id, fixture.expected.historical_et0_record_ref);
  assert.equal(window.rainfall_record.role_time.interval_start, fixture.expected.window_start_exclusive);
  assert.equal(window.rainfall_record.role_time.interval_end, fixture.expected.window_end_inclusive);
  assert.equal(window.historical_et0_record.role_time.interval_start, fixture.expected.window_start_exclusive);
  assert.equal(window.historical_et0_record.role_time.interval_end, fixture.expected.window_end_inclusive);
  ok("exact-hour rainfall and historical ET0 are selected by exact interval boundaries");

  assert.equal(window.coverage.selected_record_count, fixture.expected.selected_record_count);
  assert.equal(window.coverage.consumed_record_count, fixture.expected.consumed_record_count);
  assert.equal(window.coverage.context_only_record_count, fixture.expected.context_only_record_count);
  assert.equal(window.coverage.deduplicated_record_count, fixture.expected.deduplicated_record_count);
  assert.equal(window.excluded_records.length, fixture.expected.excluded_record_count);
  assert.deepEqual(window.exclusion_counts, fixture.expected.exclusion_counts);
  ok("selected, excluded, context-only, and deduplicated coverage is exact");

  assert.deepEqual(window.consumed_evidence_refs, [fixture.expected.historical_et0_record_ref, fixture.expected.rainfall_record_ref].sort());
  const consumedStatuses = window.selected_records
    .filter((record) => record.model_consumption_status === "CONSUMED_BY_DYNAMICS")
    .map((record) => record.role)
    .sort();
  assert.deepEqual(consumedStatuses, ["HISTORICAL_ET0_INPUT", "RAINFALL_OBSERVATION"]);
  ok("only exact rainfall and historical ET0 are consumed by Dynamics in the no-execution fixture");

  assert.equal(window.soil_moisture_records.length, 1);
  assert.equal(window.approved_irrigation_plan_records.length, 1);
  assert.equal(window.future_weather_assumption_records.length, 1);
  assert.equal(window.future_et0_assumption_records.length, 1);
  assert.equal(window.irrigation_execution_records.length, fixture.expected.irrigation_execution_count);
  assert.equal(window.selected_records.find((record) => record.role === "SOIL_MOISTURE_OBSERVATION")?.model_consumption_status, "AVAILABLE_NOT_CONSUMED_MCFT_CAP_02");
  assert.equal(window.selected_records.find((record) => record.role === "APPROVED_IRRIGATION_PLAN")?.model_consumption_status, "CONTEXT_ONLY_NOT_EXECUTED");
  assert.equal(window.selected_records.find((record) => record.role === "FUTURE_WEATHER_ASSUMPTION")?.model_consumption_status, "AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED");
  assert.equal(window.selected_records.find((record) => record.role === "FUTURE_ET0_ASSUMPTION")?.model_consumption_status, "AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED");
  ok("soil, plan, and future assumptions retain explicit non-consumption semantics");

  assert.equal(window.deduplicated_records.length, 1);
  assert.equal(window.deduplicated_records[0]?.source_record_id, "rain_exact_earlier");
  assert.equal(window.deduplicated_records[0]?.window_disposition, "DEDUPLICATED_IDENTICAL");
  assert.equal(window.rainfall_record.source_record_id, "rain_exact_winner");
  ok("identical rainfall duplicates use ingested-desc then source-record-id-asc winner policy");

  assert.equal(window.crop_stage_context.context_kind, "CONFIGURATION_DERIVED_CONTEXT");
  assert.equal(window.crop_stage_context.stage_code, fixture.expected.crop_stage_code);
  assert.equal(window.crop_stage_context.kc, fixture.expected.kc);
  assert.equal(window.crop_stage_context.non_consumed_crop_root_depth_mm, fixture.expected.non_consumed_crop_root_depth_mm);
  assert.equal(window.crop_stage_context.non_consumed_effective_model_root_depth_mm, fixture.expected.non_consumed_effective_model_root_depth_mm);
  assert.ok(window.crop_stage_context.limitations.some((value) => value.includes("not consumed")));
  ok("crop stage and Kc resolve from configuration while root-depth fields remain non-consumed");

  assert.equal(window.excluded_records.find((record) => record.source_record_id === "soil_late")?.model_consumption_status, "EXCLUDED_LATE");
  assert.equal(window.excluded_records.find((record) => record.source_record_id === "rain_interval_mismatch")?.model_consumption_status, "EXCLUDED_INTERVAL_MISMATCH");
  assert.equal(window.excluded_records.find((record) => record.source_record_id === "execution_quality_fail")?.model_consumption_status, "EXCLUDED_QUALITY");
  assert.equal(window.excluded_records.find((record) => record.source_record_id === "soil_scope_mismatch")?.model_consumption_status, "EXCLUDED_SCOPE");
  ok("late, interval-mismatch, quality-fail, and scope-mismatch records are explicitly excluded");

  const executionBase = cloneV1(fixture.candidate_records.find((record) => record.record_type === "soil_moisture_observation_v1")!);
  const execution: CanonicalReplayEvidenceRecordV1 = {
    ...executionBase,
    source_record_id: "execution_winner",
    source_record_hash: "sha256:execution_winner",
    record_type: "irrigation_execution_evidence_v1",
    binding_id: "irrigation_execution_c8_v1",
    origin_source_id: "dev_valve_pump_c8_001",
    available_to_runtime_at: "2026-06-01T01:46:00.000Z",
    role_time: {
      executed_at: "2026-06-01T01:45:00.000Z",
      ingested_at: "2026-06-01T01:46:00.000Z",
    },
    quality: { status: "PASS" },
    source_payload: { event_id: "execution_A", executed_amount_mm: 13.6, coverage_fraction: 0.91 },
    canonical_payload: { event_id: "execution_A", executed_amount_mm: 13.6, coverage_fraction: 0.91 },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { id: "IDENTITY_MM_V1" },
    limitations: ["controlled synthetic execution Evidence"],
  };
  const executionDuplicate: CanonicalReplayEvidenceRecordV1 = {
    ...cloneV1(execution),
    source_record_id: "execution_earlier",
    source_record_hash: "sha256:execution_earlier",
    available_to_runtime_at: "2026-06-01T01:45:30.000Z",
    role_time: {
      executed_at: "2026-06-01T01:45:00.000Z",
      ingested_at: "2026-06-01T01:45:30.000Z",
    },
  };
  const withExecution = buildContinuationEvidenceWindowV1({
    ...input,
    candidate_records: [...fixture.candidate_records, executionDuplicate, execution],
  });
  assert.equal(withExecution.irrigation_execution_records.length, 1);
  assert.equal(withExecution.irrigation_execution_records[0]?.source_record_id, "execution_winner");
  assert.equal(withExecution.selected_records.find((record) => record.source_record_id === "execution_winner")?.model_consumption_status, "CONSUMED_BY_DYNAMICS");
  assert.equal(withExecution.deduplicated_records.find((record) => record.source_record_id === "execution_earlier")?.exclusion_reason, "IDENTICAL_DUPLICATE_DEDUPLICATED");
  ok("eligible execution Evidence is consumed and identical execution duplicates are deterministically deduplicated");

  assert.equal(window.candidate_record_count, fixture.candidate_records.length);
  assert.deepEqual([...window.selected_evidence_refs].sort(), window.selected_records.map((record) => record.source_record_id).sort());
  assert.deepEqual([...window.context_only_evidence_refs].sort(), window.selected_records.filter((record) => record.model_consumption_status !== "CONSUMED_BY_DYNAMICS").map((record) => record.source_record_id).sort());
  ok("model-consumption reference sets exactly match the record trace");

  console.log(`MCFT-CAP-02 evidence-window: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
