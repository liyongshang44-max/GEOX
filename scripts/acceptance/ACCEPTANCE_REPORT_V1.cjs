#!/usr/bin/env node
/*
 * Stage-5 report acceptance
 * 1) Reuse strict fixed-object evidence acceptance.
 * 2) Generate evidence report for the same operation.
 * 3) Validate report content is consistent with detail content.
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const BASE_URL = process.env.GEOX_BASE_URL || "http://localhost:8787";
const TENANT_ID = process.env.GEOX_TENANT_ID || "demo_tenant";
const PROJECT_ID = process.env.GEOX_PROJECT_ID || "demo_project";
const GROUP_ID = process.env.GEOX_GROUP_ID || "demo_group";
const TOKEN = process.env.GEOX_BEARER || process.env.AO_ACT_TOKEN || "";
const FIXED_OPERATION_PLAN_ID = process.env.GEOX_FIXED_OPERATION_PLAN_ID || "opl_c309192971774a24b8526ae568a36903";
const POLL_MS = Number(process.env.GEOX_REPORT_POLL_MS || 1000);
const POLL_TIMEOUT_MS = Number(process.env.GEOX_REPORT_POLL_TIMEOUT_MS || 120000);

function headers() {
  const h = { "content-type": "application/json" };
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  return h;
}

async function requestJson(path, init = {}) {
  const url = new URL(path, BASE_URL);
  const response = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url.toString()} => ${text}`);
  }
  return json;
}

async function requestText(path, init = {}) {
  const url = new URL(path, BASE_URL);
  const response = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url.toString()} => ${text}`);
  }
  return text;
}

function q(params) {
  const sp = new URLSearchParams(params);
  return `?${sp.toString()}`;
}

function runStrictFixedObjectAcceptance() {
  const r = spawnSync("node", ["scripts/acceptance/ACCEPTANCE_EVIDENCE_STRICT_FIXED_OBJECT_V1.cjs"], {
    stdio: "inherit",
    env: process.env,
  });
  assert.equal(r.status, 0, "ACCEPTANCE_EVIDENCE_STRICT_FIXED_OBJECT_V1.cjs must pass first");
}

async function pollReportDone(jobId) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const status = await requestJson(`/api/v1/evidence-reports/${encodeURIComponent(jobId)}`);
    const code = String(status?.status || "").toUpperCase();
    if (code === "DONE") return status;
    if (code === "FAILED") {
      throw new Error(`report job failed: ${status?.error || "unknown"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`report job timeout after ${POLL_TIMEOUT_MS}ms (is jobs runtime running?)`);
}

(async () => {
  console.log("[acceptance-report-v1] start");

  runStrictFixedObjectAcceptance();

  const tenantQuery = q({
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
  });

  const detailRes = await requestJson(`/api/v1/operations/${encodeURIComponent(FIXED_OPERATION_PLAN_ID)}/detail${tenantQuery}`);
  const detail = detailRes.operation || detailRes.item || {};
  assert.equal(String(detail.final_status || "").toUpperCase(), "INVALID_EXECUTION", "fixed object must remain INVALID_EXECUTION");

  const createRes = await requestJson("/api/v1/evidence-reports", {
    method: "POST",
    body: JSON.stringify({ operation_plan_id: FIXED_OPERATION_PLAN_ID }),
  });
  const jobId = String(createRes?.job_id || "");
  assert.ok(jobId, "missing report job_id");

  const done = await pollReportDone(jobId);
  const downloadUrl = String(done?.download_url || "");
  assert.ok(downloadUrl, "missing download_url for done report");

  const html = await requestText(downloadUrl);

  // Report content = detail content (core constraints)
  assert.ok(html.includes(FIXED_OPERATION_PLAN_ID), "report must include operation_plan_id");
  assert.ok(html.includes("INVALID_EXECUTION"), "report must include INVALID_EXECUTION final status");
  assert.ok(html.includes(String(detail.field_id || "-")), "report field_id must match detail field_id");
  if (detail.task?.device_id) {
    assert.ok(html.includes(String(detail.task.device_id)), "report device_id must match detail task.device_id");
  }

  // INVALID_EXECUTION business expression must be explicit
  assert.ok(html.includes("未产生有效业务效果"), "invalid execution report must state no effective business effect");

  console.log("[acceptance-report-v1] PASS", {
    operation_plan_id: FIXED_OPERATION_PLAN_ID,
    final_status: detail.final_status,
    report_job_id: jobId,
  });
})().catch((error) => {
  console.error("[acceptance-report-v1] FAIL", error?.message || error);
  process.exit(1);
});
