import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDashboardV1Routes } from "../src/routes/dashboard_v1";

test("dashboard routes derive statuses from final_status only", async () => {
  const operationStates = [
    { operation_plan_id: "op_final_running", field_id: "fieldA", final_status: "RUNNING", dispatch_status: "FAILED", last_event_ts: 3000 },
    { operation_plan_id: "op_dispatch_only", field_id: "fieldB", final_status: null, dispatch_status: "RUNNING", last_event_ts: 2000 },
    { operation_plan_id: "op_failed", field_id: "fieldC", final_status: "FAILED", dispatch_status: "RUNNING", last_event_ts: 1000 },
  ];

  const pool = {
    query: async () => ({ rows: [] as any[] }),
  } as any;

  const app = Fastify();
  app.decorate("dashboardProjectOperationStateV1", async () => operationStates);
  registerDashboardV1Routes(app, pool);

  const authHeader = {
    authorization: "Bearer ${GEOX_TOKEN}",
  };

  const overviewRes = await app.inject({
    method: "GET",
    url: "/api/v1/dashboard/overview_v2",
    headers: authHeader,
  });
  assert.equal(overviewRes.statusCode, 200);
  const overviewBody = overviewRes.json();

  const inProgressIds = overviewBody.customer_dashboard.execution.in_progress.map((item: any) => item.operation_plan_id);
  const failedIds = overviewBody.customer_dashboard.execution.failed.map((item: any) => item.operation_plan_id);

  assert.deepEqual(inProgressIds, ["op_final_running"]);
  assert.deepEqual(failedIds, ["op_failed"]);

  const recentRes = await app.inject({
    method: "GET",
    url: "/api/v1/dashboard/executions/recent?limit=3",
    headers: authHeader,
  });
  assert.equal(recentRes.statusCode, 200);
  const recentBody = recentRes.json();

  const dispatchOnly = recentBody.items.find((item: any) => item.operation_plan_id === "op_dispatch_only");
  assert.ok(dispatchOnly);
  assert.equal(dispatchOnly.status, "UNKNOWN");

  await app.close();
});
