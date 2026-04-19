import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDecisionEngineV1Routes } from "./decision_engine_v1.js";

type Scenario = "formal_low" | "diagnostic_only" | "internal_only";

class BoundaryPool {
  constructor(private scenario: Scenario) {}
  async query(sql: string, params?: any[]) {
    const text = String(sql);
    if (text.includes("CREATE TABLE") || text.includes("ALTER TABLE") || text.includes("CREATE INDEX")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM device_observation_index_v1")) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("FROM derived_sensing_state_index_v1")) {
      if (this.scenario === "formal_low") {
        return {
          rows: [
            { state_type: "irrigation_effectiveness_state", payload_json: { level: "LOW" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs_1"] },
            { state_type: "leak_risk_state", payload_json: { level: "LOW" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs_1"] },
          ],
          rowCount: 2,
        };
      }
      if (this.scenario === "diagnostic_only") {
        return {
          rows: [
            { state_type: "canopy_temperature_state", payload_json: { status: "critical" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs_1"] },
            { state_type: "evapotranspiration_risk_state", payload_json: { risk: "high" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs_1"] },
            { state_type: "sensor_quality_state", payload_json: { level: "POOR" }, computed_at_ts_ms: Date.now(), confidence: 0.9, source_observation_ids_json: ["obs_1"] },
          ],
          rowCount: 3,
        };
      }
      return {
        rows: [
          { state_type: "irrigation_need_state", payload_json: { level: "HIGH" }, computed_at_ts_ms: Date.now(), confidence: 0.8, source_observation_ids_json: ["obs_2"] },
          { state_type: "sensor_quality_state", payload_json: { level: "POOR" }, computed_at_ts_ms: Date.now(), confidence: 0.8, source_observation_ids_json: ["obs_2"] },
        ],
        rowCount: 2,
      };
    }
    if (text.startsWith("INSERT INTO facts")) {
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("FROM agronomy_rule_performance")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM facts") && text.includes("field_program_v1")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  }
}

async function setupApp(pool: any) {
  process.env.GEOX_TOKEN = "stage1-boundary-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.index.read,ao_act.task.write,ao_act.receipt.write";
  const app = Fastify();
  registerDecisionEngineV1Routes(app, pool);
  await app.ready();
  return app;
}

async function generate(app: any) {
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

test("stage1 boundary: formal trigger can produce recommendation without overview soil metrics", async () => {
  const app = await setupApp(new BoundaryPool("formal_low") as any);
  const res = await generate(app);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.recommendations));
  assert.ok(body.recommendations.length > 0);
  await app.close();
});

test("stage1 boundary: diagnostic-only fields cannot form formal trigger", async () => {
  const app = await setupApp(new BoundaryPool("diagnostic_only") as any);
  const res = await generate(app);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
  await app.close();
});

test("stage1 boundary: internal/compatibility fields cannot form formal trigger", async () => {
  const app = await setupApp(new BoundaryPool("internal_only") as any);
  const res = await generate(app);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
  await app.close();
});
