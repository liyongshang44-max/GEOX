// Real PostgreSQL acceptance for MCFT-CAP-09.S2.
// Destructive isolated database only; proves the established facts envelope,
// JSONB scope predicates, role-time boundaries, deterministic readback, and
// a transaction-level read-only adapter boundary.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ShadowOnlineBoundaryV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_S2_POSTGRESQL_ACCEPTANCE_RESULT.json",
);
const SOURCE = "mcft_cap09_s2_database_evidence_acceptance_v1";
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const boundary: ShadowOnlineBoundaryV1 = {
  scope,
  slot_id: "O10",
  logical_time: "2026-08-05T10:00:00.000Z",
  scheduler_wall_clock_observed_at: "2026-08-05T10:00:02.000Z",
  interval_seconds: 3600,
};

type SupportedRecordType =
  | "soil_moisture_observation_v1"
  | "observed_rainfall_v1"
  | "historical_et0_estimate_v1"
  | "future_weather_assumption_v1"
  | "future_et0_assumption_v1";

type EvidenceSpec = {
  source_record_id: string;
  record_type: SupportedRecordType;
  event_time: string;
  ingested_at: string;
  available_at: string;
  quality?: "PASS" | "LIMITED" | "FAIL";
  override_scope?: Partial<TwinScopeKeyV1>;
  canonical_value?: number;
  source_record_hash?: string;
};

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function eventField(recordType: SupportedRecordType): string {
  if (recordType === "soil_moisture_observation_v1") return "observed_at";
  if (recordType === "observed_rainfall_v1" || recordType === "historical_et0_estimate_v1") {
    return "interval_end";
  }
  return "issued_at";
}

function digest(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function evidence(spec: EvidenceSpec): CanonicalReplayEvidenceRecordV1 {
  const mergedScope = { ...scope, ...(spec.override_scope ?? {}) };
  const canonicalPayload = {
    value: spec.canonical_value ?? 1,
    record_type: spec.record_type,
  };
  return {
    ...mergedScope,
    dataset_id: "mcft_cap09_s2_postgresql_acceptance_v1",
    source_record_id: spec.source_record_id,
    source_record_hash: spec.source_record_hash ?? digest({ id: spec.source_record_id, canonicalPayload }),
    record_type: spec.record_type,
    binding_id: `binding:${spec.record_type}`,
    origin_source_kind: "CONTROLLED_DATABASE_EVIDENCE",
    origin_source_id: `source:${spec.record_type}`,
    epistemic_class: spec.record_type.startsWith("future_") ? "FUTURE_ASSUMPTION" : "OBSERVED",
    available_to_runtime_at: spec.available_at,
    role_time: {
      [eventField(spec.record_type)]: spec.event_time,
      ingested_at: spec.ingested_at,
    },
    quality: { status: spec.quality ?? "PASS" },
    source_payload: { acceptance: true },
    canonical_payload: canonicalPayload,
    source_unit: "unitless",
    canonical_unit: "unitless",
    conversion_rule: { rule_id: "IDENTITY_V1" },
    limitations: [],
  };
}

async function initialize(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
}

async function insertFact(
  pool: Pool,
  factId: string,
  record: CanonicalReplayEvidenceRecordV1,
): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4::jsonb)`,
    [
      factId,
      record.available_to_runtime_at,
      SOURCE,
      JSON.stringify({ type: record.record_type, payload: record }),
    ],
  );
}

async function seed(pool: Pool): Promise<void> {
  const baseSoil = evidence({
    source_record_id: "soil-0915",
    record_type: "soil_moisture_observation_v1",
    event_time: "2026-08-05T09:15:00.000Z",
    ingested_at: "2026-08-05T09:16:00.000Z",
    available_at: "2026-08-05T09:16:00.000Z",
    canonical_value: 18.2,
  });
  const records: Array<[string, CanonicalReplayEvidenceRecordV1]> = [
    ["f01", baseSoil],
    ["f02", structuredClone(baseSoil)],
    ["f03", evidence({ source_record_id: "rain-0930", record_type: "observed_rainfall_v1", event_time: "2026-08-05T09:30:00.000Z", ingested_at: "2026-08-05T09:31:00.000Z", available_at: "2026-08-05T09:31:00.000Z" })],
    ["f04", evidence({ source_record_id: "weather-0940", record_type: "future_weather_assumption_v1", event_time: "2026-08-05T09:40:00.000Z", ingested_at: "2026-08-05T09:41:00.000Z", available_at: "2026-08-05T09:41:00.000Z" })],
    ["f05", evidence({ source_record_id: "et0-historical-0945", record_type: "historical_et0_estimate_v1", event_time: "2026-08-05T09:45:00.000Z", ingested_at: "2026-08-05T09:46:00.000Z", available_at: "2026-08-05T09:46:00.000Z", quality: "LIMITED" })],
    ["f06", evidence({ source_record_id: "et0-future-0950", record_type: "future_et0_assumption_v1", event_time: "2026-08-05T09:50:00.000Z", ingested_at: "2026-08-05T09:51:00.000Z", available_at: "2026-08-05T09:52:00.000Z" })],
    ["f07", evidence({ source_record_id: "soil-out-of-order-0920", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T09:20:00.000Z", ingested_at: "2026-08-05T09:55:00.000Z", available_at: "2026-08-05T09:56:00.000Z", canonical_value: 18.3 })],
    ["f08", evidence({ source_record_id: "soil-after-boundary", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T10:05:00.000Z", ingested_at: "2026-08-05T10:06:00.000Z", available_at: "2026-08-05T10:06:00.000Z" })],
    ["f09", evidence({ source_record_id: "rain-late-ingested", record_type: "observed_rainfall_v1", event_time: "2026-08-05T09:35:00.000Z", ingested_at: "2026-08-05T10:02:00.000Z", available_at: "2026-08-05T10:02:00.000Z" })],
    ["f10", evidence({ source_record_id: "soil-late-available", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T09:36:00.000Z", ingested_at: "2026-08-05T09:37:00.000Z", available_at: "2026-08-05T10:03:00.000Z" })],
    ["f11", evidence({ source_record_id: "soil-quality-fail", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T09:25:00.000Z", ingested_at: "2026-08-05T09:26:00.000Z", available_at: "2026-08-05T09:26:00.000Z", quality: "FAIL" })],
    ["f12", evidence({ source_record_id: "soil-open-start-excluded", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T09:00:00.000Z", ingested_at: "2026-08-05T09:01:00.000Z", available_at: "2026-08-05T09:58:00.000Z" })],
    ["f13", evidence({ source_record_id: "wrong-scope", record_type: "soil_moisture_observation_v1", event_time: "2026-08-05T09:25:00.000Z", ingested_at: "2026-08-05T09:26:00.000Z", available_at: "2026-08-05T09:26:00.000Z", override_scope: { zone_id: "zoneB" } })],
  ];
  for (const [factId, record] of records) await insertFact(pool, factId, record);
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP_09_S2_DESTRUCTIVE_ACCEPTANCE_1");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!/(mcft|cap.*09|s2|evidence|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapterSql: string[] = [];
  try {
    await initialize(pool);
    await seed(pool);

    const loggingPool = {
      async connect() {
        const client = await pool.connect();
        return {
          async query(sql: string, values?: any[]) {
            adapterSql.push(sql);
            return client.query(sql, values);
          },
          release() {
            client.release();
          },
        };
      },
    };
    const adapter = new PostgresEvidenceIngressAdapterV1(
      loggingPool as never,
      DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
    );
    const first = await adapter.freezeEligibleEvidence({ boundary });
    const second = await adapter.freezeEligibleEvidence({ boundary });
    assert.deepEqual(second, first, "deterministic repeated freeze");

    assert.equal(first.window_rule, "OPEN_START_CLOSED_END_PT1H_V1");
    assert.equal(first.selected.length, 6);
    assert.equal(first.excluded.length, 5);
    assert.deepEqual(first.outside_window_evidence_refs, ["soil-open-start-excluded"]);
    assert.deepEqual(first.out_of_order_evidence_refs, ["soil-out-of-order-0920"]);
    assert.equal(first.coverage_ratio_decimal, "1.000000");
    assert.equal(first.maximum_gap_seconds, 900);
    assert.equal(first.freshest_observed_at, "2026-08-05T09:50:00.000Z");
    assert.equal(first.freshness_status, "FRESH");
    assert.equal(first.future_evidence_leakage, false);
    assert.equal(first.candidate_limit_reached, false);

    const selectedRefs = new Set(first.selected.map((item) => item.evidence_ref));
    assert(selectedRefs.has("weather-0940"), "future weather known at boundary must remain eligible");
    assert(selectedRefs.has("et0-future-0950"), "future ET0 known at boundary must remain eligible");
    assert(!selectedRefs.has("wrong-scope"), "six-key SQL scope must exclude wrong zone");
    const reasonCounts = new Map<string, number>();
    for (const item of first.excluded) {
      reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1);
    }
    assert.equal(reasonCounts.get("DUPLICATE_SUPERSEDED"), 1);
    assert.equal(reasonCounts.get("OBSERVED_AFTER_BOUNDARY"), 1);
    assert.equal(reasonCounts.get("INGESTED_AFTER_BOUNDARY"), 1);
    assert.equal(reasonCounts.get("AVAILABLE_AFTER_BOUNDARY"), 1);
    assert.equal(reasonCounts.get("QUALITY_INELIGIBLE"), 1);

    assert.equal(adapterSql.filter((sql) => /^BEGIN TRANSACTION READ ONLY$/i.test(sql)).length, 2);
    assert.equal(adapterSql.filter((sql) => /^COMMIT$/i.test(sql)).length, 2);
    const selects = adapterSql.filter((sql) => /FROM facts/i.test(sql));
    assert.equal(selects.length, 2);
    for (const sql of selects) {
      assert.match(sql, /record_json#>>'\{payload,season_id\}' = \$5/);
      assert.match(sql, /record_json#>>'\{payload,zone_id\}' = \$6/);
      assert.match(sql, /occurred_at > \$8::timestamptz/);
      assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
    }

    const conflict = evidence({
      source_record_id: "soil-0915",
      source_record_hash: digest({ conflict: true }),
      record_type: "soil_moisture_observation_v1",
      event_time: "2026-08-05T09:15:00.000Z",
      ingested_at: "2026-08-05T09:17:00.000Z",
      available_at: "2026-08-05T09:17:00.000Z",
      canonical_value: 99,
    });
    await insertFact(pool, "f14", conflict);
    await assert.rejects(
      () => adapter.freezeEligibleEvidence({ boundary }),
      /EVIDENCE_IDENTITY_CONFLICT:soil-0915/,
    );

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRESQL_ISOLATED_FACTS_READBACK",
      selected_count: first.selected.length,
      excluded_count: first.excluded.length,
      outside_window_count: first.outside_window_evidence_refs.length,
      out_of_order_count: first.out_of_order_evidence_refs.length,
      eligible_future_forcing_count: first.selected.filter((item) => item.evidence_kind.startsWith("future_")).length,
      exact_duplicate_deduplicated: true,
      conflicting_identity_rejected: true,
      six_key_scope_sql_verified: true,
      open_start_closed_end_verified: true,
      read_only_transaction_verified: true,
      database_write_performed: false,
      scheduler_loop_executed: false,
      canonical_write_performed: false,
      future_evidence_leakage: false,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify({ status: "FAIL", error: String(error?.message ?? error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
