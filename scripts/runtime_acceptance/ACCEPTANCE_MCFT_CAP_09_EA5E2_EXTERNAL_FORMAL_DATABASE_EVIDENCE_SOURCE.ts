import assert from "node:assert/strict";
import type { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  PostgresExternalFormalEvidenceSourceV1,
  type ExternalFormalDatabaseEvidenceLoadResultV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const T = "2026-08-11T17:00:00.000Z";
const CUTOFF = "2026-08-12T00:12:00.000Z";
const SCOPE = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };

type RowV1 = { fact_id: string; occurred_at: string; record_json: unknown };

function record(input: {
  record_type: string;
  source_record_id: string;
  binding_id: string;
  epistemic_class: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
}): CanonicalReplayEvidenceRecordV1 {
  return {
    ...SCOPE,
    dataset_id: `dataset_${input.source_record_id}`,
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    source_record_hash: `sha256:${input.source_record_id.padEnd(64, "0").slice(0, 64)}`,
    origin_source_kind: "EA5E2_ACCEPTANCE_EXTERNAL_FORMAL",
    origin_source_id: `origin_${input.source_record_id}`,
    binding_id: input.binding_id,
    epistemic_class: input.epistemic_class,
    available_to_runtime_at: input.available_to_runtime_at,
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: { acceptance: true },
    canonical_payload: { acceptance: true },
    source_unit: "source_unit",
    canonical_unit: "canonical_unit",
    conversion_rule: {
      conversion_rule_id: "EA5E2_ACCEPTANCE_IDENTITY_V1",
      conversion_rule_version: "1",
      authority_ref: "EA5E2_ACCEPTANCE_ONLY",
    },
    source_binding_version: 1,
    limitations: ["EA5E2_ACCEPTANCE_ONLY"],
  } as unknown as CanonicalReplayEvidenceRecordV1;
}

function row(value: CanonicalReplayEvidenceRecordV1): RowV1 {
  const roleTime = value.role_time as Record<string, unknown>;
  const event = roleTime.observed_at ?? roleTime.interval_end ?? roleTime.issued_at;
  return {
    fact_id: `fact_${value.source_record_id}`,
    occurred_at: String(event),
    record_json: { type: value.record_type, payload: structuredClone(value) },
  };
}

function validRows(): RowV1[] {
  return [
    row(record({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "soil_o00",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      epistemic_class: "OBSERVED",
      available_to_runtime_at: "2026-08-11T16:31:00.000Z",
      role_time: { observed_at: "2026-08-11T16:25:00.000Z", ingested_at: "2026-08-11T16:32:00.000Z" },
    })),
    row(record({
      record_type: "observed_rainfall_v1",
      source_record_id: "rain_o00",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
      epistemic_class: "OBSERVED",
      available_to_runtime_at: "2026-08-11T23:40:00.000Z",
      role_time: { interval_start: "2026-08-11T16:00:00.000Z", interval_end: T, ingested_at: "2026-08-11T23:41:00.000Z" },
    })),
    row(record({
      record_type: "historical_et0_estimate_v1",
      source_record_id: "hist_et0_o00",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
      epistemic_class: "ESTIMATED",
      available_to_runtime_at: "2026-08-11T23:42:00.000Z",
      role_time: { interval_start: "2026-08-11T16:00:00.000Z", interval_end: T, ingested_at: "2026-08-11T23:43:00.000Z" },
    })),
    row(record({
      record_type: "future_weather_assumption_v1",
      source_record_id: "future_weather_valid_o00",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
      epistemic_class: "ASSUMED",
      available_to_runtime_at: "2026-08-11T16:35:00.000Z",
      role_time: { issued_at: "2026-08-11T12:00:00.000Z", ingested_at: "2026-08-11T16:36:00.000Z" },
    })),
    row(record({
      record_type: "future_et0_assumption_v1",
      source_record_id: "future_et0_valid_o00",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
      epistemic_class: "ASSUMED",
      available_to_runtime_at: "2026-08-11T16:37:00.000Z",
      role_time: { issued_at: "2026-08-11T12:00:00.000Z", ingested_at: "2026-08-11T16:38:00.000Z" },
    })),
    // Prior exact interval is not the target interval for T and must not enter this tick.
    row(record({
      record_type: "observed_rainfall_v1",
      source_record_id: "rain_prior_interval",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
      epistemic_class: "OBSERVED",
      available_to_runtime_at: "2026-08-11T22:40:00.000Z",
      role_time: { interval_start: "2026-08-11T15:00:00.000Z", interval_end: "2026-08-11T16:00:00.000Z", ingested_at: "2026-08-11T22:41:00.000Z" },
    })),
    // Post-T future forcing remains unavailable even though the wall clock is later.
    row(record({
      record_type: "future_weather_assumption_v1",
      source_record_id: "future_weather_post_t",
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
      epistemic_class: "ASSUMED",
      available_to_runtime_at: "2026-08-11T17:01:00.000Z",
      role_time: { issued_at: "2026-08-11T12:00:00.000Z", ingested_at: "2026-08-11T17:02:00.000Z" },
    })),
  ];
}

function fakePool(rows: RowV1[]) {
  const sql: string[] = [];
  let connectCount = 0;
  let releaseCount = 0;
  const client = {
    async query(statement: string) {
      sql.push(statement);
      if (/^\s*SELECT\s+fact_id/i.test(statement)) return { rows: structuredClone(rows) };
      return { rows: [] };
    },
    release() { releaseCount += 1; },
  };
  const pool = {
    async connect() {
      connectCount += 1;
      return client;
    },
  } as unknown as Pool;
  return { pool, sql, connectCount: () => connectCount, releaseCount: () => releaseCount };
}

async function expectReject(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => error instanceof Error && error.message.includes(code));
}

function assertNoWriteSql(sql: readonly string[]): void {
  const joined = sql.join("\n");
  assert.match(joined, /BEGIN TRANSACTION READ ONLY/);
  assert.match(joined, /COMMIT/);
  assert.doesNotMatch(joined, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i);
}

function assertValidResult(result: ExternalFormalDatabaseEvidenceLoadResultV1): void {
  assert.equal(result.source_id, "MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_V1");
  assert.equal(result.logical_time, T);
  assert.equal(result.exact_interval_availability_cutoff_time, CUTOFF);
  assert.equal(result.database_read_transaction_count, 1);
  assert.equal(result.database_write_count, 0);
  assert.equal(result.provider_request_count, 0);
  assert.equal(result.selected_record_count, 5);
  assert.deepEqual(result.family_cardinality, {
    soil: 1,
    rainfall: 1,
    historical_et0: 1,
    future_weather: 1,
    future_et0: 1,
  });
  assert.equal(result.excluded_non_target_exact_interval_count, 1);
  assert.equal(result.excluded_after_causal_cutoff_count, 1);
  const byType = new Map(result.records.map((item) => [item.record_type, item]));
  assert.equal(byType.get("observed_rainfall_v1")?.available_to_runtime_at, "2026-08-11T23:40:00.000Z");
  assert.equal(byType.get("historical_et0_estimate_v1")?.available_to_runtime_at, "2026-08-11T23:42:00.000Z");
  assert.ok(Date.parse(String(byType.get("future_weather_assumption_v1")?.available_to_runtime_at)) <= Date.parse(T));
  assert.ok(Date.parse(String(byType.get("future_et0_assumption_v1")?.available_to_runtime_at)) <= Date.parse(T));
}

async function main(): Promise<void> {
  const good = fakePool(validRows());
  const source = new PostgresExternalFormalEvidenceSourceV1(good.pool);
  const result = await source.loadCandidateRecords({
    scope: SCOPE,
    logical_time: T,
    exact_interval_availability_cutoff_time: CUTOFF,
  });
  assertValidResult(result);
  assert.equal(good.connectCount(), 1);
  assert.equal(good.releaseCount(), 1);
  assertNoWriteSql(good.sql);

  const lateRows = validRows().map((item) => structuredClone(item));
  const lateRain = lateRows.find((item) => (item.record_json as { payload?: { source_record_id?: string } }).payload?.source_record_id === "rain_o00");
  assert.ok(lateRain);
  const latePayload = (lateRain.record_json as { payload: CanonicalReplayEvidenceRecordV1 }).payload;
  latePayload.available_to_runtime_at = "2026-08-12T00:13:00.000Z";
  latePayload.role_time.ingested_at = "2026-08-12T00:14:00.000Z";
  const late = fakePool(lateRows);
  await expectReject(() => new PostgresExternalFormalEvidenceSourceV1(late.pool).loadCandidateRecords({
    scope: SCOPE,
    logical_time: T,
    exact_interval_availability_cutoff_time: CUTOFF,
  }), "EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING:rainfall");
  assertNoWriteSql(late.sql);

  const cutoff = fakePool(validRows());
  await expectReject(() => new PostgresExternalFormalEvidenceSourceV1(cutoff.pool).loadCandidateRecords({
    scope: SCOPE,
    logical_time: T,
    exact_interval_availability_cutoff_time: "2026-08-12T00:13:00.000Z",
  }), "EA5E2_EXTERNAL_DB_EXACT_INTERVAL_CUTOFF_MISMATCH");
  assert.equal(cutoff.connectCount(), 0);
  assert.equal(cutoff.sql.length, 0);

  const futureRows = validRows().filter((item) => {
    const payload = (item.record_json as { payload?: CanonicalReplayEvidenceRecordV1 }).payload;
    return payload?.source_record_id !== "future_weather_valid_o00";
  });
  const future = fakePool(futureRows);
  await expectReject(() => new PostgresExternalFormalEvidenceSourceV1(future.pool).loadCandidateRecords({
    scope: SCOPE,
    logical_time: T,
    exact_interval_availability_cutoff_time: CUTOFF,
  }), "EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING:future_weather");
  assertNoWriteSql(future.sql);

  console.log(JSON.stringify({
    status: "PASS",
    selected_record_count: result.selected_record_count,
    family_cardinality: result.family_cardinality,
    delayed_rainfall_available_after_logical_time: true,
    delayed_historical_et0_available_after_logical_time: true,
    future_forcing_post_logical_time_excluded: true,
    non_target_exact_interval_excluded: true,
    exact_interval_cutoff_minutes: 432,
    database_read_transaction_count: result.database_read_transaction_count,
    database_write_count: result.database_write_count,
    provider_request_count: result.provider_request_count,
    historical_s2_s5_reader_modified: false,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
