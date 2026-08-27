import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";

import {
  appendRawSampleV1,
  normalizeRawSampleSourceV1,
} from "./raw_sample_fact_envelope_v1.js";
import { buildAppleIIEvidenceSufficiencyV1 } from "./appleii_evidence_sufficiency_v1.js";
import { evaluateRawSampleObservationQualityV1 } from "../../evidence/raw_sample_measurement_quality_v1.js";

test("missing or unrecognized raw-sample source remains UNKNOWN rather than becoming device", () => {
  assert.equal(normalizeRawSampleSourceV1(undefined), "unknown");
  assert.equal(normalizeRawSampleSourceV1(""), "unknown");
  assert.equal(normalizeRawSampleSourceV1("mystery-provider"), "unknown");
  assert.equal(normalizeRawSampleSourceV1("device"), "device");
  assert.equal(normalizeRawSampleSourceV1("GATEWAY"), "gateway");
});

test("unknown and bad caller QC cannot be promoted into official observation pipeline", () => {
  assert.deepEqual(evaluateRawSampleObservationQualityV1("unknown"), {
    quality_flags: ["MISSING_CONTEXT"],
    observation_pipeline_eligible: false,
    reason_code: "RAW_SAMPLE_QC_UNKNOWN",
  });
  assert.deepEqual(evaluateRawSampleObservationQualityV1("bad"), {
    quality_flags: ["OUTLIER"],
    observation_pipeline_eligible: false,
    reason_code: "RAW_SAMPLE_QC_BAD",
  });
  assert.equal(evaluateRawSampleObservationQualityV1("suspect").quality_flags[0], "SUSPECT");
  assert.equal(evaluateRawSampleObservationQualityV1("suspect").observation_pipeline_eligible, true);
});

test("append without source persists explicit unknown source authority", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO raw_samples")) {
        return { rows: [{ sample_id: "rs_unknown_source" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  const item = await appendRawSampleV1(
    pool,
    {
      sample_id: "rs_unknown_source",
      sensor_id: "dev_001",
      field_id: "fieldA",
      ts_ms: Date.parse("2026-08-27T04:00:00Z"),
      metric: "soil_moisture",
      value: 0.22,
      unit: "m3/m3",
      qc_quality: "ok",
      payload: {},
    },
    { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
  );

  assert.equal(item.source, "unknown");
  assert.equal(item.payload_json.source, "unknown");

  const rawInsert = queries.find((entry) => entry.sql.includes("INSERT INTO raw_samples"));
  assert.ok(rawInsert);
  assert.equal(rawInsert.params[6], "unknown");
});

test("Apple-II raw-sample and device-health reads are project/scope and decision-time bounded", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const rawRow = {
    sample_id: "rs_scope_time",
    sensor_id: "dev_001",
    ts_ms: now - 10 * 60_000,
    metric: "soil_moisture",
    value: 0.21,
    qc_quality: "ok",
    source: "device",
    created_at: new Date(now - 5 * 60_000).toISOString(),
    payload_json: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      ingress_physical_qc: {
        schema_version: "ingress_physical_qc_snapshot_v1",
        physical_qc: {
          measurement_health: "VALID",
          physical_validity: "PASS",
        },
      },
    },
  };

  const db = {
    query: async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      if (sql.includes("FROM raw_samples")) return { rows: [rawRow], rowCount: 1 };
      if (sql.includes("FROM device_status_index_v1")) {
        return {
          rows: [{
            last_telemetry_ts_ms: now - 60_000,
            last_heartbeat_ts_ms: now - 60_000,
            battery_percent: 95,
            rssi_dbm: -55,
            updated_ts_ms: now - 60_000,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  await buildAppleIIEvidenceSufficiencyV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_001",
    now_ms: now,
    observation_window_ms: 60 * 60_000,
    expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 1,
    min_coverage_ratio: 0,
    max_gap_ms: 60 * 60_000,
    freshness_max_age_ms: 60 * 60_000,
  });

  const rawQuery = calls.find((call) => call.sql.includes("FROM raw_samples"));
  assert.ok(rawQuery);
  assert.ok(rawQuery.sql.includes("(payload_json ->> 'project_id') = $4"));
  assert.ok(rawQuery.sql.includes("(payload_json ->> 'group_id') = $5"));
  assert.ok(rawQuery.sql.includes("(payload_json ->> 'field_id') = $6"));
  assert.ok(rawQuery.sql.includes("sensor_id = $7"));
  assert.ok(rawQuery.sql.includes("created_at <= to_timestamp($8 / 1000.0)"));
  assert.equal(rawQuery.args.length, 8);
  assert.equal(rawQuery.args.at(-1), now);
  assert.ok(!rawQuery.sql.includes("(payload_json ->> 'project_id') = 4"));

  const statusQuery = calls.find((call) => call.sql.includes("FROM device_status_index_v1"));
  assert.ok(statusQuery);
  assert.ok(statusQuery.sql.includes("project_id = $3"));
  assert.ok(statusQuery.sql.includes("group_id = $4"));
  assert.ok(statusQuery.sql.includes("field_id = $5"));
  assert.ok(statusQuery.sql.includes("updated_ts_ms IS NOT NULL AND updated_ts_ms <= $6"));
  assert.equal(statusQuery.args.length, 6);
  assert.equal(statusQuery.args.at(-1), now);
  assert.ok(!statusQuery.sql.includes("project_id = 3"));
});

test("Apple-II excludes unknown/bad source-quality rows from formal evidence without deleting total evidence", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const qc = {
    schema_version: "ingress_physical_qc_snapshot_v1",
    physical_qc: { measurement_health: "VALID", physical_validity: "PASS" },
  };
  const mk = (sample_id: string, source: string, quality: string, offset: number) => ({
    sample_id,
    sensor_id: "dev_001",
    ts_ms: now - offset,
    metric: "soil_moisture",
    value: 0.21,
    qc_quality: quality,
    source,
    payload_json: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      ingress_physical_qc: qc,
    },
  });
  const rows = [
    mk("rs_ok", "device", "ok", 30 * 60_000),
    mk("rs_unknown_qc", "device", "unknown", 20 * 60_000),
    mk("rs_bad_qc", "gateway", "bad", 10 * 60_000),
    mk("rs_unknown_source", "unknown", "ok", 5 * 60_000),
  ];

  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM raw_samples")) return { rows, rowCount: rows.length };
      if (sql.includes("FROM device_status_index_v1")) {
        return {
          rows: [{
            last_telemetry_ts_ms: now - 60_000,
            last_heartbeat_ts_ms: now - 60_000,
            battery_percent: 95,
            rssi_dbm: -55,
            updated_ts_ms: now - 60_000,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  const result = await buildAppleIIEvidenceSufficiencyV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_001",
    now_ms: now,
    observation_window_ms: 60 * 60_000,
    min_sample_count: 1,
    min_coverage_ratio: 0,
    max_gap_ms: 60 * 60_000,
    freshness_max_age_ms: 60 * 60_000,
  });

  assert.equal(result.time_coverage_v1.sample_count, 4);
  assert.equal(result.time_coverage_v1.formal_sample_count, 1);
  assert.equal(result.time_coverage_v1.non_formal_sample_count, 3);
  assert.equal(result.time_coverage_v1.formal_source_eligible, false);
  assert.ok(result.reason_codes.includes("RAW_SAMPLE_QC_UNKNOWN_NOT_FORMAL"));
  assert.ok(result.reason_codes.includes("RAW_SAMPLE_QC_BAD_NOT_FORMAL"));
  assert.ok(result.reason_codes.includes("NON_FORMAL_SAMPLE_SOURCE"));
});
