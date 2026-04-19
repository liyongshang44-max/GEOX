import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDecisionEngineV1Routes } from "./decision_engine_v1.js";
import { IRRIGATION_CONTROL_PLANE_ACTION } from "../domain/controlplane/irrigation_action_mapping_v1.js";

class ControlPlanePool {
  constructor(private mode: "eligible" | "ineligible" | "missing") {}
  async query(sql: string, params?: any[]) {
    const text = String(sql);
    if (text.includes("CREATE TABLE") || text.includes("ALTER TABLE") || text.includes("CREATE INDEX")) return { rows: [], rowCount: 0 };

    if (text.includes("FROM facts") && text.includes("decision_recommendation_v1") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_rec",
          occurred_at: new Date().toISOString(),
          record_json: {
            type: "decision_recommendation_v1",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              recommendation_id: "rec_approval_1",
              field_id: "field_1",
              season_id: "season_1",
              rule_id: "irrigation_rule_irrigation_effectiveness_v1",
              recommendation_type: "irrigation_recommendation_v1",
              suggested_action: { action_type: "irrigation.start", parameters: { duration_min: 20 } },
              data_sources: {
                customer_facing: this.mode === "missing" ? {} : {
                  stage1_formal_trigger_signals_v1: {
                    irrigation_effectiveness: this.mode === "eligible" ? "low" : "high",
                    leak_risk: "low",
                  }
                },
              }
            }
          }
        }],
        rowCount: 1,
      };
    }

    if (text.includes("FROM facts") && text.includes("field_program_v1")) return { rows: [], rowCount: 0 };

    if (text.startsWith("INSERT INTO facts")) return { rows: [], rowCount: 1 };

    if (text.includes("WITH latest_task AS (") && text.includes("ao_act_task_v0")) {
      return { rows: [{ key_kind: "recommendation" }], rowCount: 1 };
    }

    if (text.includes("ao_act_task_v0") && text.includes("LIMIT 1")) {
      return { rows: [{ record_json: { payload: { approval_request_id: "apr_1", status: "approved" } } }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function setup(scopes: string, actorId = "admin_user") {
  process.env.GEOX_TOKEN = "control-plane-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_ACTOR_ID = actorId;
  process.env.GEOX_SCOPES = scopes;
}

test("control-plane boundary: formal-trigger recommendation can submit approval", async () => {
  await setup("ao_act.task.write,ao_act.index.read,ao_act.receipt.write");
  const originalFetch = globalThis.fetch;
  let delegatedActionType: string | null = null;
  globalThis.fetch = async (_url: any, init?: any) => {
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
    delegatedActionType = parsedBody?.action_type ?? null;
    return ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, request_id: "apr_1", fact_id: "fact_apr_1" })
    } as any);
  };

  const app = Fastify();
  registerDecisionEngineV1Routes(app, new ControlPlanePool("eligible") as any);
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/recommendations/rec_approval_1/submit-approval",
    headers: { authorization: "Bearer control-plane-token" },
    payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.equal(delegatedActionType, IRRIGATION_CONTROL_PLANE_ACTION);

  globalThis.fetch = originalFetch;
  await app.close();
});

test("control-plane boundary: recommendation without formal provenance cannot submit approval", async () => {
  await setup("ao_act.task.write,ao_act.index.read,ao_act.receipt.write");
  const app = Fastify();
  registerDecisionEngineV1Routes(app, new ControlPlanePool("missing") as any);
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/recommendations/rec_approval_1/submit-approval",
    headers: { authorization: "Bearer control-plane-token" },
    payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "FORMAL_TRIGGER_PROVENANCE_REQUIRED");
  await app.close();
});

test("control-plane boundary: simulator execute forbids recommendation/approval/operation ids direct execution", async () => {
  await setup("ao_act.receipt.write,ao_act.task.write", "executor_runtime");
  const app = Fastify();
  registerDecisionEngineV1Routes(app, new ControlPlanePool("eligible") as any);
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/simulators/irrigation/execute",
    headers: { authorization: "Bearer control-plane-token" },
    payload: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      recommendation_id: "rec_1",
      task_id: "task_1",
      command_id: "task_1",
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "RECOMMENDATION_ID_NOT_ALLOWED");

  const resApproval = await app.inject({
    method: "POST",
    url: "/api/v1/simulators/irrigation/execute",
    headers: { authorization: "Bearer control-plane-token" },
    payload: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      approval_request_id: "apr_1",
      task_id: "task_1",
      command_id: "task_1",
    },
  });
  assert.equal(resApproval.statusCode, 400);
  assert.equal(resApproval.json().error, "APPROVAL_REQUEST_ID_NOT_ALLOWED");

  const resOperation = await app.inject({
    method: "POST",
    url: "/api/v1/simulators/irrigation/execute",
    headers: { authorization: "Bearer control-plane-token" },
    payload: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      operation_plan_id: "opl_1",
      task_id: "task_1",
      command_id: "task_1",
    },
  });
  assert.equal(resOperation.statusCode, 400);
  assert.equal(resOperation.json().error, "OPERATION_PLAN_ID_NOT_ALLOWED");
  await app.close();
});
