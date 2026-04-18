import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDashboardV1Routes } from "../src/routes/dashboard_v1";

test("dashboard stage1 sensing summary endpoint exposes official contract payload", async () => {
  process.env.GEOX_TOKEN = "${GEOX_TOKEN}";
  const pool = {
    query: async () => ({ rows: [] as any[] }),
  } as any;

  const app = Fastify();
  registerDashboardV1Routes(app, pool);

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/dashboard/fields/f-1/sensing-summary",
    headers: { authorization: "Bearer ${GEOX_TOKEN}" },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.endpoint_contract, "stage1_sensing_summary_v1");
  assert.ok(body.stage1_sensing_summary);
  assert.ok(body.stage1_refresh);
  assert.equal(body.sensing_runtime_boundary?.default_equivalence_forbidden, true);
  assert.equal(body.sensing_overview, undefined);

  await app.close();
});
