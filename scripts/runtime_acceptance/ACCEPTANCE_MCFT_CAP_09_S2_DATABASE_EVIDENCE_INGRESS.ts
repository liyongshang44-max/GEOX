// Real PostgreSQL acceptance for MCFT-CAP-09.S2 Database Evidence ingress.
// Destructive only against an isolated acceptance database.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  PostgresEvidenceIngressAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ShadowOnlineBoundaryV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RESULT_PATH = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_RESULT.json",
);
const SOURCE = "mcft_cap09_s2_r3_postgresql_acceptance";
const BOUNDARY_TIME = "2026-08-06T00:00:00.000Z";
const SCOPE: TwinScopeKeyV1 = {
  tenant_id: "tenant_cap09_s2",
  project_id: "project_cap09_s2",
  group_id: "group_cap09_s2",
  field_id: "field_cap09_s2",
  season_id: "season_cap09_s2",
  zone_id: "zone_cap09_s2",
};

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function eventField(recordType: string): string {
  if (recordType === "soil_moisture_observation_v1") return "observed_at";
  if (recordType === "observed_rainfall_v1") return "interval_end";
  if (recordType === "historical_et0_estimate_v1") return "interval_end";
  if (recordType === "future_weather_assumption_v1") return "issued_at";
  if (recordType === "future_et0_assumption_v1") return "issued_at";
  throw new Error(`UNSUPPORTED_FIXTURE_RECORD_TYPE:${recordType}`);
}

function replayRecord(input: {
  record_type: string;
  source_record_id: string;
  origin_source_id: string;
  event_time: string;
  ingested_at: string;
  available_to_runtime_at: string;
  scope?: TwinScopeKeyV1;
  quality_status?: string;
  canonical_value?: number;
  epistemic_class?: string;
  formal_eligible?: boolean;
  is_simulated?: boolean;
  evidence_level?: string;
  source_lane?: string;
}): CanonicalReplayEvidenceRecordV1 {
  const scope = input.scope ?? SCOPE;
  const canonicalPayload = {
    value: input.canonical_value ?? 0.31,
    unit: input.record_type === "soil_moisture_observation_v1" ? "fraction" : "mm",
  };
  const roleTime: Record<string, unknown> = {
    [eventField(input.record_type)]: input.event_time,
    ingested_at: input.ingested_at,
  };
  if (input.record_type.endsWith("rainfall_v1") || input.record_type === "historical_et0_estimate_v1") {
    roleTime.interval_start = addMinutes(input.event_time, -60);
  }
  const semantic = {
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    origin_source_id: input.origin_source_id,
    role_time: roleTime,
    canonical_payload: canonicalPayload,
  };
  return {
    ...scope,
    dataset_id: "mcft_cap09_s2_r3_db_fixture_v1",
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.record_type,
    binding_id: `binding_${input.record_type}`,
    origin_source_kind: "CONTROLLED_POSTGRESQL_ACCEPTANCE",
    origin_source_id: input.origin_source_id,
    epistemic_class: input.epistemic_class ?? (
      input.record_type.startsWith("future_") ? "FUTURE_ASSUMPTION" : "OBSERVED"
    ),
    available_to_runtime_at: input.available_to_runtime_at,
    role_time: roleTime,
    quality: { status: input.quality_status ?? "PASS" },
    source_payload: {
      ...canonicalPayload,
      ...(input.formal_eligible === undefined ? {} : { formal_eligible: input.formal_eligible }),
      ...(input.is_simulated === undefined ? {} : { is_simulated: input.is_simulated }),
      ...(input.evidence_level === undefined ? {} : { evidence_level: input.evidence_level }),
      ...(input.source_lane === undefined ? {} : { source_lane: input.source_lane }),
    },
    canonical_payload: canonicalPayload,
    source_unit: canonicalPayload.unit,
    canonical_unit: canonicalPayload.unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["S2_REAL_POSTGRESQL_ACCEPTANCE_ONLY"],
  };
}

function envelope(record: CanonicalReplayEvidenceRecordV1): Record<string, unknown> {
  return { type: record.record_type, payload: record };
}

async function initialize(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
}

async function insertReplay(client: PoolClient, record: CanonicalReplayEvidenceRecordV1): Promise<void> {
  await client.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4::jsonb)`,
    [
      `fact_${record.source_record_id}`,
      record.available_to_runtime_at,
      SOURCE,
      JSON.stringify(envelope(record)),
    ],
  );
}

async function insertOperationalUnbound(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES
       ($1, $2::timestamptz, $3, $4::jsonb),
       ($5, $6::timestamptz, $7, $8::jsonb)`,
    [
      "fact_raw_unbound",
      addMinutes(BOUNDARY_TIME, -10),
      SOURCE,
      JSON.stringify({
        type: "raw_telemetry_v1",
        payload: { tenant_id: SCOPE.tenant_id, device_id: "device_raw", observed_at: addMinutes(BOUNDARY_TIME, -10) },
      }),
      "fact_device_unbound",
      addMinutes(BOUNDARY_TIME, -9),
      SOURCE,
      JSON.stringify({
        type: "device_observation_v1",
        entity: {
          tenant_id: SCOPE.tenant_id,
          project_id: SCOPE.project_id,
          group_id: SCOPE.group_id,
          field_id: SCOPE.field_id,
          device_id: "device_normalized",
        },
        payload: {
          observed_at: addMinutes(BOUNDARY_TIME, -9),
          formal_eligible: true,
          is_simulated: false,
          evidence_level: "FORMAL",
        },
      }),
    ],
  );
}

function baselineRecords(): CanonicalReplayEvidenceRecordV1[] {
  const wrongScope = { ...SCOPE, zone_id: "zone_other" };
  return [
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "soil_exact_duplicate_a",
      origin_source_id: "soil_sensor_1",
      event_time: addMinutes(BOUNDARY_TIME, -45),
      ingested_at: addMinutes(BOUNDARY_TIME, -40),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -39),
      canonical_value: 0.31,
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "soil_exact_duplicate_b",
      origin_source_id: "soil_sensor_1",
      event_time: addMinutes(BOUNDARY_TIME, -45),
      ingested_at: addMinutes(BOUNDARY_TIME, -35),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -34),
      canonical_value: 0.31,
    }),
    replayRecord({
      record_type: "observed_rainfall_v1",
      source_record_id: "rain_eligible",
      origin_source_id: "weather_station_1",
      event_time: addMinutes(BOUNDARY_TIME, -25),
      ingested_at: addMinutes(BOUNDARY_TIME, -20),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -19),
      canonical_value: 0.4,
    }),
    replayRecord({
      record_type: "historical_et0_estimate_v1",
      source_record_id: "et0_eligible",
      origin_source_id: "et0_provider_1",
      event_time: addMinutes(BOUNDARY_TIME, -5),
      ingested_at: addMinutes(BOUNDARY_TIME, -4),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -3),
      canonical_value: 0.12,
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "scope_mismatch",
      origin_source_id: "soil_sensor_other",
      event_time: addMinutes(BOUNDARY_TIME, -50),
      ingested_at: addMinutes(BOUNDARY_TIME, -49),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -48),
      scope: wrongScope,
    }),
    replayRecord({
      record_type: "future_weather_assumption_v1",
      source_record_id: "future_assumption",
      origin_source_id: "forecast_provider_1",
      event_time: addMinutes(BOUNDARY_TIME, -20),
      ingested_at: addMinutes(BOUNDARY_TIME, -18),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -17),
      epistemic_class: "FUTURE_ASSUMPTION",
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "observed_after_boundary",
      origin_source_id: "soil_sensor_future",
      event_time: addMinutes(BOUNDARY_TIME, 5),
      ingested_at: addMinutes(BOUNDARY_TIME, -2),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, 10),
    }),
    replayRecord({
      record_type: "observed_rainfall_v1",
      source_record_id: "ingested_after_boundary",
      origin_source_id: "weather_station_late_ingest",
      event_time: addMinutes(BOUNDARY_TIME, -30),
      ingested_at: addMinutes(BOUNDARY_TIME, 2),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -1),
    }),
    replayRecord({
      record_type: "historical_et0_estimate_v1",
      source_record_id: "available_after_boundary",
      origin_source_id: "et0_provider_late",
      event_time: addMinutes(BOUNDARY_TIME, -30),
      ingested_at: addMinutes(BOUNDARY_TIME, -20),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, 3),
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "quality_fail",
      origin_source_id: "soil_sensor_failed",
      event_time: addMinutes(BOUNDARY_TIME, -35),
      ingested_at: addMinutes(BOUNDARY_TIME, -34),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -33),
      quality_status: "FAIL",
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "simulated_debug",
      origin_source_id: "soil_sensor_simulated",
      event_time: addMinutes(BOUNDARY_TIME, -15),
      ingested_at: addMinutes(BOUNDARY_TIME, -14),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -13),
      is_simulated: true,
      formal_eligible: false,
      evidence_level: "DEBUG",
      source_lane: "SIMULATED_DEV_ONLY",
    }),
    replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "open_start_excluded",
      origin_source_id: "soil_sensor_window_start",
      event_time: addMinutes(BOUNDARY_TIME, -60),
      ingested_at: addMinutes(BOUNDARY_TIME, -59),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -58),
    }),
  ];
}

async function factCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM facts WHERE source=$1",
    [SOURCE],
  );
  return result.rows[0].count;
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE_1");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!/(mcft.*cap.*09.*s2|cap09.*s2|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await initialize(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const record of baselineRecords()) await insertReplay(client, record);
      await insertOperationalUnbound(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const boundary: ShadowOnlineBoundaryV1 = {
      scope: SCOPE,
      slot_id: "O00",
      logical_time: BOUNDARY_TIME,
      scheduler_wall_clock_observed_at: BOUNDARY_TIME,
      interval_seconds: 3600,
    };
    const adapter = new PostgresEvidenceIngressAdapterV1(pool);
    const before = await factCount(pool);
    const first = await adapter.freezeEligibleEvidence({ boundary });
    const diagnostics = adapter.readLastFreezeDiagnostics();
    const after = await factCount(pool);

    assert.equal(before, after, "ADAPTER_MUST_NOT_WRITE_FACTS");
    assert.deepEqual(
      first.selected.map((item) => item.evidence_ref),
      ["soil_exact_duplicate_b", "rain_eligible", "et0_eligible"],
      "ESTABLISHED_REPLAY_RECORD_TYPES_SELECTED",
    );
    const reasons = new Set(first.excluded.map((item) => item.reason));
    for (const reason of [
      "DUPLICATE_SUPERSEDED",
      "SCOPE_MISMATCH",
      "FUTURE_EVIDENCE",
      "OBSERVED_AFTER_BOUNDARY",
      "INGESTED_AFTER_BOUNDARY",
      "AVAILABLE_AFTER_BOUNDARY",
      "QUALITY_INELIGIBLE",
    ] as const) {
      assert(reasons.has(reason), `EXCLUSION_REASON_REQUIRED:${reason}`);
    }
    assert.equal(diagnostics.window_rule_id, "OPEN_START_CLOSED_END_PT1H_V1");
    assert.equal(diagnostics.outside_window_excluded_count, 1, "OPEN_START_ROW_MUST_BE_OUTSIDE");
    assert.deepEqual(diagnostics.outside_window_evidence_refs, ["open_start_excluded"]);
    assert.equal(diagnostics.unsupported_operational_type_count, 2, "UNBOUND_OPERATIONAL_TYPES_MUST_NOT_BE_CONSUMED");
    assert.equal(diagnostics.database_transaction_mode, "READ_ONLY");
    assert.equal(first.coverage_ratio_decimal, "1.000000", "INTERVAL_BUCKET_COVERAGE_REQUIRED");
    assert.equal(diagnostics.interval_bucket_count, 2);
    assert.equal(diagnostics.covered_interval_bucket_count, 2);
    assert.equal(first.future_evidence_leakage, false);
    assert.equal(first.freshness_status, "FRESH");
    assert.equal(first.maximum_gap_seconds, 1200);

    const second = await adapter.freezeEligibleEvidence({ boundary });
    assert.deepEqual(second, first, "DETERMINISTIC_REPEATED_FREEZE_REQUIRED");

    const conflictA = replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "conflict_a",
      origin_source_id: "soil_sensor_conflict",
      event_time: addMinutes(BOUNDARY_TIME, -12),
      ingested_at: addMinutes(BOUNDARY_TIME, -11),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -10),
      canonical_value: 0.29,
    });
    const conflictB = replayRecord({
      record_type: "soil_moisture_observation_v1",
      source_record_id: "conflict_b",
      origin_source_id: "soil_sensor_conflict",
      event_time: addMinutes(BOUNDARY_TIME, -12),
      ingested_at: addMinutes(BOUNDARY_TIME, -9),
      available_to_runtime_at: addMinutes(BOUNDARY_TIME, -8),
      canonical_value: 0.35,
    });
    const conflictClient = await pool.connect();
    try {
      await conflictClient.query("BEGIN");
      await insertReplay(conflictClient, conflictA);
      await insertReplay(conflictClient, conflictB);
      await conflictClient.query("COMMIT");
    } catch (error) {
      await conflictClient.query("ROLLBACK");
      throw error;
    } finally {
      conflictClient.release();
    }
    await assert.rejects(
      () => adapter.freezeEligibleEvidence({ boundary }),
      /CONFLICTING_DUPLICATE_OBSERVATION/,
      "CONFLICTING_DUPLICATE_MUST_FAIL_CLOSED",
    );
    await pool.query(
      "DELETE FROM facts WHERE fact_id = ANY($1::text[])",
      [["fact_conflict_a", "fact_conflict_b"]],
    );
    const restored = await adapter.freezeEligibleEvidence({ boundary });
    assert.deepEqual(restored, first, "CONFLICT_FIXTURE_CLEANUP_MUST_RESTORE_BASELINE");

    const existing = fs.existsSync(RESULT_PATH)
      ? JSON.parse(fs.readFileSync(RESULT_PATH, "utf8")) as Record<string, unknown>
      : {};
    const result = {
      ...existing,
      status: "PASS",
      database_integration_proven: true,
      real_postgresql_facts_path: true,
      read_only_transaction_proven: true,
      established_replay_envelope_bound: true,
      selected_record_types: [...new Set(first.selected.map((item) => item.evidence_kind))].sort(),
      selected_evidence_count: first.selected.length,
      explicit_exclusion_reason_count: reasons.size,
      outside_window_excluded_count: diagnostics.outside_window_excluded_count,
      unsupported_operational_type_count: diagnostics.unsupported_operational_type_count,
      conflicting_duplicate_rejected: true,
      exact_semantic_duplicate_deterministic: true,
      interval_coverage_proven: true,
      future_evidence_leakage_blocked: true,
      database_write_performed: false,
      scheduler_loop_executed: false,
      canonical_write_performed: false,
      public_http_writer_present: false,
      live_device_gateway_present: false,
      model_activation: false,
      controlled_action: false,
      repeated_freeze_deterministic: true,
    };
    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const failure = { status: "FAIL", error: String(error instanceof Error ? error.message : error) };
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(failure, null, 2)}\n`);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
