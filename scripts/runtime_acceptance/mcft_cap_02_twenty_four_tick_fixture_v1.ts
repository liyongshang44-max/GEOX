// scripts/runtime_acceptance/mcft_cap_02_twenty_four_tick_fixture_v1.ts
// Purpose: assemble the frozen 24-hour Replay Evidence series and real predecessor/config identities for contiguous range acceptance.
// Boundary: acceptance support only; no restart, resume, backfill, scheduler, public route, Forecast success, Recommendation, or action.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContiguousContinuationRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap02SingleTickFixtureV1,
  InMemorySingleTickRuntimeV1,
} from "./mcft_cap_02_single_tick_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOUR_MS = 60 * 60 * 1000;

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function minusMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) - minutes * 60 * 1000).toISOString();
}

export type TwentyFourTickExpectedFixtureV1 = {
  schema_version: string;
  case_id: string;
  scope: TwinScopeKeyV1;
  created_at: string;
  first_logical_time: string;
  last_logical_time: string;
  next_logical_time: string;
  et0_series_mm: string[];
  expected: Record<string, unknown>;
};

function rainfallRecordV1(scope: TwinScopeKeyV1, logicalTime: string, index: number): CanonicalReplayEvidenceRecordV1 {
  const intervalStart = addHoursV1(logicalTime, -1);
  const availableAt = minusMinutesV1(logicalTime, 1);
  const suffix = String(index + 1).padStart(2, "0");
  return {
    ...scope,
    dataset_id: "mcft_cap_02_24_tick_replay_v1",
    source_record_id: `range_rain_${suffix}`,
    source_record_hash: `sha256:range_rain_${suffix}`,
    record_type: "observed_rainfall_v1",
    binding_id: "rainfall_obs_c8_v1",
    origin_source_kind: "DEVICE",
    origin_source_id: "dev_weather_station_c8_001",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: availableAt,
    role_time: {
      interval_start: intervalStart,
      interval_end: logicalTime,
      ingested_at: availableAt,
    },
    quality: { status: "PASS" },
    source_payload: { unit: "mm", value: 0 },
    canonical_payload: { unit: "mm", value: 0 },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { id: "IDENTITY_MM_V1" },
    limitations: ["controlled synthetic 24-tick rainfall fixture"],
  };
}

function et0RecordV1(
  scope: TwinScopeKeyV1,
  logicalTime: string,
  et0Value: string,
  index: number,
): CanonicalReplayEvidenceRecordV1 {
  const intervalStart = addHoursV1(logicalTime, -1);
  const availableAt = minusMinutesV1(logicalTime, 1);
  const suffix = String(index + 1).padStart(2, "0");
  const value = Number(et0Value);
  return {
    ...scope,
    dataset_id: "mcft_cap_02_24_tick_replay_v1",
    source_record_id: `range_et0_${suffix}`,
    source_record_hash: `sha256:range_et0_${suffix}`,
    record_type: "historical_et0_estimate_v1",
    binding_id: "et0_historical_estimate_c8_v1",
    origin_source_kind: "DERIVED_WEATHER_INPUT",
    origin_source_id: "mcft_et0_replay_source_v1",
    epistemic_class: "ESTIMATED",
    available_to_runtime_at: availableAt,
    role_time: {
      interval_start: intervalStart,
      interval_end: logicalTime,
      ingested_at: availableAt,
      calculation_method: "CONTROLLED_REPLAY_ET0_V1",
      method_version: "1",
    },
    quality: { status: "LIMITED" },
    source_payload: { unit: "mm_per_hour", value },
    canonical_payload: {
      unit: "mm_per_hour",
      value,
      calculation_method: "CONTROLLED_REPLAY_ET0_V1",
      method_version: "1",
    },
    source_unit: "mm_per_hour",
    canonical_unit: "mm_per_hour",
    conversion_rule: { id: "IDENTITY_MM_PER_HOUR_V1" },
    limitations: ["controlled synthetic 24-tick ET0 fixture"],
  };
}

export function buildTwentyFourTickEvidenceRecordsV1(
  scope: TwinScopeKeyV1,
  firstLogicalTime: string,
  et0Series: readonly string[],
): CanonicalReplayEvidenceRecordV1[] {
  if (et0Series.length !== 24) throw new Error("TWENTY_FOUR_TICK_ET0_SERIES_LENGTH_REQUIRED");
  const records: CanonicalReplayEvidenceRecordV1[] = [];
  for (let index = 0; index < et0Series.length; index += 1) {
    const logicalTime = addHoursV1(firstLogicalTime, index);
    records.push(rainfallRecordV1(scope, logicalTime, index));
    records.push(et0RecordV1(scope, logicalTime, et0Series[index], index));
  }
  return records;
}

export async function buildMcftCap02TwentyFourTickFixtureV1() {
  const base = await buildMcftCap02SingleTickFixtureV1();
  const expectedFixture = readJsonV1<TwentyFourTickExpectedFixtureV1>(
    "fixtures/mcft/water_state/expected/MCFT_CAP_02_24_TICK_EXPECTED.json",
  );
  const candidateRecords = buildTwentyFourTickEvidenceRecordsV1(
    base.scope,
    expectedFixture.first_logical_time,
    expectedFixture.et0_series_mm,
  );
  const runtime = new InMemorySingleTickRuntimeV1({
    snapshot: base.initialSnapshot,
    configs: [base.parentRuntimeConfig, base.continuationRuntimeConfig],
    candidate_records: candidateRecords,
  });
  const handoffService = new PrepareNextTickInputServiceV1(runtime);
  const tickService = new ContinuationTickServiceV1(
    handoffService,
    runtime,
    runtime,
    runtime,
  );
  const rangeService = new ContiguousContinuationRangeServiceV1(handoffService, tickService);
  return {
    ...base,
    expectedFixture,
    candidateRecords,
    runtime,
    handoffService,
    tickService,
    rangeService,
  };
}
