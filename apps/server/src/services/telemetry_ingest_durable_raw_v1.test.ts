import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { ingestTelemetryV1 } from "./telemetry_ingest_service_v1.js";

type CapturedQuery = { sql: string; params: unknown[] };

function fakeDb(options?: { failSecondFactInsert?: boolean }): { db: PoolClient; queries: CapturedQuery[] } {
  const queries: CapturedQuery[] = [];
  let factInsertCount = 0;

  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO facts")) {
        factInsertCount += 1;
        if (options?.failSecondFactInsert && factInsertCount === 2) {
          throw new Error("SYNTHETIC_OBSERVATION_DB_FAILURE");
        }
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;

  return { db, queries };
}

function hasSql(queries: CapturedQuery[], exact: string): boolean {
  return queries.some((entry) => entry.sql === exact);
}

function rawFactRecord(queries: CapturedQuery[]): any {
  const inserts = queries.filter((entry) => entry.sql.includes("INSERT INTO facts"));
  assert.ok(inserts.length >= 1, "expected raw fact insert");
  assert.equal(typeof inserts[0].params[3], "string");
  return JSON.parse(String(inserts[0].params[3]));
}

test("null telemetry commits raw evidence but preserves the existing projection failure", async () => {
  const { db, queries } = fakeDb();

  await assert.rejects(
    ingestTelemetryV1(
      db,
      {
        tenant_id: "tenantA",
        device_id: "dev_missing_001",
        metric: "soil_moisture",
        value: null,
        unit: "%VWC",
        ts_ms: Date.parse("2026-08-27T01:00:00Z"),
      },
      {
        source: "b04b2_test",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        source_lane: "FORMAL_OPERATION",
        formal_eligible: true,
        evidence_level: "FORMAL",
      }
    ),
    /DEVICE_OBSERVATION_VALUE_NOT_NUMERIC/
  );

  const raw = rawFactRecord(queries);
  assert.equal(raw.type, "raw_telemetry_v1");
  assert.equal(raw.payload.metric, "soil_moisture");
  assert.equal(raw.payload.value, null);
  assert.equal(raw.payload.unit, "%VWC");

  const telemetryIndex = queries.find((entry) => entry.sql.includes("INSERT INTO telemetry_index_v1"));
  assert.ok(telemetryIndex, "expected telemetry index insert");
  assert.equal(telemetryIndex.params[4], null);
  assert.equal(telemetryIndex.params[5], null);

  assert.equal(hasSql(queries, "COMMIT"), true);
  assert.equal(hasSql(queries, "ROLLBACK"), false);
  assert.equal(queries.filter((entry) => entry.sql.includes("INSERT INTO device_observation_index_v1")).length, 0);
});

test("non-numeric source text is retained exactly and does not fabricate an observation", async () => {
  const { db, queries } = fakeDb();

  await assert.rejects(
    ingestTelemetryV1(
      db,
      {
        tenant_id: "tenantA",
        device_id: "dev_text_001",
        metric: "air_humidity",
        value: "sensor_error",
        unit: "%RH",
        ts_ms: Date.parse("2026-08-27T01:01:00Z"),
      },
      {
        source: "b04b2_test",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
      }
    ),
    /DEVICE_OBSERVATION_VALUE_NOT_NUMERIC/
  );

  const raw = rawFactRecord(queries);
  assert.equal(raw.payload.value, "sensor_error");
  assert.equal(raw.payload.unit, "%RH");

  const telemetryIndex = queries.find((entry) => entry.sql.includes("INSERT INTO telemetry_index_v1"));
  assert.ok(telemetryIndex);
  assert.equal(telemetryIndex.params[4], null);
  assert.equal(telemetryIndex.params[5], "sensor_error");

  assert.equal(hasSql(queries, "COMMIT"), true);
  assert.equal(hasSql(queries, "ROLLBACK"), false);
  assert.equal(queries.filter((entry) => entry.sql.includes("INSERT INTO device_observation_index_v1")).length, 0);
});

test("B-04b2 exception is narrow: unrelated downstream failures still rollback", async () => {
  const { db, queries } = fakeDb({ failSecondFactInsert: true });

  await assert.rejects(
    ingestTelemetryV1(
      db,
      {
        tenant_id: "tenantA",
        device_id: "dev_numeric_001",
        metric: "air_humidity",
        value: 55,
        unit: "%RH",
        ts_ms: Date.parse("2026-08-27T01:02:00Z"),
      },
      {
        source: "b04b2_test",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
      }
    ),
    /SYNTHETIC_OBSERVATION_DB_FAILURE/
  );

  assert.equal(hasSql(queries, "COMMIT"), false);
  assert.equal(hasSql(queries, "ROLLBACK"), true);
});
