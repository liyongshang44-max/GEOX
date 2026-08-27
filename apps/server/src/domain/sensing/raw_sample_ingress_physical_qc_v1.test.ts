import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";

import { appendRawSampleV1 } from "./raw_sample_fact_envelope_v1.js";

type Captured = { sql: string; params: unknown[] };

function fakePool(): { pool: Pool; queries: Captured[] } {
  const queries: Captured[] = [];
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO raw_samples")) return { rows: [{ sample_id: "rs_rh_102_7" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  } as unknown as PoolClient;

  return {
    pool: {
      connect: async () => client,
    } as unknown as Pool,
    queries,
  };
}

test("102.7% RH raw sample is retained with INVALID/FAIL shared physical QC", async () => {
  const { pool, queries } = fakePool();

  const item = await appendRawSampleV1(
    pool,
    {
      sample_id: "rs_rh_102_7",
      sensor_id: "dev_rh_001",
      field_id: "fieldA",
      ts_ms: Date.parse("2026-08-27T03:00:00Z"),
      metric: "humidity",
      value: 102.7,
      unit: "%RH",
      qc_quality: "ok",
      source: "device",
      payload: {},
    },
    {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
    },
  );

  const snapshot = item.payload_json.ingress_physical_qc;
  assert.equal(snapshot.source_fact_id, "raw_sample:rs_rh_102_7");
  assert.equal(snapshot.source_metric, "humidity");
  assert.equal(snapshot.source_value, 102.7);
  assert.equal(snapshot.source_unit, "%RH");
  assert.equal(snapshot.physical_qc.measurement_health, "INVALID");
  assert.equal(snapshot.physical_qc.physical_validity, "FAIL");
  assert.deepEqual(snapshot.physical_qc.reason_codes, ["PHYSICAL_QC_ABOVE_HARD_MAX"]);

  const rawInsert = queries.find((entry) => entry.sql.includes("INSERT INTO raw_samples"));
  assert.ok(rawInsert);
  const rawPayload = JSON.parse(String(rawInsert.params[7]));
  assert.equal(rawPayload.ingress_physical_qc.physical_qc.physical_validity, "FAIL");

  const factInsert = queries.find((entry) => entry.sql.includes("INSERT INTO facts"));
  assert.ok(factInsert);
  const fact = JSON.parse(String(factInsert.params[3]));
  assert.equal(fact.payload.value, 102.7);
  assert.equal(fact.payload.ingress_physical_qc.physical_qc.measurement_health, "INVALID");
});
