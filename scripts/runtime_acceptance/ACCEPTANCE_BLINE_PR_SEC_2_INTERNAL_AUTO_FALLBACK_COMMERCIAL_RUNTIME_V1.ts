import crypto from "node:crypto";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const EXISTING_BEARER = String(process.env.GEOX_TEST_BEARER ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
const PATH = "/api/internal/work-assignments/auto-fallback";
const ERROR = "INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_UNAVAILABLE";
const TARGETS = [
  "work_assignment_index_v1",
  "operation_handoff_v1",
  "work_assignment_audit_v1",
  "service_team_index_v1",
  "human_executor_index_v1",
  "work_assignment_reassign_log_v1",
  "facts",
] as const;

if (!DATABASE_URL) throw new Error("DATABASE_URL required");
if (!EXISTING_BEARER) throw new Error("GEOX_TEST_BEARER/GEOX_AO_ACT_TOKEN required");

const pool = new Pool({ connectionString: DATABASE_URL });

async function tablePresence(): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const table of TARGETS) {
    const q = await pool.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${table}`]);
    out[table] = Boolean(q.rows?.[0]?.present);
  }
  return out;
}

async function sentinelHits(sentinel: string, presence: Record<string, boolean>): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const table of TARGETS) {
    if (!presence[table]) {
      out[table] = false;
      continue;
    }
    const sql = `SELECT EXISTS(SELECT 1 FROM "${table}" AS t WHERE row_to_json(t)::text LIKE $1) AS hit`;
    const q = await pool.query(sql, [`%${sentinel}%`]);
    out[table] = Boolean(q.rows?.[0]?.hit);
  }
  return out;
}

async function reject(name: string, query: string, bearer: string | null, body: any) {
  const res = await fetch(`${BASE_URL}${PATH}${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (res.status !== 403 || json?.ok !== false || json?.error !== ERROR) {
    throw new Error(`${name} expected deterministic 403 ${ERROR}, got ${res.status} ${text}`);
  }
  return { name, status: res.status, error: json.error };
}

async function main() {
  const sentinel = `bsec141_${crypto.randomUUID().replace(/-/g, "")}`;
  const body = {
    tenant_id: `${sentinel}_tenant`,
    project_id: `${sentinel}_project`,
    group_id: `${sentinel}_group`,
    actor_id: `${sentinel}_actor`,
    assignment_id: `${sentinel}_assignment`,
    act_task_id: `${sentinel}_task`,
    executor_id: `${sentinel}_executor`,
    operation_plan_id: `${sentinel}_plan`,
    source_dispatch_id: `${sentinel}_dispatch`,
    assigned_at: new Date().toISOString(),
    fallback_context: {
      reason_code: "DISPATCH_FAILED",
      reason_message: sentinel,
      dispatch_id: `${sentinel}_dispatch`,
      retry_count: 4,
      max_retries: 4,
      takeover_conditions: ["DISPATCH_FAILED"],
    },
    sla: { accept_minutes: 1, arrive_minutes: 1 },
  };

  const beforePresence = await tablePresence();
  const beforeHits = await sentinelHits(sentinel, beforePresence);
  if (Object.values(beforeHits).some(Boolean)) throw new Error(`sentinel collision before request: ${JSON.stringify(beforeHits)}`);

  const results = [];
  results.push(await reject("no_query_parameter", "", null, body));
  results.push(await reject("internal_false", "?__internal__=false", null, body));
  results.push(await reject("internal_true", "?__internal__=true", null, body));
  results.push(await reject("arbitrary_bearer", "", "arbitrary", body));
  results.push(await reject("arbitrary_bearer_internal_true", "?__internal__=true", "arbitrary", body));
  results.push(await reject("existing_commercial_bearer", "", EXISTING_BEARER, body));
  results.push(await reject("existing_commercial_bearer_internal_true", "?__internal__=true", EXISTING_BEARER, body));
  results.push(await reject("caller_scope", "?__internal__=true", null, { ...body, tenant_id: `${sentinel}_scope_t`, project_id: `${sentinel}_scope_p`, group_id: `${sentinel}_scope_g` }));
  results.push(await reject("caller_actor", "?__internal__=true", null, { ...body, actor_id: `${sentinel}_caller_actor` }));
  results.push(await reject("caller_executor", "?__internal__=true", null, { ...body, executor_id: `${sentinel}_caller_executor` }));
  results.push(await reject("caller_assignment_task_plan", "?__internal__=true", null, { ...body, assignment_id: `${sentinel}_wa2`, act_task_id: `${sentinel}_task2`, operation_plan_id: `${sentinel}_op2` }));
  results.push(await reject("caller_fallback_sla", "?__internal__=true", null, { ...body, fallback_context: { reason_code: "DEVICE_OFFLINE", reason_message: sentinel, takeover_conditions: ["DEVICE_OFFLINE"] }, sla: { accept_minutes: 10080, arrive_minutes: 10080 } }));

  await new Promise((resolve) => setTimeout(resolve, 750));

  const afterPresence = await tablePresence();
  if (JSON.stringify(afterPresence) !== JSON.stringify(beforePresence)) {
    throw new Error(`seven-target table presence changed: before=${JSON.stringify(beforePresence)} after=${JSON.stringify(afterPresence)}`);
  }
  const afterHits = await sentinelHits(sentinel, afterPresence);
  const leaked = Object.entries(afterHits).filter(([, hit]) => hit).map(([table]) => table);
  if (leaked.length) throw new Error(`rejected BSEC-141 request produced sentinel persistence in: ${leaked.join(",")}`);

  console.log(JSON.stringify({
    ok: true,
    path: PATH,
    error: ERROR,
    sentinel,
    table_presence_before: beforePresence,
    table_presence_after: afterPresence,
    sentinel_hits_after: afterHits,
    results,
  }, null, 2));
}

main().finally(() => pool.end()).catch((error) => {
  console.error(error);
  process.exit(1);
});
