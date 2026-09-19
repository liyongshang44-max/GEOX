import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { writeDeviceObservationFactV1 } from "./device_observation_service_v1.js";

type CapturedQuery = { sql: string; params: unknown[] };

function fakeDb(): { db: PoolClient; queries: CapturedQuery[] } {
  const queries: CapturedQuery[] = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { db, queries };
}

function parseObservationRecord(queries: CapturedQuery[]): any {
  const factInsert = queries.find((entry) => entry.sql.includes("INSERT INTO facts"));
  assert.ok(factInsert, "expected append-only observation fact insert");
  assert.equal(typeof factInsert.params[3], "string");
  return JSON.parse(String(factInsert.params[3]));
}

test("102.7 RH remains persisted while ingress physical QC marks it invalid", async () => {
  const { db, queries } = fakeDb();

  await writeDeviceObservationFactV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    device_id: "dev_rh_001",
    field_id: "fieldA",
    metric: "humidity",
    value: 102.7,
    unit: "%RH",
    quality_flags: ["OK"],
    confidence: 1,
    observed_at_ts_ms: Date.parse("2026-08-27T00:00:00Z"),
    source_fact_id: "raw_rh_102_7",
    source_lane: "FORMAL_OPERATION",
    formal_eligible: true,
    evidence_level: "FORMAL",
  });

  const record = parseObservationRecord(queries);
  assert.equal(record.payload.metric, "air_humidity");
  assert.equal(record.payload.value, 102.7);
  assert.equal(record.payload.unit, "%RH");
  assert.equal(record.payload.source_fact_id, "raw_rh_102_7");
  assert.equal(record.payload.ingress_physical_qc.source_metric, "humidity");
  assert.equal(record.payload.ingress_physical_qc.source_value, 102.7);
  assert.equal(record.payload.ingress_physical_qc.source_unit, "%RH");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.measurement_health, "INVALID");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.physical_validity, "FAIL");
  assert.deepEqual(record.payload.ingress_physical_qc.physical_qc.reason_codes, ["PHYSICAL_QC_ABOVE_HARD_MAX"]);

  const indexInsert = queries.find((entry) => entry.sql.includes("INSERT INTO device_observation_index_v1"));
  assert.ok(indexInsert, "legacy observation index remains populated in B-04b annotation subphase");
});

test("compatibility unit normalization cannot erase the unqualified source unit", async () => {
  const { db, queries } = fakeDb();

  await writeDeviceObservationFactV1(db, {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    device_id: "dev_temp_001",
    field_id: "fieldA",
    metric: "air_temperature",
    value: 72,
    unit: "°F",
    quality_flags: ["OK"],
    confidence: 1,
    observed_at_ts_ms: Date.parse("2026-08-27T00:01:00Z"),
    source_fact_id: "raw_temp_f_72",
    source_lane: "FORMAL_OPERATION",
    formal_eligible: true,
    evidence_level: "FORMAL",
  });

  const record = parseObservationRecord(queries);

  // Historical compatibility projection remains untouched in this subphase.
  assert.equal(record.payload.metric, "air_temperature");
  assert.equal(record.payload.value, 72);
  assert.equal(record.payload.unit, "°C");

  // The new authority-facing snapshot preserves what the source actually supplied.
  assert.equal(record.payload.ingress_physical_qc.source_value, 72);
  assert.equal(record.payload.ingress_physical_qc.source_unit, "°F");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.input_unit, "°F");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.canonical_unit, "°C");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.measurement_health, "UNKNOWN");
  assert.equal(record.payload.ingress_physical_qc.physical_qc.physical_validity, "UNKNOWN");
  assert.deepEqual(record.payload.ingress_physical_qc.physical_qc.reason_codes, ["PHYSICAL_QC_UNIT_UNQUALIFIED"]);
});
