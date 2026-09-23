import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import { runMqttObservationProjectionV1 } from "./mqtt_durable_raw_v1.js";

function fakeConn(): { conn: Pick<PoolClient, "query">; sql: string[] } {
  const sql: string[] = [];
  const conn = {
    query: async (statement: string) => {
      sql.push(statement);
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pick<PoolClient, "query">;
  return { conn, sql };
}

test("non-numeric observation rejection commits the already-written raw MQTT evidence", async () => {
  const { conn, sql } = fakeConn();

  const result = await runMqttObservationProjectionV1(conn, async () => {
    throw new Error("DEVICE_OBSERVATION_VALUE_NOT_NUMERIC");
  });

  assert.deepEqual(result, {
    kind: "RAW_COMMITTED_PROJECTION_REJECTED",
    error: "DEVICE_OBSERVATION_VALUE_NOT_NUMERIC",
  });
  assert.deepEqual(sql, ["COMMIT"]);
});

test("successful observation projection does not commit independently", async () => {
  const { conn, sql } = fakeConn();

  const result = await runMqttObservationProjectionV1(conn, async () => undefined);

  assert.deepEqual(result, { kind: "OBSERVATION_ACCEPTED" });
  assert.deepEqual(sql, []);
});

test("unrelated downstream failure is rethrown and never partially committed", async () => {
  const { conn, sql } = fakeConn();

  await assert.rejects(
    runMqttObservationProjectionV1(conn, async () => {
      throw new Error("SYNTHETIC_DB_FAILURE");
    }),
    /SYNTHETIC_DB_FAILURE/,
  );

  assert.deepEqual(sql, []);
});
