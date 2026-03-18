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
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function getJson(baseUrl, path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const baseUrl = String(process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3000").trim();
  const token = mustEnv("GEOX_BEARER_TOKEN");

  const recommendation_id = mustEnv("GEOX_RECOMMENDATION_ID");
  const field_id = mustEnv("FIELD_ID");
  const season_id = mustEnv("SEASON_ID");
  const device_id = mustEnv("DEVICE_ID");

  // 1) submit approval
  const submit = await postJson(
    baseUrl,
    `/api/v1/recommendations/${encodeURIComponent(recommendation_id)}/submit-approval`,
    token,
    {
      recommendation_id,
      field_id,
      season_id,
      device_id,
    }
  );
  assert.equal(submit.status, 200, `SUBMIT_APPROVAL_STATUS_${submit.status}`);

  const operation_plan_id = String(submit.json?.operation_plan_id ?? "");
  const approval_request_id = String(submit.json?.approval_request_id ?? "");
  assert.ok(operation_plan_id, "MISSING_OPERATION_PLAN_ID");
  assert.ok(approval_request_id, "MISSING_APPROVAL_REQUEST_ID");

  // 2) approve
  const approve = await postJson(
    baseUrl,
    `/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`,
    token,
    {
      decision: "APPROVE",
      reason: "acceptance",
    }
  );
  assert.equal(approve.status, 200, `APPROVE_STATUS_${approve.status}`);

  const act_task_id = String(approve.json?.act_task_id ?? "");
  assert.ok(act_task_id, "MISSING_ACT_TASK_ID");

  // 3) dispatch
  const dispatch = await postJson(
    baseUrl,
    `/api/v1/ao-act/tasks/${encodeURIComponent(act_task_id)}/dispatch`,
    token,
    {
      command_id: act_task_id,
      device_id,
    }
  );
  assert.equal(dispatch.status, 200, `DISPATCH_STATUS_${dispatch.status}`);

  const outbox_fact_id = String(dispatch.json?.outbox_fact_id ?? "");
  const downlink_topic = String(dispatch.json?.downlink_topic ?? "");
  const qos = Number(dispatch.json?.qos ?? 1);
  const retain = Boolean(dispatch.json?.retain ?? false);

  assert.ok(outbox_fact_id, "MISSING_OUTBOX_FACT_ID");
  assert.ok(downlink_topic, "MISSING_DOWNLINK_TOPIC");

  // 4) mark downlink as published
  const published = await postJson(
    baseUrl,
    `/api/v1/ao-act/downlinks/published`,
    token,
    {
      act_task_id,
      outbox_fact_id,
      device_id,
      topic: downlink_topic,
      qos,
      retain,
      adapter_runtime: "acceptance_manual_v1",
      command_payload_sha256: `acceptance_${act_task_id}`,
    }
  );
  assert.equal(published.status, 200, `PUBLISHED_STATUS_${published.status}`);

  const published_fact_id = String(published.json?.published_fact_id ?? "");
  assert.ok(published_fact_id, "MISSING_PUBLISHED_FACT_ID");

  // 5) receipt uplink
  const receipt = await postJson(
    baseUrl,
    `/api/v1/ao-act/receipts/uplink`,
    token,
    {
      task_id: act_task_id,
      command_id: act_task_id,
      device_id,
      status: "executed",
      meta: {
        idempotency_key: `acceptance_${Date.now()}`,
      },
    }
  );
  assert.equal(receipt.status, 200, `RECEIPT_STATUS_${receipt.status}`);

  // 6) query final plan
  const plan = await getJson(
    baseUrl,
    `/api/v1/operations/plans/${encodeURIComponent(operation_plan_id)}`,
    token
  );
  assert.equal(plan.status, 200, `PLAN_STATUS_${plan.status}`);

  const item = plan.json?.item ?? {};
  assert.ok(item.plan, "PLAN_MISSING");
  assert.ok(item.approval, "APPROVAL_MISSING");
  assert.ok(item.task, "TASK_MISSING");
  assert.ok(item.receipt, "RECEIPT_MISSING");

  const status = String(item.plan?.record_json?.payload?.status ?? "");
  assert.ok(status === "SUCCEEDED" || status === "FAILED", `FINAL_STATUS_INVALID:${status}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        operation_plan_id,
        approval_request_id,
        act_task_id,
        outbox_fact_id,
        published_fact_id,
        final_status: status,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(String(err?.stack ?? err?.message ?? err));
  process.exit(1);
});