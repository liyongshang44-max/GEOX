import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerPrescriptionsV1Routes } from "./prescriptions_v1.js";
import { registerApprovalRequestV1Routes } from "./control_approval_request_v1.js";

class PoolStub {
  public facts: any[] = [];

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const text = String(sql);

    if (text.includes("SELECT * FROM prescription_contract_v1") && text.includes("FOR UPDATE")) {
      return {
        rows: [{
          prescription_id: "pre_1",
          recommendation_id: "rec_1",
          tenant_id: "tenantA",
          project_id: "projectA",
          group_id: "groupA",
          field_id: "field_1",
          season_id: "season_1",
          operation_type: "IRRIGATION",
          operation_amount: { amount: 25, unit: "mm", parameters: { formal_scenario_run_id: "fsr_1" } },
          approval_requirement: { required: true },
          acceptance_conditions: {},
          device_requirements: { device_id: "dev_1" },
          status: "READY_FOR_APPROVAL",
        }],
        rowCount: 1,
      };
    }

    if (text.includes("FROM facts") && text.includes("decision_recommendation_v1")) {
      return {
        rows: [{
          fact_id: "fact_rec_1",
          record_json: {
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              recommendation_id: "rec_1",
              field_id: "field_1",
              season_id: "season_1",
              device_id: "dev_1",
              meta: { formal_scenario_run_id: "fsr_1" },
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.startsWith("INSERT INTO facts")) {
      this.facts.push(params[2]);
      return { rows: [], rowCount: 1 };
    }

    if (text.startsWith("UPDATE prescription_contract_v1 SET status")) {
      return { rows: [], rowCount: 1 };
    }

    if (text.includes("WHERE (record_json::jsonb->>'type') = 'approval_request_v1'")) {
      const requestId = String(params[0] ?? "");
      const latest = [...this.facts]
        .reverse()
        .find((r) => r?.type === "approval_request_v1" && String(r?.payload?.request_id ?? "") === requestId);
      return { rows: latest ? [{ record_json: latest }] : [], rowCount: latest ? 1 : 0 };
    }

    if (text.includes("WHERE prescription_id = $1") && text.includes("LIMIT 1") && !text.includes("FOR UPDATE")) {
      return {
        rows: [{
          prescription_id: "pre_1",
          recommendation_id: "rec_1",
          tenant_id: "tenantA",
          project_id: "projectA",
          group_id: "groupA",
          field_id: "field_1",
          season_id: "season_1",
          crop_id: "corn",
          zone_id: null,
          operation_type: "IRRIGATION",
          spatial_scope: {},
          timing_window: {},
          operation_amount: { amount: 25, unit: "mm" },
          device_requirements: { device_id: "dev_1" },
          risk: { level: "MEDIUM", reasons: [] },
          evidence_refs: [],
          skill_trace_id: null,
          skill_trace: null,
          approval_requirement: { required: true },
          acceptance_conditions: {},
          status: "APPROVAL_REQUESTED",
          created_at: new Date(),
          updated_at: new Date(),
          created_by: "actor_admin",
        }],
        rowCount: 1,
      };
    }

    return { rows: [], rowCount: 0 };
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release: () => undefined,
    };
  }
}

test("prescription submit approval preserves allow_auto_task_issue meta and approval approve creates act_task_id", async () => {
  process.env.GEOX_TOKEN = "admin_token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "prescription.submit_approval,approval.request,approval.approve,ao_act.task.write,ao_act.index.read";
  process.env.GEOX_ADMIN_TOKEN_IDS = "admin_token_id";
  process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN = "internal_task_token";

  const pool = new PoolStub();
  const app = Fastify();
  registerPrescriptionsV1Routes(app, pool as any);
  registerApprovalRequestV1Routes(app, pool as any);

  const originalFetch = global.fetch;
  global.fetch = (async (input: any, init?: any) => {
    if (String(input).includes("/api/v1/actions/task")) {
      return new Response(JSON.stringify({ ok: true, act_task_id: "act_1", fact_id: "fact_act_1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as any;

  try {
    await app.ready();

    const submitRes = await app.inject({
      method: "POST",
      url: "/api/v1/prescriptions/pre_1/submit-approval",
      headers: { authorization: "Bearer admin_token" },
      payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", allow_auto_task_issue: true },
    });
    assert.equal(submitRes.statusCode, 200);
    const submitJson: any = submitRes.json();
    assert.equal(submitJson.ok, true);
    const requestId = String(submitJson.approval_request_id ?? "");
    assert.ok(requestId);

    const reqFact = pool.facts.find((x) => x?.type === "approval_request_v1" && String(x?.payload?.request_id ?? "") === requestId);
    assert.equal(reqFact?.payload?.proposal?.meta?.allow_auto_task_issue, true);
    assert.equal(reqFact?.payload?.proposal?.meta?.prescription_id, "pre_1");

    const approveRes = await app.inject({
      method: "POST",
      url: "/api/v1/approvals/approve",
      headers: { authorization: "Bearer admin_token" },
      payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", request_id: requestId },
    });

    assert.equal(approveRes.statusCode, 200);
    const approveJson: any = approveRes.json();
    assert.equal(approveJson.ok, true);
    assert.equal(String(approveJson.act_task_id ?? ""), "act_1");
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});
