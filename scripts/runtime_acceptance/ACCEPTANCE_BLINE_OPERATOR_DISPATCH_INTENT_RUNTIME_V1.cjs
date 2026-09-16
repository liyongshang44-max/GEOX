#!/usr/bin/env node
"use strict";

const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");

const BASE_URL = String(process.env.BASE_URL || process.env.GEOX_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const TOKEN = String(process.env.GEOX_ACCEPTANCE_TOKEN || process.env.GEOX_AO_ACT_TOKEN || "").trim();
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const SCOPE = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" };
const TASK_ID = "bline_dispatch_intent_" + randomUUID().replace(/-/g, "");
const PLAN_ID = "opl_" + TASK_ID;
const TASK_FACT_ID = "fact_" + randomUUID();

function assert(ok, message, detail) {
  if (!ok) throw new Error(message + (detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2)));
}
async function relationExists(pool, name) {
  const r = await pool.query("SELECT to_regclass($1)::text AS name", ["public." + name]);
  return Boolean(r.rows?.[0]?.name);
}
async function queueCount(pool) {
  if (!(await relationExists(pool, "dispatch_queue_v1"))) return null;
  const r = await pool.query(
    "SELECT COUNT(*)::int AS count FROM dispatch_queue_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND act_task_id=$4",
    [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, TASK_ID],
  );
  return Number(r.rows?.[0]?.count ?? 0);
}
async function cleanup(pool) {
  await pool.query(
    "DELETE FROM facts WHERE fact_id=$1 OR ((record_json::jsonb->>'type')='ao_act_dispatch_v1' AND (record_json::jsonb#>>'{payload,act_task_id}')=$2) OR ((record_json::jsonb->>'type')='operator_action_audit_v1' AND (record_json::jsonb#>>'{payload,target_id}')=$2)",
    [TASK_FACT_ID, TASK_ID],
  ).catch(() => undefined);
  if (await relationExists(pool, "dispatch_queue_v1")) {
    await pool.query("DELETE FROM dispatch_queue_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND act_task_id=$4", [SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, TASK_ID]).catch(() => undefined);
  }
}

async function main() {
  assert(TOKEN, "GEOX_ACCEPTANCE_TOKEN required");
  assert(DATABASE_URL, "DATABASE_URL required");
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await cleanup(pool);
    const taskRecord = {
      type: "ao_act_task_v0",
      payload: {
        ...SCOPE,
        act_task_id: TASK_ID,
        command_id: TASK_ID,
        operation_plan_id: PLAN_ID,
        operation_id: PLAN_ID,
        field_id: "field_accept_1",
        action_type: "IRRIGATE",
        status: "TASK_CREATED",
        parameters: { duration_sec: 30 },
        meta: { acceptance_probe: "bline_operator_dispatch_intent_v1" },
      },
    };
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
      [TASK_FACT_ID, "acceptance/bline_operator_dispatch_intent_v1", taskRecord],
    );

    const queueBefore = await queueCount(pool);
    const response = await fetch(BASE_URL + "/api/v1/operator/dispatch/" + encodeURIComponent(TASK_ID) + "/dispatch", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authorization: "Bearer " + TOKEN },
      body: JSON.stringify({ note: "runtime proof: operator intent is not delivery" }),
    });
    const body = await response.json();
    assert(response.status === 200 && body?.ok === true, "operator dispatch request failed", { status: response.status, body });
    assert(body.status_after === "DISPATCH_REQUESTED", "operator response must be DISPATCH_REQUESTED", body);

    const fact = await pool.query(
      "SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='ao_act_dispatch_v1' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1",
      [TASK_ID],
    );
    const payload = fact.rows?.[0]?.record_json?.payload ?? {};
    assert(payload.status === "DISPATCH_REQUESTED", "dispatch fact must remain request intent", payload);
    assert(payload.dispatch_intent === true, "dispatch_intent must be true", payload);
    assert(payload.delivery_confirmed === false, "delivery_confirmed must be false", payload);
    assert(payload.acknowledgement_confirmed === false, "acknowledgement_confirmed must be false", payload);
    assert(typeof payload.requested_at === "string" && payload.requested_at.length > 0, "requested_at required", payload);
    assert(payload.dispatched_at == null, "operator intent must not mint dispatched_at", payload);

    const queueAfter = await queueCount(pool);
    if (queueBefore !== null && queueAfter !== null) {
      assert(queueAfter === queueBefore, "operator intent must not mutate canonical dispatch queue", { queueBefore, queueAfter });
    }

    const worklist = await fetch(BASE_URL + "/api/v1/operator/dispatch/worklist?limit=300", {
      headers: { accept: "application/json", authorization: "Bearer " + TOKEN },
    });
    const workBody = await worklist.json();
    const item = Array.isArray(workBody?.items) ? workBody.items.find((x) => x?.act_task_id === TASK_ID) : null;
    assert(item, "operator worklist must include probed task", workBody);
    assert(item.status === "DISPATCH_PENDING", "requested intent must project DISPATCH_PENDING", item);
    assert(Boolean(item.dispatch_requested_at), "worklist dispatch_requested_at required", item);
    assert(item.dispatched_at == null, "worklist must not claim dispatched_at before delivery", item);
    assert(item.can_dispatch === false, "pending intent must block duplicate dispatch request", item);

    console.log("BLINE_OPERATOR_DISPATCH_INTENT_RUNTIME_PASS " + JSON.stringify({
      task_id: TASK_ID,
      response_status: body.status_after,
      fact_status: payload.status,
      worklist_status: item.status,
      queue_mutation: queueBefore === null ? "NOT_APPLICABLE" : queueAfter - queueBefore,
    }));
  } finally {
    await cleanup(pool);
    await pool.end();
  }
}
main().catch((err) => {
  console.error("BLINE_OPERATOR_DISPATCH_INTENT_RUNTIME_FAIL");
  console.error(err?.stack || err);
  process.exit(1);
});
