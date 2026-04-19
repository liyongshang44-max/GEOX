import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDecisionEngineV1Routes } from "./decision_engine_v1.js";

class CustomerBoundaryPool {
  async query(sql: string, params?: any[]) {
    const text = String(sql);
    if (text.includes("CREATE TABLE") || text.includes("ALTER TABLE") || text.includes("CREATE INDEX")) return { rows: [], rowCount: 0 };

    if (text.includes("FROM facts") && text.includes("decision_recommendation_v1") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_rec_1",
          occurred_at: new Date().toISOString(),
          record_json: {
            type: "decision_recommendation_v1",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              recommendation_id: "rec_1",
              field_id: "field_1",
              season_id: "season_1",
              recommendation_type: "irrigation_recommendation_v1",
              status: "proposed",
              rule_hit: [{ rule_id: "r1", matched: true }],
              evidence_refs: ["e1"],
              confidence: 0.9,
              suggested_action: { action_type: "irrigation.start", summary: "建议灌溉", parameters: {} },
              explain: {
                source_states: [{ state_ref: "field_sensing_overview_v1.soil_indicators_json.soil_moisture" }],
                trigger_source_fields: [{ field: "irrigation_effectiveness", role: "formal_trigger", value: "low" }],
                action_summary: "建议灌溉",
                rule_hit_summary: [{ rule_id: "r1", matched: true, summary: "hit" }],
              },
              data_sources: {
                customer_facing: { stage1_sensing_summary_v1: { irrigation_effectiveness: "low", leak_risk: "low" } },
                internal_only: {
                  field_sensing_overview_v1: { sensor_quality: "bad", irrigation_need_level: "HIGH" },
                  field_fertility_state_v1: { fertility_level: "low" },
                }
              }
            }
          }
        }],
        rowCount: 1,
      };
    }

    if (text.includes("latest_link") && text.includes("latest_plan")) {
      return { rows: [{ approval_request_id: null, operation_plan_id: null, act_task_id: null, receipt_fact_id: null, latest_status: "PROPOSED" }], rowCount: 1 };
    }

    if (text.includes("FROM derived_sensing_state_index_v1")) return { rows: [], rowCount: 0 };

    return { rows: [], rowCount: 0 };
  }
}

test("customer boundary: recommendation detail explain must not leak internal source paths", async () => {
  process.env.GEOX_TOKEN = "customer-boundary-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.index.read";

  const app = Fastify();
  registerDecisionEngineV1Routes(app, new CustomerBoundaryPool() as any);
  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/agronomy/recommendations/rec_1/control-plane?tenant_id=tenantA&project_id=projectA&group_id=groupA",
    headers: { authorization: "Bearer customer-boundary-token" },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  const explain = body?.item?.explain;
  assert.ok(explain);
  assert.deepEqual(Object.keys(explain).sort(), ["action_summary", "rule_hit_summary", "trigger_source_fields"]);

  const serialized = JSON.stringify(explain);
  assert.equal(serialized.includes("field_sensing_overview_v1"), false);
  assert.equal(serialized.includes("field_fertility_state_v1"), false);
  assert.equal(serialized.includes("sensor_quality"), false);
  assert.equal(serialized.includes("irrigation_need_level"), false);

  assert.ok(body?.item?.pipeline);
  await app.close();
});
