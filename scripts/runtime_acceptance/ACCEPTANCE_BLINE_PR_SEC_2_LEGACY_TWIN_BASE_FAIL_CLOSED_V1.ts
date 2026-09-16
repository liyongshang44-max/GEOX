import assert from "node:assert/strict";
import Fastify from "fastify";

import {
  LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
  registerTwinKernelModule,
} from "../../apps/server/src/modules/twin_kernel/registerTwinKernelModule.js";

const ROUTES = [
  "/api/v1/twin-kernel/field-state-snapshots",
  "/api/v1/twin-kernel/forecast-runs",
  "/api/v1/twin-kernel/scenario-sets",
  "/api/v1/twin-kernel/calibration-replays",
  "/api/v1/twin-kernel/field-learning-candidates",
  "/api/v1/twin-kernel/decision-cycles",
] as const;

const counters = { total_queries: 0 };
const trapPool = {
  async query(): Promise<never> {
    counters.total_queries += 1;
    throw new Error("LEGACY_TWIN_FAIL_CLOSE_DB_QUERY_MUST_BE_UNREACHABLE");
  },
} as any;

const existingCommercialBearer =
  String(process.env.GEOX_ACCEPTANCE_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? "tenant_a_admin_token").trim();
assert.ok(existingCommercialBearer, "existing Commercial bearer fixture must be non-empty");

const cases = [
  { name: "anonymous", headers: {}, payload: {} },
  { name: "arbitrary_bearer", headers: { authorization: "Bearer arbitrary_untrusted_token" }, payload: {} },
  { name: "existing_commercial_bearer", headers: { authorization: `Bearer ${existingCommercialBearer}` }, payload: {} },
  {
    name: "caller_controlled_identifiers_payload",
    headers: { authorization: `Bearer ${existingCommercialBearer}` },
    payload: {
      tenant_id: "caller-tenant",
      project_id: "caller-project",
      group_id: "caller-group",
      field_id: "caller-field",
      snapshot_id: "caller-snapshot",
      forecast_run_id: "caller-forecast",
      scenario_set_id: "caller-scenario",
      forecast_error_id: "caller-error",
      field_learning_candidate_id: "caller-candidate",
      observed: { observed_at: "2026-09-02T00:00:00.000Z", post_soil_moisture_percent: 42 },
      external_refs: { recommendation_id: "caller-recommendation" },
    },
  },
] as const;

async function main(): Promise<void> {
  const app = Fastify({ logger: false });
  registerTwinKernelModule(app, trapPool);
  await app.ready();

  const matrix: Array<{ route: string; case: string; status: number }> = [];
  try {
    for (const route of ROUTES) {
      for (const testCase of cases) {
        const response = await app.inject({
          method: "POST",
          url: route,
          headers: testCase.headers,
          payload: testCase.payload,
        });
        assert.equal(response.statusCode, 403, `${route} ${testCase.name} must fail closed`);
        const body = response.json();
        assert.deepEqual(body, {
          ok: false,
          error: LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
        });
        assert.equal(counters.total_queries, 0, `${route} ${testCase.name} must reject before any DB query`);
        matrix.push({ route, case: testCase.name, status: response.statusCode });
      }
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(counters.total_queries, 0, "post-response continuation must not issue DB queries");
  } finally {
    await app.close();
  }

  assert.equal(matrix.length, ROUTES.length * cases.length);
  console.log(JSON.stringify({
    result: "PASS",
    containment: "COMMERCIAL_FAIL_CLOSE",
    routes: ROUTES,
    rejection_cases_per_route: cases.map((item) => item.name),
    total_rejections: matrix.length,
    db_query_count: counters.total_queries,
    error: LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
