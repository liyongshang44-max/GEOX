import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAcceptanceV1Routes, toVerdict } from "./acceptance_v1.js";

class AcceptancePool {
  public insertedTypes: string[] = [];

  async query(sql: string, params?: any[]) {
    const text = String(sql);

    if (text.includes("ao_act_task_v0") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_task_1",
          occurred_at: new Date().toISOString(),
          record_json: {
            type: "ao_act_task_v0",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              act_task_id: "task_1",
              action_type: "IRRIGATE",
              operation_plan_id: "opl_1",
              parameters: { duration_min: 20 },
              time_window: { start_ts: 1_700_000_000_000, end_ts: 1_700_000_060_000 },
              meta: { device_id: "dev_1" },
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("ao_act_receipt_v0") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_receipt_1",
          record_json: {
            type: "ao_act_receipt_v0",
            payload: {
              act_task_id: "task_1",
              observed_parameters: { duration_min: 20 },
              execution_time: { start_ts: 1_700_000_000_000, end_ts: 1_700_000_060_000 },
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("FROM field_polygon_v1")) return { rows: [], rowCount: 0 };
    if (text.includes("device_binding_index_v1")) return { rows: [], rowCount: 0 };
    if (text.includes("raw_telemetry_v1") || text.includes("device_heartbeat_v1")) return { rows: [], rowCount: 0 };
    if (text.includes("field_program_v1")) return { rows: [], rowCount: 0 };
    if (text.includes("derived_sensing_state_index_v1")) return { rows: [], rowCount: 0 };

    if (text.startsWith("INSERT INTO facts")) {
      const record = params?.[2] ?? null;
      const type = String(record?.type ?? "");
      if (type) this.insertedTypes.push(type);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function setupApp(pool: AcceptancePool) {
  process.env.GEOX_TOKEN = "acceptance-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.index.read";

  const app = Fastify();
  registerAcceptanceV1Routes(app, pool as any);
  await app.ready();
  return app;
}

test("acceptance evaluate writes acceptance_result_v1", async () => {
  const pool = new AcceptancePool();
  const app = await setupApp(pool);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/acceptance/evaluate",
    headers: { authorization: "Bearer acceptance-token" },
    payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", act_task_id: "task_1" },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.ok(pool.insertedTypes.includes("acceptance_result_v1"));
  await app.close();
});

test("acceptance verdict mapping remains PASS/FAIL/PARTIAL", () => {
  assert.equal(toVerdict("PASSED"), "PASS");
  assert.equal(toVerdict("FAILED"), "FAIL");
  assert.equal(toVerdict("INCONCLUSIVE"), "PARTIAL");
});
