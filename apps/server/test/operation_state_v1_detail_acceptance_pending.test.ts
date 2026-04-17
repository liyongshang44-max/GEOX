import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerOperationStateV1Routes } from "../src/routes/operation_state_v1";

const TOKEN = process.env.GEOX_TOKEN || process.env.GEOX_AO_ACT_TOKEN || "";

test("GET /api/v1/operations/:operationPlanId/detail keeps acceptance skill trace as PENDING when verdict is PENDING_ACCEPTANCE", async () => {
  const operationPlanId = "op_acceptance_pending";
  const tenant = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };

  const facts: any[] = [
    {
      fact_id: "fact_plan",
      occurred_at: "2026-03-19T20:00:00.000Z",
      source: "test",
      record_json: {
        type: "operation_plan_v1",
        payload: {
          ...tenant,
          operation_plan_id: operationPlanId,
        },
      },
    },
    {
      fact_id: "fact_acceptance",
      occurred_at: "2026-03-19T20:02:00.000Z",
      source: "test",
      record_json: {
        type: "acceptance_result_v1",
        payload: {
          ...tenant,
          operation_plan_id: operationPlanId,
          verdict: "PENDING_ACCEPTANCE",
        },
      },
    },
  ];

  const pool = {
    query: async (sql: string, params?: any[]) => {
      const text = String(sql);

      if (text.includes("CREATE TABLE IF NOT EXISTS rule_performance_v1")) {
        return { rows: [], rowCount: 0 };
      }

      if (text.includes("COUNT(*)::int AS cnt") && text.includes("action_execution_request_v1")) {
        return { rows: [{ cnt: 0 }], rowCount: 1 };
      }

      if (text.startsWith("INSERT INTO facts")) {
        const recordJsonParam = params?.[3] ?? params?.[2];
        facts.push({
          fact_id: String(params?.[0] ?? `fact_${facts.length + 1}`),
          occurred_at: new Date().toISOString(),
          source: String(params?.[1] ?? "test"),
          record_json: typeof recordJsonParam === "string" ? JSON.parse(recordJsonParam) : recordJsonParam,
        });
        return { rows: [], rowCount: 1 };
      }

      if (text.includes("FROM facts") && text.includes("(record_json::jsonb->>'type') IN (") && text.includes("'skill_run_v1'")) {
        return { rows: facts, rowCount: facts.length };
      }

      if (text.includes("FROM facts") && text.includes("operation_plan_v1") && text.includes("operation_plan_transition_v1")) {
        return { rows: [facts[0]], rowCount: 1 };
      }

      if (text.includes("FROM facts") && text.includes("(record_json::jsonb->>'type') = 'skill_run_v1'")) {
        const triggerStage = String(params?.[4] ?? "");
        const rows = facts.filter((row) => {
          if (row.record_json?.type !== "skill_run_v1") return false;
          const payload = row.record_json?.payload ?? {};
          return (
            payload.operation_id === operationPlanId
            || payload.operation_plan_id === operationPlanId
          ) && payload.trigger_stage === triggerStage;
        });
        return { rows, rowCount: rows.length };
      }

      if (text.includes("FROM facts") && text.includes("(record_json::jsonb->>'type') = $1")) {
        const type = String(params?.[0] ?? "");
        const keyValue = String(params?.[4] ?? "");
        const rows = facts.filter((row) => {
          if (row.record_json?.type !== type) return false;
          const payload = row.record_json?.payload ?? {};
          return payload.operation_id === keyValue || payload.operation_plan_id === keyValue || payload.request_id === keyValue || payload.recommendation_id === keyValue || payload.act_task_id === keyValue;
        });
        return { rows, rowCount: rows.length };
      }

      return { rows: [], rowCount: 0 };
    },
  } as any;

  const app = Fastify();
  registerOperationStateV1Routes(app, pool);
  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: `/api/v1/operations/${operationPlanId}/detail?tenant_id=${tenant.tenant_id}&project_id=${tenant.project_id}&group_id=${tenant.group_id}`,
    headers: {
      authorization: `Bearer ${TOKEN}`,
    },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);

  const acceptanceStage = body.skill_trace.find((item: any) => item.stage === "acceptance");
  assert.ok(acceptanceStage);
  assert.equal(acceptanceStage.status, "PENDING");

  assert.equal(body.legacy_skill_trace?.acceptance_skill?.result_status, "PENDING");
  assert.equal(body.legacy_skill_trace?.acceptance_skill?.error_code, null);

  await app.close();
});
