import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerEvidenceBundleV1Routes } from "./evidence_bundle_v1.js";

class EvidenceBundlePool {
  async query(sql: string, _params?: any[]) {
    const text = String(sql);

    if (text.includes("operation_plan_v1") && text.includes("LIMIT 1") && text.includes("ORDER BY occurred_at DESC")) {
      return {
        rows: [{
          fact_id: "fact_plan_1",
          occurred_at: new Date().toISOString(),
          source: "test",
          record_json: {
            type: "operation_plan_v1",
            payload: {
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
              operation_plan_id: "opl_1",
              act_task_id: "task_1",
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("ao_act_task_v0") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_task_1",
          occurred_at: new Date().toISOString(),
          source: "test",
          record_json: {
            type: "ao_act_task_v0",
            payload: { act_task_id: "task_1", executor_id: { id: "executor_1", kind: "script" } },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("ao_act_receipt_v0") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_receipt_1",
          occurred_at: new Date().toISOString(),
          source: "test",
          record_json: {
            type: "ao_act_receipt_v0",
            payload: { act_task_id: "task_1", status: "executed", logs_refs: [{ kind: "dispatch_ack", ref: "log_1" }] },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("evidence_artifact_v1")) {
      return {
        rows: [{
          fact_id: "fact_art_1",
          occurred_at: new Date().toISOString(),
          source: "test",
          record_json: {
            type: "evidence_artifact_v1",
            payload: {
              artifact_id: "art_1",
              operation_plan_id: "opl_1",
              act_task_id: "task_1",
              kind: "irrigation_photo",
              url: "https://example.com/a.jpg",
              created_at: new Date().toISOString(),
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("acceptance_result_v1") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          fact_id: "fact_acc_1",
          occurred_at: new Date().toISOString(),
          source: "test",
          record_json: {
            type: "acceptance_result_v1",
            payload: {
              acceptance_id: "acc_1",
              operation_plan_id: "opl_1",
              act_task_id: "task_1",
              verdict: "PASS",
              explanation_codes: ["ok"],
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("skill_run_v1")) return { rows: [], rowCount: 0 };

    // loadOperationProjectionFacts extra queries can return empty safely.
    if (text.includes("FROM facts")) return { rows: [], rowCount: 0 };

    return { rows: [], rowCount: 0 };
  }
}

async function setupApp(pool: EvidenceBundlePool) {
  process.env.GEOX_TOKEN = "bundle-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.index.read";

  const app = Fastify();
  registerEvidenceBundleV1Routes(app, pool as any);
  await app.ready();
  return app;
}

test("evidence bundle aggregates receipt, artifacts, acceptance", async () => {
  const app = await setupApp(new EvidenceBundlePool());

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/operations/opl_1/evidence-bundle?tenant_id=tenantA&project_id=projectA&group_id=groupA",
    headers: { authorization: "Bearer bundle-token" },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body?.item?.receipt);
  assert.ok(Array.isArray(body?.item?.artifacts));
  assert.equal(body?.item?.artifacts?.length, 1);
  assert.ok(body?.item?.acceptance);
  await app.close();
});
