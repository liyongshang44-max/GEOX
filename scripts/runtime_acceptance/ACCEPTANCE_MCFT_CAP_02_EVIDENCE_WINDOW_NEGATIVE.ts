// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE.ts
// Purpose: prove missing exact-hour inputs, semantic conflicts, invalid execution Evidence, invalid crop-stage context, and unsupported record types fail closed.
// Boundary: pure application negative acceptance only; no database, persistence, checkpoint, Runtime tick, observation assimilation, or successful Forecast.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContinuationEvidenceWindowV1,
  resolveContinuationCropStageContextV1,
  type ContinuationCropStageConfigurationContextV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

let pass = 0;
function expectErrorV1(caseId: string, expected: string, execute: () => unknown): void {
  assert.throws(execute, (error: unknown) => error instanceof Error && error.message.includes(expected));
  pass += 1;
  console.log(`PASS ${caseId}`);
}

async function main(): Promise<void> {
  const fixture = readJsonV1<{
    scope: TwinScopeKeyV1;
    logical_time: string;
    crop_stage_context_ref: string;
    crop_stage_context_hash: string;
    candidate_records: CanonicalReplayEvidenceRecordV1[];
  }>("fixtures/mcft/water_state/expected/MCFT_CAP_02_EVIDENCE_WINDOW_FIXTURES.json");
  const negative = readJsonV1<{ cases: Array<{ case_id: string; expected_error: string }> }>(
    "fixtures/mcft/water_state/negative/MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE_FIXTURES.json",
  );
  const context = readJsonV1<ContinuationCropStageConfigurationContextV1>(
    "fixtures/mcft/water_state/replay_v1/configuration_context.json",
  );
  const expected = new Map(negative.cases.map((item) => [item.case_id, item.expected_error]));
  const baseInput = {
    scope: fixture.scope,
    logical_time: fixture.logical_time,
    crop_stage_context_ref: fixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.crop_stage_context_hash,
    crop_stage_context: context,
  };
  const run = (records: CanonicalReplayEvidenceRecordV1[]) => buildContinuationEvidenceWindowV1({ ...baseInput, candidate_records: records });

  expectErrorV1(
    "MISSING_EXACT_HOURLY_RAINFALL_INTERVAL",
    expected.get("MISSING_EXACT_HOURLY_RAINFALL_INTERVAL")!,
    () => run(fixture.candidate_records.filter((record) => record.record_type !== "observed_rainfall_v1")),
  );

  expectErrorV1(
    "MISSING_EXACT_HOURLY_ET0_INTERVAL",
    expected.get("MISSING_EXACT_HOURLY_ET0_INTERVAL")!,
    () => run(fixture.candidate_records.filter((record) => record.record_type !== "historical_et0_estimate_v1")),
  );

  const rainfallWinner = fixture.candidate_records.find((record) => record.source_record_id === "rain_exact_winner")!;
  const conflictingRainfall: CanonicalReplayEvidenceRecordV1 = {
    ...cloneV1(rainfallWinner),
    source_record_id: "rain_conflicting",
    source_record_hash: "sha256:rain_conflicting",
    canonical_payload: { unit: "mm", value: 1.5 },
    source_payload: { unit: "mm", value: 1.5 },
  };
  expectErrorV1(
    "CONFLICTING_RAINFALL_DUPLICATE",
    expected.get("CONFLICTING_RAINFALL_DUPLICATE")!,
    () => run([...fixture.candidate_records, conflictingRainfall]),
  );

  const secondRainfallIdentity: CanonicalReplayEvidenceRecordV1 = {
    ...cloneV1(rainfallWinner),
    source_record_id: "rain_second_identity",
    source_record_hash: "sha256:rain_second_identity",
    origin_source_id: "second_weather_station",
  };
  expectErrorV1(
    "MULTIPLE_EXACT_HOURLY_RAINFALL_INTERVALS",
    expected.get("MULTIPLE_EXACT_HOURLY_RAINFALL_INTERVALS")!,
    () => run([...fixture.candidate_records, secondRainfallIdentity]),
  );

  const executionTemplate = cloneV1(fixture.candidate_records.find((record) => record.record_type === "soil_moisture_observation_v1")!);
  const makeExecution = (overrides: Partial<CanonicalReplayEvidenceRecordV1> = {}): CanonicalReplayEvidenceRecordV1 => ({
    ...executionTemplate,
    source_record_id: "execution_negative",
    source_record_hash: "sha256:execution_negative",
    record_type: "irrigation_execution_evidence_v1",
    binding_id: "irrigation_execution_c8_v1",
    origin_source_id: "dev_valve_pump_c8_001",
    available_to_runtime_at: "2026-06-01T01:46:00.000Z",
    role_time: { executed_at: "2026-06-01T01:45:00.000Z", ingested_at: "2026-06-01T01:46:00.000Z" },
    quality: { status: "PASS" },
    source_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1 },
    canonical_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1 },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { id: "IDENTITY_MM_V1" },
    limitations: ["negative fixture"],
    ...overrides,
  });

  const badCoverage = makeExecution({
    source_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1.1 },
    canonical_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1.1 },
  });
  expectErrorV1(
    "EXECUTION_COVERAGE_OUT_OF_RANGE",
    expected.get("EXECUTION_COVERAGE_OUT_OF_RANGE")!,
    () => run([...fixture.candidate_records, badCoverage]),
  );

  const plannedAmount = makeExecution({
    source_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1, planned_amount_mm: 8 },
    canonical_payload: { event_id: "negative_A", executed_amount_mm: 5, coverage_fraction: 1, planned_amount_mm: 8 },
  });
  expectErrorV1(
    "NON_EXECUTED_IRRIGATION_AMOUNT_FORBIDDEN",
    expected.get("NON_EXECUTED_IRRIGATION_AMOUNT_FORBIDDEN")!,
    () => run([...fixture.candidate_records, plannedAmount]),
  );

  const missingEventId = makeExecution({
    source_payload: { executed_amount_mm: 5, coverage_fraction: 1 },
    canonical_payload: { executed_amount_mm: 5, coverage_fraction: 1 },
  });
  expectErrorV1(
    "EXECUTION_STABLE_IDENTITY_REQUIRED",
    expected.get("EXECUTION_STABLE_IDENTITY_REQUIRED")!,
    () => run([...fixture.candidate_records, missingEventId]),
  );

  expectErrorV1(
    "CROP_STAGE_CONTEXT_HASH_MISMATCH",
    expected.get("CROP_STAGE_CONTEXT_HASH_MISMATCH")!,
    () => resolveContinuationCropStageContextV1({
      logical_time: fixture.logical_time,
      context_ref: fixture.crop_stage_context_ref,
      context_hash: "sha256:forged",
      context,
    }),
  );

  expectErrorV1(
    "CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE",
    expected.get("CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE")!,
    () => resolveContinuationCropStageContextV1({
      logical_time: "2026-07-01T00:00:00.000Z",
      context_ref: fixture.crop_stage_context_ref,
      context_hash: fixture.crop_stage_context_hash,
      context,
    }),
  );

  const overlappingContext = cloneV1(context);
  overlappingContext.crop_stage_schedule.push({
    stage_code: "OVERLAP",
    effective_from: "2026-06-01T01:00:00.000Z",
    effective_to: "2026-06-01T03:00:00.000Z",
    kc: 0.5,
  });
  expectErrorV1(
    "CROP_STAGE_CONTEXT_OVERLAP",
    expected.get("CROP_STAGE_CONTEXT_OVERLAP")!,
    () => resolveContinuationCropStageContextV1({
      logical_time: fixture.logical_time,
      context_ref: fixture.crop_stage_context_ref,
      context_hash: fixture.crop_stage_context_hash,
      context: overlappingContext,
    }),
  );

  const wrongClass = cloneV1(context) as ContinuationCropStageConfigurationContextV1 & { context_class: string };
  wrongClass.context_class = "EVIDENCE";
  expectErrorV1(
    "CROP_STAGE_CONTEXT_CLASS_INVALID",
    expected.get("CROP_STAGE_CONTEXT_CLASS_INVALID")!,
    () => resolveContinuationCropStageContextV1({
      logical_time: fixture.logical_time,
      context_ref: fixture.crop_stage_context_ref,
      context_hash: fixture.crop_stage_context_hash,
      context: wrongClass as ContinuationCropStageConfigurationContextV1,
    }),
  );

  const unsupported: CanonicalReplayEvidenceRecordV1 = {
    ...cloneV1(rainfallWinner),
    source_record_id: "unsupported_record",
    source_record_hash: "sha256:unsupported_record",
    record_type: "unsupported_record_v1",
  };
  expectErrorV1(
    "UNSUPPORTED_REPLAY_RECORD_TYPE",
    expected.get("UNSUPPORTED_REPLAY_RECORD_TYPE")!,
    () => run([...fixture.candidate_records, unsupported]),
  );

  assert.equal(pass, negative.cases.length);
  console.log(`MCFT-CAP-02 evidence-window negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
