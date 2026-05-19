#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function env(name, fallback) {
  const value = String(process.env[name] ?? fallback ?? "").trim();
  return value;
}

function authHeaderValue(raw) {
  const token = String(raw ?? "").trim();
  if (!token) throw new Error("MISSING_ADMIN_TOKEN");
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

async function getJson(baseUrl, path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: token,
    },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function extractAggregateHandlerSource(routeSource) {
  const marker = 'app.get("/api/v1/reports/customer-dashboard/aggregate", async (req, reply) => {';
  const start = routeSource.indexOf(marker);
  if (start < 0) throw new Error("AGGREGATE_HANDLER_NOT_FOUND");
  const tail = routeSource.slice(start);
  const endMarker = "\n    return reply.send({";
  const end = tail.indexOf(endMarker);
  if (end < 0) throw new Error("AGGREGATE_HANDLER_END_NOT_FOUND");
  return tail.slice(0, end);
}

function runStaticRegressionGuard() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const routePath = path.join(repoRoot, "apps/server/src/routes/reports_dashboard_v1.ts");
  const routeSource = fs.readFileSync(routePath, "utf8");
  const aggregateHandler = extractAggregateHandlerSource(routeSource);

  assert.equal(aggregateHandler.includes("projectReportV1({ pool, tenant"), false, "AGGREGATE_HANDLER_MUST_NOT_CALL_projectReportV1");
  assert.equal(aggregateHandler.includes("projectCustomerDashboardAggregateV1("), false, "AGGREGATE_HANDLER_MUST_NOT_CALL_projectCustomerDashboardAggregateV1");
  assert.equal(aggregateHandler.includes("DASHBOARD_AGGREGATE_REPORT_LIMIT"), false, "AGGREGATE_HANDLER_MUST_NOT_USE_DASHBOARD_AGGREGATE_REPORT_LIMIT");

  return true;
}

async function main() {
  const static_scan_ok = runStaticRegressionGuard();

  const baseUrl = env("BASE_URL", "http://127.0.0.1:3001");
  const adminToken = authHeaderValue(env("ADMIN_TOKEN", "admin_token"));
  const tenantId = env("TENANT_ID", "tenantA");
  const projectId = env("PROJECT_ID", "projectA");
  const groupId = env("GROUP_ID", "groupA");

  const health = await getJson(baseUrl, "/health", adminToken);
  assert.equal(health.status, 200, `HEALTH_STATUS_${health.status}`);

  const aggregatePath = `/api/v1/reports/customer-dashboard/aggregate?tenant_id=${encodeURIComponent(tenantId)}&project_id=${encodeURIComponent(projectId)}&group_id=${encodeURIComponent(groupId)}`;
  const startedAt = Date.now();
  const aggregateRes = await getJson(baseUrl, aggregatePath, adminToken);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(aggregateRes.status, 200, `AGGREGATE_STATUS_${aggregateRes.status}`);
  assert.equal(Boolean(aggregateRes.json?.ok), true, "AGGREGATE_OK_FALSE");

  const aggregate = aggregateRes.json?.aggregate ?? {};
  const hasFields = Boolean(aggregate.fields && typeof aggregate.fields === "object");
  const hasRecentOperations = Array.isArray(aggregate.recent_operations);
  const hasTopRiskFields = Array.isArray(aggregate.top_risk_fields);
  const hasPendingActionsSummary = Boolean(aggregate.pending_actions_summary && typeof aggregate.pending_actions_summary === "object");
  const hasDeviceSummary = Boolean(aggregate.device_summary && typeof aggregate.device_summary === "object");

  assert.equal(hasFields, true, "MISSING_AGGREGATE_FIELDS");
  assert.equal(hasRecentOperations, true, "MISSING_RECENT_OPERATIONS_ARRAY");
  assert.equal(hasTopRiskFields, true, "MISSING_TOP_RISK_FIELDS_ARRAY");
  assert.equal(hasPendingActionsSummary, true, "MISSING_PENDING_ACTIONS_SUMMARY");
  assert.equal(hasDeviceSummary, true, "MISSING_DEVICE_SUMMARY");

  const underFrontendTimeout = elapsedMs < 12000;
  const underTarget3s = elapsedMs < 3000;

  assert.equal(underFrontendTimeout, true, `ELAPSED_TIMEOUT_EXCEEDED:${elapsedMs}`);

  if (!underTarget3s) {
    console.warn(`[perf-warning] aggregate elapsed_ms=${elapsedMs} exceeds suggested 3000ms target`);
  }

  console.log(JSON.stringify({
    customer_dashboard_aggregate_fast_path: {
      health_ok: true,
      aggregate_ok: true,
      elapsed_ms: elapsedMs,
      under_frontend_timeout: underFrontendTimeout,
      under_target_3s: underTarget3s,
      has_fields: hasFields,
      has_recent_operations: hasRecentOperations,
      has_top_risk_fields: hasTopRiskFields,
      has_pending_actions_summary: hasPendingActionsSummary,
      has_device_summary: hasDeviceSummary,
      static_scan_ok,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error("[acceptance-error]", err?.message ?? err);
  process.exitCode = 1;
});
