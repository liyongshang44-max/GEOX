#!/usr/bin/env node

const assert = require("node:assert/strict");

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

const base = String(process.env.GEOX_BASE_URL || "http://127.0.0.1:3001").trim();
const token = requiredEnv("AO_ACT_TOKEN");
const tenant_id = requiredEnv("GEOX_TENANT_ID");
const project_id = requiredEnv("GEOX_PROJECT_ID");
const group_id = requiredEnv("GEOX_GROUP_ID");

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, ok: response.ok, json, text };
}

function requireOk(resp, label) {
  assert.equal(resp.ok, true, `${label} status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${label} json.ok!=true body=${resp.text}`);
  return resp.json;
}

(async () => {
  const seed = Date.now();
  const operation_plan_id = `op_human_stage2_${seed}`;
  const act_task_id = `act_human_stage2_${seed}`;
  const executor_id = `human_exec_${seed}`;
  const assignment_id = `assign_${seed}`;

  await requireOk(await api("/api/raw", {
    method: "POST",
    body: {
      source: "acceptance/human_executor_stage2_v1",
      record_json: {
        type: "operation_plan_v1",
        payload: { tenant_id, project_id, group_id, operation_plan_id, act_task_id, action_type: "IRRIGATE", field_id: "field_accept_1" },
      },
    },
  }), "seed operation plan");

  await requireOk(await api("/api/raw", {
    method: "POST",
    body: {
      source: "acceptance/human_executor_stage2_v1",
      record_json: {
        type: "ao_act_task_v0",
        payload: { tenant_id, project_id, group_id, operation_plan_id, act_task_id, action_type: "IRRIGATE", meta: { device_id: "dev_accept_1" } },
      },
    },
  }), "seed act task");

  const createExecutor = requireOk(await api("/api/v1/human-executors", {
    method: "POST",
    body: { executor_id, display_name: "阶段二验收人", capabilities: ["IRRIGATE"] },
  }), "create human executor");
  assert.equal(String(createExecutor.executor?.executor_id ?? ""), executor_id);

  const assignTask = requireOk(await api("/api/v1/work-assignments", {
    method: "POST",
    body: { assignment_id, act_task_id, executor_id, status: "ASSIGNED" },
  }), "assign act task");
  assert.equal(String(assignTask.assignment?.act_task_id ?? ""), act_task_id);

  const beforeDetail = requireOk(await api(`/api/v1/operations/${encodeURIComponent(operation_plan_id)}/detail?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`), "operation detail before submit");
  assert.equal(beforeDetail.item?.receipt, null, "receipt should be empty before submit");

  const submit = requireOk(await api(`/api/v1/work-assignments/${encodeURIComponent(assignment_id)}/submit`, {
    method: "POST",
    body: {
      execution_time: { start_ts: seed, end_ts: seed + 60_000 },
      execution_coverage: { kind: "field", ref: "field_accept_1" },
      status: "executed",
      logs_refs: [{ kind: "photo", ref: `artifact://human/${seed}/proof.jpg` }],
      meta: { idempotency_key: `human-stage2-${seed}` },
    },
  }), "submit minimal receipt");
  assert.ok(String(submit.receipt_fact_id ?? "").length > 0, "receipt_fact_id missing");

  const afterDetail = requireOk(await api(`/api/v1/operations/${encodeURIComponent(operation_plan_id)}/detail?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`), "operation detail after submit");
  assert.ok(afterDetail.item?.receipt, "receipt should be visible after submit");
  assert.ok(Array.isArray(afterDetail.item?.timeline), "timeline must be an array");
  assert.ok(afterDetail.item.timeline.some((x) => String(x?.kind ?? "").includes("DEVICE_ACK") || String(x?.kind ?? "").includes("SUCCEEDED")), "timeline should include receipt related progress");
  assert.equal(String(afterDetail.item?.final_status ?? ""), "PENDING_ACCEPTANCE", "final_status must stay pending until acceptance");

  console.log("PASS ACCEPTANCE_HUMAN_EXECUTOR_STAGE2_V1", {
    operation_plan_id,
    act_task_id,
    executor_id,
    assignment_id,
    receipt_fact_id: submit.receipt_fact_id,
    final_status: afterDetail.item?.final_status,
  });
})().catch((err) => {
  console.error("FAIL ACCEPTANCE_HUMAN_EXECUTOR_STAGE2_V1", err?.message || err);
  process.exit(1);
});
