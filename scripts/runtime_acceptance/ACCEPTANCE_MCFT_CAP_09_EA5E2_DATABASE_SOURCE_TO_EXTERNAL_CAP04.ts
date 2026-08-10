import assert from "node:assert/strict";
import type { Pool } from "pg";

import { executeExternalFormalCap04CandidateV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

type RowV1 = { fact_id: string; occurred_at: string; record_json: unknown };

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function eventTimeV1(record: CanonicalReplayEvidenceRecordV1): string {
  const value = record.role_time.observed_at
    ?? record.role_time.interval_end
    ?? record.role_time.issued_at;
  if (typeof value !== "string") throw new Error(`EA5E2_DB_TO_CAP04_EVENT_TIME_REQUIRED:${record.record_type}`);
  return value;
}

function rowsV1(records: readonly CanonicalReplayEvidenceRecordV1[]): RowV1[] {
  return records.map((record, index) => ({
    fact_id: `ea5e2_db_to_cap04_${String(index).padStart(2, "0")}_${record.source_record_id}`,
    occurred_at: eventTimeV1(record),
    record_json: { type: record.record_type, payload: structuredClone(record) },
  }));
}

function fakeReadOnlyPoolV1(rows: readonly RowV1[]) {
  const sql: string[] = [];
  const client = {
    async query(statement: string) {
      sql.push(statement);
      if (/^\s*SELECT\s+fact_id/i.test(statement)) return { rows: structuredClone(rows) };
      return { rows: [] };
    },
    release() {},
  };
  return {
    pool: {
      async connect() { return client; },
    } as unknown as Pool,
    sql,
  };
}

function delayedExactEvidenceV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1[] {
  const delayed = structuredClone(records) as CanonicalReplayEvidenceRecordV1[];
  for (const record of delayed) {
    if (record.record_type !== "observed_rainfall_v1" && record.record_type !== "historical_et0_estimate_v1") continue;
    record.available_to_runtime_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 390);
    record.role_time.ingested_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 391);
  }
  return delayed;
}

function assertReadOnlyV1(sql: readonly string[]): void {
  const joined = sql.join("\n");
  assert.match(joined, /BEGIN TRANSACTION READ ONLY/);
  assert.match(joined, /COMMIT/);
  assert.doesNotMatch(joined, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i);
}

async function main(): Promise<void> {
  const fixture = await buildEa5b5bExternalFixtureV1();
  const delayed = delayedExactEvidenceV1(fixture.candidates);
  const fake = fakeReadOnlyPoolV1(rowsV1(delayed));
  const cutoff = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 432);
  const source = new PostgresExternalFormalEvidenceSourceV1(fake.pool);
  const loaded = await source.loadCandidateRecords({
    scope: fixture.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    exact_interval_availability_cutoff_time: cutoff,
  });

  assert.equal(loaded.database_write_count, 0);
  assert.equal(loaded.provider_request_count, 0);
  assert.equal(loaded.selected_record_count, 5);
  assert.deepEqual(loaded.family_cardinality, {
    soil: 1,
    rainfall: 1,
    historical_et0: 1,
    future_weather: 1,
    future_et0: 1,
  });
  assertReadOnlyV1(fake.sql);

  const byType = new Map(loaded.records.map((record) => [record.record_type, record]));
  assert.equal(
    byType.get("observed_rainfall_v1")?.available_to_runtime_at,
    addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 390),
  );
  assert.equal(
    byType.get("historical_et0_estimate_v1")?.available_to_runtime_at,
    addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 390),
  );
  assert.ok(Date.parse(String(byType.get("future_weather_assumption_v1")?.available_to_runtime_at)) <= Date.parse(EA5B5B_LOGICAL_TIME_V1));
  assert.ok(Date.parse(String(byType.get("future_et0_assumption_v1")?.available_to_runtime_at)) <= Date.parse(EA5B5B_LOGICAL_TIME_V1));

  const observerCreatedAt = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 437);
  const candidate = executeExternalFormalCap04CandidateV1({
    scope: fixture.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: observerCreatedAt,
    handoff: fixture.handoff,
    runtime_config: fixture.hourly,
    candidate_records: loaded.records,
    crop_stage_context: fixture.crop,
  });

  assert.equal(candidate.operation_variant, "A1");
  assert.equal(candidate.forcing_outcome.status, "SELECTED");
  assert.equal(candidate.forecast_authority.forecast_candidate.status, "COMPLETED");
  assert.equal(candidate.forecast_authority.forecast_candidate.points.length, 72);
  assert.equal(candidate.record_set.members.length, 8);
  assert.equal(candidate.canonical_persistence_authorized, false);
  assert.deepEqual(
    [
      candidate.provider_request_count,
      candidate.database_write_count,
      candidate.scenario_write_count,
      candidate.recommendation_write_count,
      candidate.action_write_count,
    ],
    [0, 0, 0, 0, 0],
  );

  console.log(JSON.stringify({
    status: "PASS",
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    exact_interval_cutoff_minutes: 432,
    observer_offset_minutes: 437,
    selected_record_count: loaded.selected_record_count,
    delayed_rainfall_to_external_cap04: true,
    delayed_historical_et0_to_external_cap04: true,
    future_forcing_pre_logical_time_preserved: true,
    external_cap04_operation_variant: candidate.operation_variant,
    external_cap04_forecast_status: candidate.forecast_authority.forecast_candidate.status,
    external_cap04_forecast_point_count: candidate.forecast_authority.forecast_candidate.points.length,
    canonical_persistence_authorized: candidate.canonical_persistence_authorized,
    database_write_count: loaded.database_write_count + candidate.database_write_count,
    provider_request_count: loaded.provider_request_count + candidate.provider_request_count,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
