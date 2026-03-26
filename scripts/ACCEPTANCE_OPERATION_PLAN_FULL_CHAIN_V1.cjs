#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const process = require("node:process");

function mustEnv(name) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`MISSING_ENV:${name}`);
  return v;
}

async function postJson(baseUrl, path, token, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function getJson(baseUrl, path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { accept: "application/json", authorization: token }
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const baseUrl = String(process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001").trim();
  console.log(`[acceptance] BASE_URL=${baseUrl}`);
  const token = mustEnv("GEOX_BEARER_TOKEN");
  const tenant_id = mustEnv("GEOX_TENANT_ID");
  const project_id = mustEnv("GEOX_PROJECT_ID");
  const group_id = mustEnv("GEOX_GROUP_ID");
  const recommendation_id = mustEnv("GEOX_RECOMMENDATION_ID");

  const submit = await postJson(baseUrl, `/api/v1/recommendations/${encodeURIComponent(recommendation_id)}/submit-approval`, token, {
    tenant_id, project_id, group_id, rationale: "acceptance operation plan full chain"
  });
  assert.equal(submit.status, 200, `SUBMIT_APPROVAL_STATUS_${submit.status}`);
  const operation_plan_id = String(submit.json?.operation_plan_id ?? "");
  const approval_request_id = String(submit.json?.approval_request_id ?? "");
  assert.ok(operation_plan_id, "MISSING_OPERATION_PLAN_ID");
  assert.ok(approval_request_id, "MISSING_APPROVAL_REQUEST_ID");

  const approve = await postJson(baseUrl, `/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, token, {
    tenant_id, project_id, group_id, decision: "APPROVE", reason: "acceptance"
  });
  assert.equal(approve.status, 200, `APPROVE_STATUS_${approve.status}`);
  const act_task_id = String(approve.json?.act_task_id ?? "");
  assert.ok(act_task_id, "MISSING_ACT_TASK_ID");

  const dispatch = await postJson(baseUrl, `/api/v1/ao-act/tasks/${encodeURIComponent(act_task_id)}/dispatch`, token, {
    tenant_id, project_id, group_id, command_id: act_task_id, device_id: "device_acceptance_01"
  });
  assert.equal(dispatch.status, 200, `DISPATCH_STATUS_${dispatch.status}`);

  const receipt = await postJson(baseUrl, `/api/v1/ao-act/receipts/uplink`, token, {
    tenant_id, project_id, group_id, task_id: act_task_id, command_id: act_task_id, device_id: "device_acceptance_01",
    meta: { idempotency_key: `acceptance_${Date.now()}` }
  });
  assert.equal(receipt.status, 200, `RECEIPT_STATUS_${receipt.status}`);

  const plan = await getJson(baseUrl, `/api/v1/operations/plans/${encodeURIComponent(operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, token);
  assert.equal(plan.status, 200, `PLAN_STATUS_${plan.status}`);
  const item = plan.json?.item ?? {};
  assert.ok(item.plan, "PLAN_MISSING");
  assert.ok(item.approval, "APPROVAL_MISSING");
  assert.ok(item.task, "TASK_MISSING");
  assert.ok(item.receipt, "RECEIPT_MISSING");
  const status = String(item.plan?.record_json?.payload?.status ?? "");
  assert.ok(status === "SUCCEEDED" || status === "FAILED", `FINAL_STATUS_INVALID:${status}`);

  console.log(JSON.stringify({
    ok: true,
    operation_plan_id,
    approval_request_id,
    act_task_id,
    final_status: status
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.stack ?? err?.message ?? err));
  process.exit(1);
});
