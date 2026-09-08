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


test("B-04d3r1 late backfill appears only in canonical shadow and cannot change Apple-II sufficiency", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const visible = {
    sample_id: "rs_visible", sensor_id: "dev_001", ts_ms: now - 30 * 60_000,
    metric: "soil_moisture", value: 0.22, qc_quality: "ok", source: "device",
    created_at: new Date(now - 29 * 60_000).toISOString(),
    payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") },
  };
  const late = {
    sample_id: "rs_late_backfill", sensor_id: "dev_001", ts_ms: now - 20 * 60_000,
    metric: "soil_moisture", value: 0.23, qc_quality: "ok", source: "device",
    created_at: new Date(now + 5 * 60_000).toISOString(),
    payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") },
  };
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    query: async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      if (sql.includes("FROM raw_samples") && sql.includes("created_at >")) return { rows: [late], rowCount: 1 };
      if (sql.includes("FROM raw_samples")) return { rows: [visible], rowCount: 1 };
      if (sql.includes("FROM device_status_index_v1")) return { rows: [{ last_telemetry_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 60_000, battery_percent: 95, rssi_dbm: -55, updated_ts_ms: now - 60_000 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  const result = await buildAppleIIEvidenceSufficiencyV1(db, {
    tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", device_id: "dev_001",
    now_ms: now, observation_window_ms: 60 * 60_000, expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 1, min_coverage_ratio: 0, max_gap_ms: 60 * 60_000, freshness_max_age_ms: 60 * 60_000,
  });

  assert.equal(result.time_coverage_v1.sample_count, 1, "late backfill must not enter authoritative Apple-II coverage");
  assert.equal(result.time_coverage_v1.formal_sample_count, 1, "late backfill must not enter formal Stage-1 evidence");
  assert.equal(result.evidence_sufficiency, "PASS", "shadow-only late evidence must not change legacy sufficiency");

  const projection = result.canonical_evidence_qualification_projection_v1;
  assert.equal(projection.qualifications.length, 2);
  const lateQualification = projection.qualifications.find((q) => q.observation_id === "raw_sample:rs_late_backfill");
  assert.equal(lateQualification?.temporal_eligibility, "NOT_AVAILABLE_AT_DECISION");
  assert.equal(lateQualification?.evidence_authority, "INELIGIBLE");
  assert.equal(lateQualification?.role_eligibility[0]?.eligibility, "INELIGIBLE");

  const lateQuery = calls.find((call) => call.sql.includes("FROM raw_samples") && call.sql.includes("created_at >"));
  assert.ok(lateQuery);
  assert.ok(lateQuery.sql.includes("(payload_json ->> 'project_id') = $4"));
  assert.ok(lateQuery.sql.includes("(payload_json ->> 'group_id') = $5"));
  assert.ok(lateQuery.sql.includes("(payload_json ->> 'field_id') = $6"));
  assert.ok(lateQuery.sql.includes("sensor_id = $7"));
  assert.ok(lateQuery.sql.includes("created_at > to_timestamp($8 / 1000.0)"));
  assert.equal(lateQuery.args.at(-1), now);
});

test("B-04d3r1 canonical shadow attributes unresolved conflict only to the conflicting metric", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const rows = [
    { sample_id: "sm_low", sensor_id: "dev_a", ts_ms: now - 30 * 60_000, metric: "soil_moisture", value: 10, qc_quality: "ok", source: "device", created_at: new Date(now - 29 * 60_000).toISOString(), payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") } },
    { sample_id: "sm_high", sensor_id: "dev_b", ts_ms: now - 20 * 60_000, metric: "soil_moisture", value: 40, qc_quality: "ok", source: "device", created_at: new Date(now - 19 * 60_000).toISOString(), payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") } },
    { sample_id: "flow_ok", sensor_id: "dev_c", ts_ms: now - 10 * 60_000, metric: "flow_rate", value: 12, qc_quality: "ok", source: "device", created_at: new Date(now - 9 * 60_000).toISOString(), payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") } },
  ];
  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM raw_samples") && sql.includes("created_at >")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM raw_samples")) return { rows, rowCount: rows.length };
      if (sql.includes("FROM device_status_index_v1")) return { rows: [{ last_telemetry_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 60_000, battery_percent: 95, rssi_dbm: -55, updated_ts_ms: now - 60_000 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  const result = await buildAppleIIEvidenceSufficiencyV1(db, {
    tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA",
    now_ms: now, observation_window_ms: 60 * 60_000, expected_sample_interval_ms: 30 * 60_000,
    min_sample_count: 1, min_coverage_ratio: 0, max_gap_ms: 60 * 60_000, freshness_max_age_ms: 60 * 60_000,
  });

  assert.equal(result.conflict_detection_v1.conflict_status, "UNRESOLVED");
  assert.equal(result.conflict_detection_v1.conflicting_metric_count, 1);
  const byId = new Map(result.canonical_evidence_qualification_projection_v1.qualifications.map((q) => [q.observation_id, q]));
  assert.equal(byId.get("raw_sample:sm_low")?.conflict_state, "UNRESOLVED");
  assert.equal(byId.get("raw_sample:sm_high")?.conflict_state, "UNRESOLVED");
  assert.equal(byId.get("raw_sample:flow_ok")?.conflict_state, "NONE");
  assert.equal(byId.get("raw_sample:flow_ok")?.evidence_authority, "LIMITED", "unrelated metric must not lose authority because another metric conflicts");
});

test("B-04d3r1 shadow late-backfill query failure is visible as a limitation but never changes legacy verdict", async () => {
  const now = Date.parse("2026-08-27T06:00:00Z");
  const visible = { sample_id: "rs_visible_only", sensor_id: "dev_001", ts_ms: now - 15 * 60_000, metric: "soil_moisture", value: 0.22, qc_quality: "ok", source: "device", created_at: new Date(now - 14 * 60_000).toISOString(), payload_json: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", ingress_physical_qc: physical("VALID", "PASS") } };
  const db = {
    query: async (sql: string) => {
      if (sql.includes("FROM raw_samples") && sql.includes("created_at >")) throw new Error("SHADOW_READ_UNAVAILABLE");
      if (sql.includes("FROM raw_samples")) return { rows: [visible], rowCount: 1 };
      if (sql.includes("FROM device_status_index_v1")) return { rows: [{ last_telemetry_ts_ms: now - 60_000, last_heartbeat_ts_ms: now - 60_000, battery_percent: 95, rssi_dbm: -55, updated_ts_ms: now - 60_000 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  const result = await buildAppleIIEvidenceSufficiencyV1(db, {
    tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", device_id: "dev_001",
    now_ms: now, observation_window_ms: 60 * 60_000, min_sample_count: 1, min_coverage_ratio: 0,
    max_gap_ms: 60 * 60_000, freshness_max_age_ms: 60 * 60_000,
  });
  assert.equal(result.evidence_sufficiency, "PASS");
  assert.equal(result.time_coverage_v1.sample_count, 1);
  assert.ok(result.canonical_evidence_qualification_projection_v1.limitations.includes("LATE_BACKFILL_SHADOW_QUERY_UNAVAILABLE"));
});
