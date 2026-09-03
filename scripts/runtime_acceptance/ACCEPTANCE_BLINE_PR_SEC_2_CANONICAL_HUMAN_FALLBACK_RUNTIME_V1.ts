import crypto from "node:crypto";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const TOKEN = String(process.env.GEOX_TEST_BEARER ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
const tenant_id = String(process.env.GEOX_ACCEPTANCE_TENANT_ID ?? process.env.GEOX_AO_ACT_TENANT_ID ?? "tenantA").trim();
const project_id = String(process.env.GEOX_ACCEPTANCE_PROJECT_ID ?? process.env.GEOX_AO_ACT_PROJECT_ID ?? "projectA").trim();
const group_id = String(process.env.GEOX_ACCEPTANCE_GROUP_ID ?? process.env.GEOX_AO_ACT_GROUP_ID ?? "groupA").trim();

if (!DATABASE_URL) throw new Error("DATABASE_URL required");
if (!TOKEN) throw new Error("authenticated AO-ACT token required");
const pool = new Pool({ connectionString: DATABASE_URL });

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, text, json };
}

async function main() {
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const act_task_id = `bsec141_task_${suffix}`;
  const queue_id = `bsec141_queue_${suffix}`;
  const task_fact_id = `bsec141_task_fact_${suffix}`;
  const outbox_fact_id = `bsec141_outbox_${suffix}`;
  const triple = { tenant_id, project_id, group_id };

  const bootstrap = await request(
    `${BASE_URL}/api/v1/ao-act/dispatches?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=1`,
    { headers: { authorization: `Bearer ${TOKEN}` } },
  );
  if (!bootstrap.ok || bootstrap.json?.ok !== true) {
    throw new Error(`dispatch queue bootstrap failed: ${bootstrap.status} ${bootstrap.text}`);
  }

  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [task_fact_id, "acceptance/bline-pr-sec2-batch006", {
      type: "ao_act_task_v0",
      payload: {
        ...triple,
        act_task_id,
        command_id: act_task_id,
        operation_plan_id: null,
        action_type: "IRRIGATION",
        field_id: `field_${suffix.slice(0, 12)}`,
        required_capabilities: [],
        capabilities: [],
        meta: { test_only: "BATCH006_CANONICAL_FALLBACK_REGRESSION" },
      },
    }],
  );

  await pool.query(
    `INSERT INTO dispatch_queue_v1
      (queue_id, tenant_id, project_id, group_id, act_task_id, command_id, task_fact_id, outbox_fact_id,
       device_id, downlink_topic, qos, retain, adapter_hint, state, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,1,false,NULL,'READY',NOW(),NOW())`,
    [queue_id, tenant_id, project_id, group_id, act_task_id, act_task_id, task_fact_id, outbox_fact_id],
  );

  const failed = await request(`${BASE_URL}/api/v1/ao-act/dispatches/state`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      ...triple,
      act_task_id,
      command_id: act_task_id,
      state: "FAILED",
      failure_code: "DISPATCH_FAILED",
      failure_reason: "FAILED",
      failure_message: "Batch006 canonical fallback regression",
      retry_exhausted: true,
      attempt_no: 3,
      max_retries: 3,
      sla: { accept_minutes: 30, arrive_minutes: 120 },
    }),
  });

  if (!failed.ok || failed.json?.ok !== true) throw new Error(`canonical FAILED transition failed: ${failed.status} ${failed.text}`);
  if (failed.json?.manual_fallback_created !== true) throw new Error(`manual_fallback_created != true: ${failed.text}`);
  for (const key of ["manual_fallback_fact_id", "work_assignment_fact_id", "work_assignment_id"]) {
    if (!String(failed.json?.[key] ?? "").trim()) throw new Error(`${key} missing`);
  }

  const facts = await pool.query(
    `SELECT fact_id, source, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb#>>'{payload,act_task_id}') = $1
        AND (record_json::jsonb->>'type') IN ('ao_act_manual_fallback_v1','work_assignment_upserted_v1')
      ORDER BY occurred_at ASC, fact_id ASC`,
    [act_task_id],
  );
  const types = new Set((facts.rows ?? []).map((r: any) => String(r.record_json?.type ?? "")));
  if (!types.has("ao_act_manual_fallback_v1")) throw new Error("canonical ao_act_manual_fallback_v1 missing");
  if (!types.has("work_assignment_upserted_v1")) throw new Error("canonical work_assignment_upserted_v1 missing");
  const wrongSource = (facts.rows ?? []).filter((r: any) => String(r.source ?? "") !== "api/v1/ao-act/dispatches/state");
  if (wrongSource.length) throw new Error(`canonical fallback fact source drift: ${JSON.stringify(wrongSource)}`);

  console.log(JSON.stringify({
    ok: true,
    authenticated_entrypoint: "/api/v1/ao-act/dispatches/state",
    state: "FAILED",
    act_task_id,
    manual_fallback_created: true,
    manual_fallback_fact_id: failed.json.manual_fallback_fact_id,
    work_assignment_fact_id: failed.json.work_assignment_fact_id,
    work_assignment_id: failed.json.work_assignment_id,
    proven_fact_types: Array.from(types).sort(),
  }, null, 2));
}

main().finally(() => pool.end()).catch((error) => {
  console.error(error);
  process.exit(1);
});
