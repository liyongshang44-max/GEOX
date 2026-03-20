#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { setTimeout: sleep } = require("node:timers/promises");

function readArg(argv, key) {
  const idx = argv.indexOf(`--${key}`);
  if (idx < 0) return "";
  return String(argv[idx + 1] ?? "").trim();
}

function must(name, fallback = "") {
  const value = String(fallback || process.env[name] || "").trim();
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function resolveToken(argv) {
  const raw = String(
    readArg(argv, "token") ||
      process.env.GEOX_AO_ACT_TOKEN ||
      process.env.GEOX_BEARER_TOKEN ||
      ""
  ).trim();
  if (!raw) throw new Error("MISSING_ENV:GEOX_AO_ACT_TOKEN");
  return raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : raw;
}

async function httpJson(baseUrl, token, path, init) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  return { status: res.status, json, text };
}

async function pickActTaskId(baseUrl, token, tenant_id, project_id, group_id) {
  const query = `tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=50`;
  const res = await httpJson(baseUrl, token, `/api/v1/ao-act/dispatches?${query}`, { method: "GET" });
  assert.equal(res.status, 200, `DISPATCH_LIST_STATUS_${res.status}`);
  assert.equal(res.json?.ok, true, "DISPATCH_LIST_NOT_OK");
  const items = Array.isArray(res.json?.items) ? res.json.items : [];
  const now = Date.now();
  const candidate = items.find((x) => {
    const state = String(x?.state ?? "").toUpperCase();
    const leaseExpireAt = Number(x?.lease_expire_at ?? NaN);
    const receiptFactId = String(x?.receipt_fact_id ?? "").trim();
    const stateAllowed = state === "DISPATCHED" || state === "ACKED";
    return stateAllowed && Number.isFinite(leaseExpireAt) && leaseExpireAt < now && !receiptFactId;
  });
  if (!candidate) throw new Error("NO_EXPIRED_LEASE_TASK_FOUND: need expired lease + no receipt + allowed state");
  return String(candidate.act_task_id ?? "").trim();
}

async function claimOnce(baseUrl, token, body) {
  return httpJson(baseUrl, token, "/api/v1/ao-act/dispatches/claim", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const baseUrl = String(readArg(argv, "baseUrl") || process.env.GEOX_BASE_URL || "http://127.0.0.1:3000").trim();
  const token = resolveToken(argv);
  const tenant_id = must("GEOX_TENANT_ID", readArg(argv, "tenant_id"));
  const project_id = must("GEOX_PROJECT_ID", readArg(argv, "project_id"));
  const group_id = must("GEOX_GROUP_ID", readArg(argv, "group_id"));
  const lease_seconds = Math.max(5, Number.parseInt(readArg(argv, "lease_seconds") || process.env.GEOX_DISPATCH_LEASE_SECONDS || "5", 10) || 5);

  const providedTaskId = String(readArg(argv, "act_task_id") || process.env.GEOX_ACT_TASK_ID || "").trim();
  const act_task_id = providedTaskId || (await pickActTaskId(baseUrl, token, tenant_id, project_id, group_id));
  assert.ok(act_task_id, "MISSING_ACT_TASK_ID");

  const common = { tenant_id, project_id, group_id, limit: 1, lease_seconds, act_task_id };
  const [a, b] = await Promise.all([
    claimOnce(baseUrl, token, { ...common, executor_id: `lease_accept_exec_A_${Date.now()}` }),
    claimOnce(baseUrl, token, { ...common, executor_id: `lease_accept_exec_B_${Date.now()}` })
  ]);

  assert.equal(a.status, 200, `CLAIM_A_STATUS_${a.status}:${a.text}`);
  assert.equal(b.status, 200, `CLAIM_B_STATUS_${b.status}:${b.text}`);
  const aItems = Array.isArray(a.json?.items) ? a.json.items : [];
  const bItems = Array.isArray(b.json?.items) ? b.json.items : [];

  const aHit = aItems.filter((x) => String(x?.act_task_id ?? "") === act_task_id).length;
  const bHit = bItems.filter((x) => String(x?.act_task_id ?? "") === act_task_id).length;
  assert.equal(aHit + bHit, 1, `CLAIM_WINNER_REQUIRED act_task_id=${act_task_id} a=${aHit} b=${bHit}`);

  const claimedItem = [...aItems, ...bItems].find((x) => String(x?.act_task_id ?? "") === act_task_id) || null;
  if (claimedItem) {
    assert.ok(String(claimedItem?.claim_id ?? "").trim().length > 0, "CLAIM_ID_MISSING");
    assert.ok(String(claimedItem?.claimed_by ?? "").trim().length > 0, "CLAIMED_BY_MISSING");
    assert.ok(Number.isFinite(Number(claimedItem?.lease_expire_at)), "LEASE_EXPIRE_AT_MISSING");
  }

  const immediateRetry = await claimOnce(baseUrl, token, { ...common, executor_id: `lease_accept_exec_C_${Date.now()}` });
  assert.equal(immediateRetry.status, 200, `CLAIM_C_STATUS_${immediateRetry.status}:${immediateRetry.text}`);
  const immediateItems = Array.isArray(immediateRetry.json?.items) ? immediateRetry.json.items : [];
  const immediateHit = immediateItems.filter((x) => String(x?.act_task_id ?? "") === act_task_id).length;
  assert.equal(immediateHit, 0, `LEASE_LOCK_BROKEN_BEFORE_EXPIRE act_task_id=${act_task_id}`);

  await sleep(lease_seconds * 1000 + 1800);
  const takeover = await claimOnce(baseUrl, token, { ...common, executor_id: `lease_accept_exec_RECOVER_${Date.now()}` });
  assert.equal(takeover.status, 200, `CLAIM_RECOVER_STATUS_${takeover.status}:${takeover.text}`);
  const takeoverItems = Array.isArray(takeover.json?.items) ? takeover.json.items : [];
  const takeoverItem = takeoverItems.find((x) => String(x?.act_task_id ?? "") === act_task_id) || null;
  if (!takeoverItem) {
    console.error(`[DEBUG] takeover.json=${JSON.stringify(takeover.json ?? null)}`);
  }
  assert.ok(takeoverItem, `LEASE_TAKEOVER_FAILED act_task_id=${act_task_id}`);
  assert.ok(String(takeoverItem?.claimed_by ?? "").includes("lease_accept_exec_RECOVER_"), "TAKEOVER_CLAIMED_BY_MISMATCH");

  console.log(JSON.stringify({
    ok: true,
    act_task_id,
    claim_a_count: aHit,
    claim_b_count: bHit,
    winner: aHit === 1 ? "A" : bHit === 1 ? "B" : "NONE",
    claim_id: claimedItem?.claim_id ?? null,
    claimed_by: claimedItem?.claimed_by ?? null,
    lease_expire_at: claimedItem?.lease_expire_at ?? null,
    takeover_claim_id: takeoverItem?.claim_id ?? null,
    takeover_claimed_by: takeoverItem?.claimed_by ?? null
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err?.stack ?? err?.message ?? err));
  process.exit(1);
});
