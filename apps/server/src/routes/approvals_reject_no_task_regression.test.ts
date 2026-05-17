import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerApprovalRequestV1Routes } from "./control_approval_request_v1.js";

class PoolStub {
  public facts: any[] = [];

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const text = String(sql);

    if (text.startsWith("INSERT INTO facts")) {
      this.facts.push(params[2]);
      return { rows: [], rowCount: 1 };
    }

    if (text.includes("WHERE (record_json::jsonb->>'type') = 'approval_request_v1'")) {
      const requestId = String(params[0] ?? "");
      const latest = [...this.facts].reverse().find((r) => r?.type === "approval_request_v1" && String(r?.payload?.request_id ?? "") === requestId);
      return { rows: latest ? [{ fact_id: 'fact_req_latest', record_json: latest }] : [], rowCount: latest ? 1 : 0 };
    }

    if (text.includes("FROM facts") && text.includes("approval_decision_v1")) {
      const requestId = String(params[0] ?? "");
      const latest = [...this.facts].reverse().find((r) => r?.type === "approval_decision_v1" && String(r?.payload?.request_id ?? "") === requestId);
      return { rows: latest ? [{ record_json: latest }] : [], rowCount: latest ? 1 : 0 };
    }

    if (text.includes("FROM facts") && text.includes("ao_act_task_v1")) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }
}

test("approval reject contract writes REJECTED and issues no task", async () => {
  process.env.GEOX_TOKEN = "admin_token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "approval.request,approval.decide,approval.read,ao_act.task.write,ao_act.index.read";
  process.env.GEOX_ADMIN_TOKEN_IDS = "admin_token_id";

  const pool = new PoolStub();
  const app = Fastify();
  registerApprovalRequestV1Routes(app, pool as any);
  await app.ready();

  pool.facts.push({
    type: "approval_request_v1",
    payload: {
      tenant_id: "tenantA", project_id: "projectA", group_id: "groupA",
      request_id: "req_1",
      status: "PENDING",
      proposal: { action_type: "IRRIGATE", target: { kind: "field", ref: "field_1" }, parameters: {}, meta: {} },
      requested_by_actor_id: "requester_actor",
      requested_by_token_id: "requester_token",
    }
  });

  const approveRes = await app.inject({
    method: "POST",
    url: "/api/v1/approvals/approve",
    headers: { authorization: "Bearer admin_token" },
    payload: { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", request_id: "req_1", decision: "REJECT", approved: false, reason: "formal_irrigation_negative_reject_no_task" }
  });
  assert.equal(approveRes.statusCode, 200);
  const approveJson: any = approveRes.json();
  assert.equal(approveJson.ok, true);
  assert.equal(approveJson.decision, "REJECTED");
  assert.equal(approveJson.act_task_id, null);

  const latestReq = [...pool.facts].reverse().find((f) => f?.type === "approval_request_v1" && f?.payload?.request_id === "req_1");
  const latestDec = [...pool.facts].reverse().find((f) => f?.type === "approval_decision_v1" && f?.payload?.request_id === "req_1");
  assert.equal(latestReq?.payload?.status, "REJECTED");
  assert.equal(latestDec?.payload?.decision, "REJECTED");
  assert.equal(latestDec?.payload?.auto_task_issued, false);
  assert.equal(latestDec?.payload?.act_task_id, null);

  const aoTaskFacts = pool.facts.filter((f) => f?.type === "ao_act_task_v1" && String(f?.payload?.approval_request_id ?? "") === "req_1");
  assert.equal(aoTaskFacts.length, 0);

  await app.close();
});
