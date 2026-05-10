#!/usr/bin/env node

const baseUrl = String(process.env.FLIGHT_TABLE_API_BASE || process.env.GEOX_API_BASE || "http://127.0.0.1:3001").replace(/\/+$/, "");
const sessionCredential = String(process.env.GEOX_AO_ACT_TOKEN || process.env.GEOX_TOKEN || "").trim();
const runId = String(process.env.FLIGHT_TABLE_RUN_ID || `ft_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`);
const lane = String(process.env.FLIGHT_TABLE_LANE || "success");
const tenantId = String(process.env.GEOX_TENANT_ID || "tenantA");
const projectId = String(process.env.GEOX_PROJECT_ID || "projectA");
const groupId = String(process.env.GEOX_GROUP_ID || "groupA");

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (sessionCredential) headers.set("Authorization", `Bearer ${sessionCredential}`);
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: res.status, ok: res.ok, body };
}

const created = await request("/api/v1/dev/flight-table/runs", {
  method: "POST",
  body: JSON.stringify({ run_id: runId, tenant_id: tenantId, project_id: projectId, group_id: groupId, lane }),
});
console.log(JSON.stringify({ step: "create", run_id: runId, result: created }, null, 2));

if (!created.ok) process.exit(created.body?.error === "FLIGHT_TABLE_DISABLED" ? 0 : 1);

const verified = await request(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/verify`, {
  method: "POST",
  body: JSON.stringify({}),
});
console.log(JSON.stringify({ step: "verify", run_id: runId, result: verified }, null, 2));

process.exit(verified.ok ? 0 : 1);
