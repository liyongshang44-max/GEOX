import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";

import {
  appendRawSampleV1,
  RAW_SAMPLE_RUNTIME_AVAILABILITY_MARKER_KIND_V1,
  rawSampleRuntimeAvailabilityMarkerIdV1,
} from "./raw_sample_fact_envelope_v1.js";

test("B-04d4 writes runtime availability marker only after raw transaction COMMIT", async () => {
  const order: string[] = [];
  const markerCalls: Array<{ sql: string; args: unknown[] }> = [];
  const client = {
    query: async (sql: string, args: unknown[] = []) => {
      if (sql === "BEGIN") { order.push("BEGIN"); return { rows: [], rowCount: 0 }; }
      if (sql.includes("INSERT INTO raw_samples")) { order.push("RAW_INSERT"); return { rows: [{ sample_id: "rs_avail_001" }], rowCount: 1 }; }
      if (sql.includes("INSERT INTO facts")) { order.push("FACT_INSERT"); return { rows: [], rowCount: 1 }; }
      if (sql === "COMMIT") { order.push("COMMIT"); return { rows: [], rowCount: 0 }; }
      if (sql.includes("INSERT INTO markers")) {
        order.push("AVAILABILITY_MARKER");
        markerCalls.push({ sql, args });
        return {
          rows: [{
            marker_id: rawSampleRuntimeAvailabilityMarkerIdV1("rs_avail_001"),
            occurred_at: new Date("2026-08-27T06:00:01Z"),
          }],
          rowCount: 1,
        };
      }
      if (sql === "ROLLBACK") { order.push("ROLLBACK"); return { rows: [], rowCount: 0 }; }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  } as unknown as PoolClient;

  const pool = {
    connect: async () => client,
  } as unknown as Pool;

  await appendRawSampleV1(
    pool,
    {
      sample_id: "rs_avail_001",
      sensor_id: "dev_001",
      field_id: "fieldA",
      ts_ms: Date.parse("2026-08-27T05:55:00Z"),
      metric: "soil_moisture",
      value: 0.22,
      unit: "m3/m3",
      qc_quality: "ok",
      source: "device",
      payload: {},
    },
    { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
  );

  assert.deepEqual(order, ["BEGIN", "RAW_INSERT", "FACT_INSERT", "COMMIT", "AVAILABILITY_MARKER"]);
  assert.equal(markerCalls.length, 1);
  assert.ok(markerCalls[0].sql.includes("clock_timestamp()"));
  assert.ok(markerCalls[0].sql.includes("ON CONFLICT (marker_id) DO NOTHING"));
  assert.equal(markerCalls[0].args[0], rawSampleRuntimeAvailabilityMarkerIdV1("rs_avail_001"));
  assert.equal(markerCalls[0].args[3], RAW_SAMPLE_RUNTIME_AVAILABILITY_MARKER_KIND_V1);
  const payload = JSON.parse(String(markerCalls[0].args[4]));
  assert.equal(payload.sample_id, "rs_avail_001");
  assert.equal(payload.semantics, "RAW_SAMPLE_PROVEN_COMMITTED_BEFORE_MARKER_TIME");
});

test("B-04d4 marker failure does not roll back committed raw sample", async () => {
  const order: string[] = [];
  const client = {
    query: async (sql: string) => {
      if (sql === "BEGIN") { order.push("BEGIN"); return { rows: [], rowCount: 0 }; }
      if (sql.includes("INSERT INTO raw_samples")) { order.push("RAW_INSERT"); return { rows: [{ sample_id: "rs_avail_fail" }], rowCount: 1 }; }
      if (sql.includes("INSERT INTO facts")) { order.push("FACT_INSERT"); return { rows: [], rowCount: 1 }; }
      if (sql === "COMMIT") { order.push("COMMIT"); return { rows: [], rowCount: 0 }; }
      if (sql.includes("INSERT INTO markers")) {
        order.push("AVAILABILITY_MARKER_FAILED");
        throw new Error("marker store unavailable");
      }
      if (sql === "ROLLBACK") { order.push("ROLLBACK"); return { rows: [], rowCount: 0 }; }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool = {
    connect: async () => client,
  } as unknown as Pool;

  const item = await appendRawSampleV1(
    pool,
    {
      sample_id: "rs_avail_fail",
      sensor_id: "dev_001",
      field_id: "fieldA",
      ts_ms: Date.parse("2026-08-27T05:55:00Z"),
      metric: "soil_moisture",
      value: 0.22,
      unit: "m3/m3",
      qc_quality: "ok",
      source: "device",
      payload: {},
    },
    { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
  );

  assert.equal(item.sample_id, "rs_avail_fail");
  assert.deepEqual(order, ["BEGIN", "RAW_INSERT", "FACT_INSERT", "COMMIT", "AVAILABILITY_MARKER_FAILED"]);
  assert.ok(!order.includes("ROLLBACK"), "post-COMMIT marker failure must not roll back durable raw evidence");
});
