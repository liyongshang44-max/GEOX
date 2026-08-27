import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { buildAppleIIEvidenceSufficiencyV1 } from "./appleii_evidence_sufficiency_v1.js";

function physical(health: string, validity: string) {
  return {
    schema_version: "ingress_physical_qc_snapshot_v1",
    physical_qc: {
      measurement_health: health,
      physical_validity: validity,
    },
  };
}

test("Apple-II exposes shadow EvidenceQualificationV1 objects without changing its legacy sufficiency verdict", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const rows = [
    {
      sample_id: "rs_valid",
      sensor_id: "dev_001",
      ts_ms: now - 30 * 60_000,
      metric: "soil_moisture",
      value: 0.22,
      qc_quality: "ok",
      source: "device",
      created_at: new Date(now - 29 * 60_000).toISOString(),
      payload_json: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        ingress_physical_qc: physical("VALID", "PASS"),
      },
    },
    {
      sample_id: "rs_invalid",
      sensor_id: "dev_001",
      ts_ms: now - 15 * 60_000,
      metric: "soil_moisture",
      value: 1.7,
      qc_quality: "ok",
      source: "device",
      created_at: new Date(now - 14 * 60_000).toISOString(),
      payload_json: {
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        ingress_physical_qc: physical("INVALID", "FAIL"),
      },
    },
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
    expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 1,
    min_coverage_ratio: 0,
    max_gap_ms: 60 * 60_000,
    freshness_max_age_ms: 60 * 60_000,
  });

  // Existing Apple-II behavior remains authoritative in B-04d3.
  assert.equal(result.evidence_sufficiency, "NEEDS_EVIDENCE");
  assert.ok(result.reason_codes.includes("PHYSICAL_QC_INELIGIBLE_SAMPLE"));

  const projection = result.canonical_evidence_qualification_projection_v1;
  assert.equal(projection.authority_mode, "SHADOW_NON_AUTHORITATIVE");
  assert.equal(projection.qualifications.length, 2);
  assert.deepEqual(projection.counts, {
    total: 2,
    qualified: 0,
    limited: 1,
    ineligible: 1,
    unknown: 0,
  });

  const byId = new Map(projection.qualifications.map((q) => [q.observation_id, q]));
  const valid = byId.get("raw_sample:rs_valid");
  const invalid = byId.get("raw_sample:rs_invalid");

  assert.equal(valid?.schema_version, "evidence_qualification_v1");
  assert.equal(valid?.physical_validity, "PASS");
  assert.equal(valid?.temporal_eligibility, "UNKNOWN");
  assert.equal(valid?.evidence_authority, "LIMITED");
  assert.ok(valid?.reason_codes.includes("POST_COMMIT_RUNTIME_AVAILABILITY_NOT_ESTABLISHED"));

  assert.equal(invalid?.physical_validity, "FAIL");
  assert.equal(invalid?.evidence_authority, "INELIGIBLE");
  assert.equal(invalid?.role_eligibility[0]?.eligibility, "INELIGIBLE");
});
