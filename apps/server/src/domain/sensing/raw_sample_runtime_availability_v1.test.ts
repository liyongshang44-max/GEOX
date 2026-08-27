import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";

import { appendRawSampleV1 } from "./raw_sample_fact_envelope_v1.js";
import {
  RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1,
  RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1,
  rawSampleRuntimeAvailabilityFactIdV1,
} from "./raw_sample_runtime_availability_v1.js";

function input() {
  return {
    sample_id: "rs_postcommit_001",
    sensor_id: "dev_001",
    field_id: "fieldA",
    ts_ms: Date.parse("2026-08-27T05:00:00Z"),
    metric: "soil_moisture",
    value: 0.22,
    unit: "m3/m3",
    qc_quality: "ok",
    source: "device",
    payload: {},
  };
}

function tenant() {
  return { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };
}

test("B-04d4a appends runtime availability only after raw transaction COMMIT", async () => {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  const client = {
    query: async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      if (sql.includes("INSERT INTO raw_samples")) {
        return { rows: [{ sample_id: "rs_postcommit_001" }], rowCount: 1 };
      }
      if (sql.includes("WITH visible_raw_sample")) {
        return {
          rows: [{ fact_id: rawSampleRuntimeAvailabilityFactIdV1("rs_postcommit_001") }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  const item = await appendRawSampleV1(pool, input(), tenant());
  assert.equal(item.sample_id, "rs_postcommit_001");

  const commitIndex = calls.findIndex((call) => call.sql === "COMMIT");
  const markerIndex = calls.findIndex((call) => call.sql.includes("WITH visible_raw_sample"));
  assert.ok(commitIndex >= 0);
  assert.ok(markerIndex > commitIndex, "availability witness must be observed after raw COMMIT");

  const marker = calls[markerIndex];
  assert.ok(marker.sql.includes("SELECT clock_timestamp() AS available_to_runtime_at"));
  assert.ok(marker.sql.includes("FROM raw_samples"));
  assert.ok(marker.sql.includes("WHERE sample_id = $1"));
  assert.ok(marker.sql.includes("INSERT INTO facts"));
  assert.ok(marker.sql.includes("ON CONFLICT (fact_id) DO NOTHING"));
  assert.equal(marker.args[0], "rs_postcommit_001");
  assert.equal(marker.args[1], rawSampleRuntimeAvailabilityFactIdV1("rs_postcommit_001"));
  assert.equal(marker.args[2], RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1);
  assert.equal(marker.args[3], "raw_sample:rs_postcommit_001");
  assert.equal(marker.args[4], RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1);
  assert.equal(marker.args[5], "tenantA");
  assert.equal(marker.args[6], "projectA");
  assert.equal(marker.args[7], "groupA");
  assert.equal(marker.args[8], "fieldA");
  assert.equal(marker.args[9], "dev_001");
});

test("B-04d4a marker failure cannot convert a committed raw append into an API failure", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("INSERT INTO raw_samples")) {
        return { rows: [{ sample_id: "rs_postcommit_001" }], rowCount: 1 };
      }
      if (sql.includes("WITH visible_raw_sample")) {
        throw new Error("SYNTHETIC_MARKER_WRITE_FAILURE");
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  const item = await appendRawSampleV1(pool, input(), tenant());
  assert.equal(item.sample_id, "rs_postcommit_001");
  assert.equal(calls.filter((sql) => sql === "COMMIT").length, 1);
  assert.equal(calls.filter((sql) => sql === "ROLLBACK").length, 0);
  assert.ok(calls.findIndex((sql) => sql.includes("WITH visible_raw_sample")) > calls.findIndex((sql) => sql === "COMMIT"));
});

test("B-04d4a availability fact identity is deterministic and append-only", () => {
  assert.equal(
    rawSampleRuntimeAvailabilityFactIdV1("rs_postcommit_001"),
    "raw_sample_runtime_availability_v1:rs_postcommit_001",
  );
});
