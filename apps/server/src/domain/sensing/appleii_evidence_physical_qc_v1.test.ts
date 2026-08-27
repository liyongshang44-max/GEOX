import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { buildAppleIIEvidenceSufficiencyV1 } from "./appleii_evidence_sufficiency_v1.js";

function qc(health: string, validity: string) {
  return {
    schema_version: "ingress_physical_qc_snapshot_v1",
    physical_qc: {
      measurement_health: health,
      physical_validity: validity,
    },
  };
}

function sample(id: string, ts: number, value: number, physical: any) {
  return {
    sample_id: id,
    sensor_id: "dev_soil_001",
    ts_ms: ts,
    metric: "soil_moisture",
    value,
    qc_quality: "ok",
    source: "device",
    payload_json: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      ingress_physical_qc: physical,
    },
  };
}

function fakeDb(rows: any[], now: number): PoolClient {
  return {
    query: async (sql: string) => {
      if (sql.includes("FROM raw_samples")) return { rows, rowCount: rows.length };
      if (sql.includes("FROM device_status_index_v1")) {
        return {
          rows: [{
            last_telemetry_ts_ms: now - 60_000,
            last_heartbeat_ts_ms: now - 60_000,
            battery_percent: 95,
            rssi_dbm: -55,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;
}

test("invalid raw sample cannot contribute to Apple-II formal coverage or trigger evidence", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const rows = [
    sample("rs_valid_1", now - 90 * 60_000, 0.21, qc("VALID", "PASS")),
    sample("rs_invalid", now - 60 * 60_000, 1.7, qc("INVALID", "FAIL")),
    sample("rs_valid_2", now - 30 * 60_000, 0.22, qc("VALID", "PASS")),
  ];

  const result = await buildAppleIIEvidenceSufficiencyV1(fakeDb(rows, now), {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_soil_001",
    now_ms: now,
    observation_window_ms: 2 * 60 * 60_000,
    expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 3,
    min_coverage_ratio: 0,
    max_gap_ms: 2 * 60 * 60_000,
    freshness_max_age_ms: 2 * 60 * 60_000,
  });

  assert.equal(result.time_coverage_v1.sample_count, 3);
  assert.equal(result.time_coverage_v1.formal_sample_count, 2);
  assert.equal(result.time_coverage_v1.non_formal_sample_count, 1);
  assert.equal(result.time_coverage_v1.formal_metric_lanes.soil_moisture?.sample_count, 2);
  assert.equal(result.evidence_sufficiency, "NEEDS_EVIDENCE");
  assert.ok(result.reason_codes.includes("PHYSICAL_QC_INELIGIBLE_SAMPLE"));
  assert.ok(result.reason_codes.includes("INSUFFICIENT_FORMAL_SAMPLE_COUNT"));
});

test("legacy rows without snapshot retain compatibility behavior in this bounded phase", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const rows = [
    sample("rs_legacy_1", now - 60 * 60_000, 0.2, undefined),
    sample("rs_legacy_2", now - 30 * 60_000, 0.21, undefined),
    sample("rs_legacy_3", now - 5 * 60_000, 0.22, undefined),
  ].map((row) => {
    delete row.payload_json.ingress_physical_qc;
    return row;
  });

  const result = await buildAppleIIEvidenceSufficiencyV1(fakeDb(rows, now), {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "fieldA",
    device_id: "dev_soil_001",
    now_ms: now,
    observation_window_ms: 90 * 60_000,
    expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 3,
    min_coverage_ratio: 0,
    max_gap_ms: 2 * 60 * 60_000,
    freshness_max_age_ms: 2 * 60 * 60_000,
  });

  assert.equal(result.time_coverage_v1.formal_sample_count, 3);
  assert.ok(!result.reason_codes.includes("PHYSICAL_QC_INELIGIBLE_SAMPLE"));
  assert.ok(!result.reason_codes.includes("PHYSICAL_QC_UNKNOWN_SAMPLE"));
});
