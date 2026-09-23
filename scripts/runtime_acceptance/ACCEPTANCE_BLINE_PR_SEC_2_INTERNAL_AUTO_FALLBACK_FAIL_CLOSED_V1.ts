import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerExecutionModule } from "../../apps/server/src/modules/execution/registerExecutionModule.js";

const PATH = "/api/internal/work-assignments/auto-fallback";
const ERROR = "INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_UNAVAILABLE";
type Phase = "registration" | "requests";
let phase: Phase = "registration";
const queryCounter = { total: 0, requestPhase: 0 };
const pool = {
  query: async (..._args: any[]) => {
    queryCounter.total += 1;
    if (phase === "requests") {
      queryCounter.requestPhase += 1;
      throw new Error("UNEXPECTED_BSEC141_DB_QUERY");
    }
    return { rows: [], rowCount: 0 };
  },
} as any;

const existingBearer = String(process.env.GEOX_TEST_BEARER ?? process.env.GEOX_AO_ACT_TOKEN ?? "tenant_a_admin_token");
const baseBody = {
  tenant_id: "tenant_attack",
  project_id: "project_attack",
  group_id: "group_attack",
  actor_id: "actor_attack",
  assignment_id: "wa_attack",
  act_task_id: "act_attack",
  executor_id: "executor_attack",
  operation_plan_id: "op_attack",
  source_dispatch_id: "dispatch_attack",
  assigned_at: "2026-09-03T00:00:00.000Z",
  fallback_context: {
    reason_code: "DISPATCH_FAILED",
    reason_message: "attacker controlled",
    dispatch_id: "dispatch_attack",
    retry_count: 9,
    max_retries: 9,
    takeover_conditions: ["DISPATCH_FAILED"],
  },
  sla: { accept_minutes: 1, arrive_minutes: 1 },
};

const cases = [
  { name: "no_query_parameter", query: "", headers: {}, body: baseBody },
  { name: "internal_false", query: "?__internal__=false", headers: {}, body: baseBody },
  { name: "internal_true", query: "?__internal__=true", headers: {}, body: baseBody },
  { name: "arbitrary_bearer", query: "", headers: { authorization: "Bearer arbitrary" }, body: baseBody },
  { name: "arbitrary_bearer_internal_true", query: "?__internal__=true", headers: { authorization: "Bearer arbitrary" }, body: baseBody },
  { name: "existing_commercial_bearer", query: "", headers: { authorization: `Bearer ${existingBearer}` }, body: baseBody },
  { name: "existing_commercial_bearer_internal_true", query: "?__internal__=true", headers: { authorization: `Bearer ${existingBearer}` }, body: baseBody },
  { name: "caller_scope", query: "?__internal__=true", headers: {}, body: { ...baseBody, tenant_id: "tenant_owned_by_caller", project_id: "project_owned_by_caller", group_id: "group_owned_by_caller" } },
  { name: "caller_actor", query: "?__internal__=true", headers: {}, body: { ...baseBody, actor_id: "caller_selected_admin" } },
  { name: "caller_executor", query: "?__internal__=true", headers: {}, body: { ...baseBody, executor_id: "caller_selected_executor" } },
  { name: "caller_assignment_task_plan", query: "?__internal__=true", headers: {}, body: { ...baseBody, assignment_id: "wa_caller", act_task_id: "act_caller", operation_plan_id: "op_caller" } },
  { name: "caller_fallback_sla", query: "?__internal__=true", headers: {}, body: { ...baseBody, fallback_context: { reason_code: "DEVICE_OFFLINE", takeover_conditions: ["DEVICE_OFFLINE"] }, sla: { accept_minutes: 10080, arrive_minutes: 10080 } } },
] as const;

async function main() {
  const app: FastifyInstance = Fastify({ logger: false });
  registerExecutionModule(app, pool);
  await app.ready();
  await new Promise((resolve) => setImmediate(resolve));
  const registrationQueryCount = queryCounter.total;
  phase = "requests";

  const results: any[] = [];
  for (const c of cases) {
    const beforeTotal = queryCounter.total;
    const beforeRequest = queryCounter.requestPhase;
    const res = await app.inject({
      method: "POST",
      url: `${PATH}${c.query}`,
      headers: { "content-type": "application/json", ...c.headers } as any,
      payload: c.body,
    });
    const json = res.json();
    if (res.statusCode !== 403 || json?.ok !== false || json?.error !== ERROR) {
      throw new Error(`${c.name} did not deterministically fail-close: ${res.statusCode} ${res.body}`);
    }
    if (queryCounter.total !== beforeTotal || queryCounter.requestPhase !== beforeRequest) {
      throw new Error(`${c.name} reached DB: total ${beforeTotal}->${queryCounter.total}, request ${beforeRequest}->${queryCounter.requestPhase}`);
    }
    results.push({ case: c.name, status: res.statusCode, error: json.error, db_query_delta: 0 });
  }

  await new Promise((resolve) => setImmediate(resolve));
  if (queryCounter.total !== registrationQueryCount || queryCounter.requestPhase !== 0) {
    throw new Error(`post-response DB query delta=${queryCounter.total-registrationQueryCount}, request_phase=${queryCounter.requestPhase}`);
  }
  await app.close();
  console.log(JSON.stringify({
    ok: true,
    path: PATH,
    error: ERROR,
    registration_query_count: registrationQueryCount,
    request_phase_db_query_delta: 0,
    post_response_db_query_delta: 0,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
