import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAcceptanceV1Routes } from "./acceptance_v1.js";

type VerdictScenario = "PASS" | "FAIL" | "PARTIAL";

class AcceptanceVerdictSemanticsPool {
  public insertedRecords: any[] = [];

  constructor(private readonly scenario: VerdictScenario) {}

  async query(sql: string, params?: any[]) {
    const text = String(sql);

    if (text.includes("ao_act_task_v0") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_task_case",
          occurred_at: new Date().toISOString(),
          record_json: {
            type: "ao_act_task_v0",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              act_task_id: "task_case",
              action_type: "IRRIGATE",
              field_id: "field_case",
              operation_plan_id: "opl_case",
              final_status: "SUCCESS",
              parameters: { duration_min: 20 },
              time_window: { start_ts: 1_700_000_000_000, end_ts: 1_700_000_060_000 },
              meta: { device_id: "dev_case" },
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("ao_act_receipt_v0") && text.includes("LIMIT 1")) {
      const observedParameters = this.scenario === "PARTIAL" ? {} : { duration_min: 20 };
      return {
        rows: [{
          fact_id: "fact_receipt_case",
          record_json: {
            type: "ao_act_receipt_v0",
            payload: {
              act_task_id: "task_case",
              observed_parameters: observedParameters,
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

    if (text.includes("derived_sensing_state_index_v1")) {
      if (this.scenario !== "FAIL") return { rows: [], rowCount: 0 };
      return {
        rows: [{
          state_type: "water_flow_state",
          payload_json: { irrigation_effectiveness: "low", leak_risk: "medium" },
        }],
        rowCount: 1,
      };
    }

    if (text.startsWith("INSERT INTO facts")) {
      const record = params?.[2] ?? null;
      this.insertedRecords.push(record);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function setupApp(pool: AcceptanceVerdictSemanticsPool) {
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

async function runEvaluate(scenario: VerdictScenario) {
  const pool = new AcceptanceVerdictSemanticsPool(scenario);
  const app = await setupApp(pool);
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/acceptance/evaluate",
    headers: { authorization: "Bearer acceptance-token" },
    payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", act_task_id: "task_case" },
  });
  await app.close();
  return { res, pool };
}

test("acceptance verdict semantics: route outputs PASS/FAIL/PARTIAL and writes stable enum to acceptance_result_v1", async () => {
  const passRun = await runEvaluate("PASS");
  const failRun = await runEvaluate("FAIL");
  const partialRun = await runEvaluate("PARTIAL");

  assert.equal(passRun.res.statusCode, 200);
  assert.equal(failRun.res.statusCode, 200);
  assert.equal(partialRun.res.statusCode, 200);

  assert.equal(passRun.res.json().verdict, "PASS");
  assert.equal(failRun.res.json().verdict, "FAIL");
  assert.equal(partialRun.res.json().verdict, "PARTIAL");

  const insertedVerdicts = [
    passRun.pool.insertedRecords.find((x) => x?.type === "acceptance_result_v1")?.payload?.verdict,
    failRun.pool.insertedRecords.find((x) => x?.type === "acceptance_result_v1")?.payload?.verdict,
    partialRun.pool.insertedRecords.find((x) => x?.type === "acceptance_result_v1")?.payload?.verdict,
  ];
  assert.deepEqual(insertedVerdicts, ["PASS", "FAIL", "PARTIAL"]);
});

test("acceptance verdict semantics: verdict is acceptance-layer value and not operation final_status", async () => {
  const failRun = await runEvaluate("FAIL");
  const payload = failRun.res.json();
  const acceptanceRecord = failRun.pool.insertedRecords.find((x) => x?.type === "acceptance_result_v1");

  assert.equal(payload.verdict, "FAIL");
  assert.equal(payload.final_status, undefined);
  assert.equal(acceptanceRecord?.payload?.verdict, "FAIL");
  assert.equal(acceptanceRecord?.payload?.final_status, undefined);
  assert.notEqual(acceptanceRecord?.payload?.verdict, "SUCCESS");
});
