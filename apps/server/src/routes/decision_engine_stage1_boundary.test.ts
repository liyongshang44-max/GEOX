import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDecisionEngineV1Routes } from "./decision_engine_v1.js";
import { assertNoForbiddenTriggerFields } from "../domain/decision/stage1_action_boundary_v1.js";

type Scenario =
  | "formal_irrigation_low"
  | "formal_leak_high"
  | "support_canopy_only"
  | "support_et_only"
  | "support_sensor_only"
  | "overview_only"
  | "summary_missing";

class Stage1BoundaryPool {
  constructor(private scenario: Scenario) {}
  async query(sql: string) {
    const text = String(sql);
    if (text.includes("CREATE TABLE") || text.includes("ALTER TABLE") || text.includes("CREATE INDEX")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM agronomy_rule_performance")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM facts") && text.includes("field_program_v1")) return { rows: [], rowCount: 0 };
    if (text.startsWith("INSERT INTO facts")) return { rows: [], rowCount: 1 };

    if (text.includes("FROM device_observation_index_v1")) {
      if (this.scenario === "summary_missing") throw new Error("stage1_summary_refresh_failed");
      if (this.scenario === "overview_only") {
        return {
          rows: [
            { metric: "soil_moisture_pct", observed_at_ts_ms: Date.now(), value_num: 12, confidence: 0.8, device_id: "d1" },
            { metric: "canopy_temp_c", observed_at_ts_ms: Date.now(), value_num: 37, confidence: 0.8, device_id: "d1" },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    if (text.includes("FROM derived_sensing_state_index_v1")) {
      if (this.scenario === "summary_missing") throw new Error("stage1_summary_refresh_failed");
      if (this.scenario === "formal_irrigation_low") {
        return { rows: [{ state_type: "irrigation_effectiveness_state", payload_json: { level: "LOW" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs1"] }], rowCount: 1 };
      }
      if (this.scenario === "formal_leak_high") {
        return { rows: [{ state_type: "leak_risk_state", payload_json: { level: "HIGH" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs1"] }], rowCount: 1 };
      }
      if (this.scenario === "support_canopy_only") {
        return { rows: [{ state_type: "canopy_temperature_state", payload_json: { status: "critical" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs1"] }], rowCount: 1 };
      }
      if (this.scenario === "support_et_only") {
        return { rows: [{ state_type: "evapotranspiration_risk_state", payload_json: { risk: "high" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs1"] }], rowCount: 1 };
      }
      if (this.scenario === "support_sensor_only") {
        return { rows: [{ state_type: "sensor_quality_state", payload_json: { level: "GOOD" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs1"] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function setupApp(scenario: Scenario) {
  process.env.GEOX_TOKEN = "stage1-boundary-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.index.read,ao_act.task.write,ao_act.receipt.write";

  const app = Fastify();
  registerDecisionEngineV1Routes(app, new Stage1BoundaryPool(scenario) as any);
  await app.ready();
  return app;
}

async function callGenerate(app: any) {
  return app.inject({
    method: "POST",
    url: "/api/v1/recommendations/generate",
    headers: { authorization: "Bearer stage1-boundary-token" },
    payload: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field_1",
      season_id: "season_1",
      device_id: "device_1",
      crop_code: "corn",
    },
  });
}

test("generate: irrigation_effectiveness=low can trigger formal recommendation", async () => {
  const app = await setupApp("formal_irrigation_low");
  const res = await callGenerate(app);
  assert.equal(res.statusCode, 200);
  await app.close();
});

test("generate: leak_risk=high can trigger formal recommendation", async () => {
  const app = await setupApp("formal_leak_high");
  const res = await callGenerate(app);
  assert.equal(res.statusCode, 200);
  await app.close();
});

test("generate: support-only fields cannot form formal trigger", async () => {
  for (const scenario of ["support_canopy_only", "support_et_only", "support_sensor_only"] as const) {
    const app = await setupApp(scenario);
    const res = await callGenerate(app);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
    await app.close();
  }
});

test("generate: forbidden trigger fields are rejected by stage1 boundary helper", () => {
  for (const field of [
    "fertility_state",
    "salinity_risk_state",
    "canopy_state",
    "water_flow_state",
    "irrigation_need_state",
    "irrigation_need_level",
    "sensor_quality",
  ]) {
    assert.throws(() => assertNoForbiddenTriggerFields({ [field]: "x" }), /STAGE1_FORBIDDEN_TRIGGER_FIELD/);
  }
});

test("generate: sensing_overview alone cannot trigger recommendation", async () => {
  const app = await setupApp("overview_only");
  const res = await callGenerate(app);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
  await app.close();
});

test("generate: missing formal input layer fails with FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE", async () => {
  const app = await setupApp("summary_missing");
  const res = await callGenerate(app);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
  await app.close();
});
