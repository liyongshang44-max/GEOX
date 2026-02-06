// GEOX/scripts/ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0_RUNNER.cjs
// Sprint 21: AO-ACT Device Adapter (L2) v0 acceptance runner (Node.js).

"use strict"; // Enforce strict mode for safer JS semantics.

const assert = require("node:assert"); // Node assert for deterministic acceptance checks.
const crypto = require("node:crypto"); // Node crypto for random ids.
const { setTimeout: sleep } = require("node:timers/promises"); // Sleep helper for retry backoff.
const { URL } = require("node:url"); // URL helper for safe URL concatenation.

function parseArgs(argv) { // Parse CLI args of form --key value.
  const out = {}; // Accumulate parsed args.
  for (let i = 2; i < argv.length; i += 1) { // Iterate argv, skipping node + script.
    const k = argv[i]; // Current token.
    const v = argv[i + 1]; // Next token as value.
    if (typeof k === "string" && k.startsWith("--")) { // Only accept --key tokens.
      out[k.slice(2)] = v; // Store without leading dashes.
      i += 1; // Consume value token.
    }
  }
  return out; // Return parsed args object.
}

const args = parseArgs(process.argv); // Parse process argv.
const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Base URL for server under test.
console.log(`[INFO] Sprint21 Device Adapter acceptance (baseUrl=${baseUrl})`); // Print run header.

const tenantA = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" }; // Sprint 22: default tenant triple for acceptance.

const adminToken = String(process.env.GEOX_AO_ACT_TOKEN || "dev_ao_act_admin_v0"); // Token with ao_act.task.write + ao_act.receipt.write.

function buildHeaders(token) { // Build request headers; omit Authorization unless token is non-empty.
  const h = { "content-type": "application/json" }; // Always send JSON content-type.
  if (typeof token === "string" && token.length > 0) { // Only set auth header when token is provided.
    h["authorization"] = `Bearer ${token}`; // Use Bearer scheme expected by server.
  }
  return h; // Return headers.
}

async function fetchJson(url, opts) { // Fetch JSON with optional token and JSON body.
  const method = String(opts.method || "GET"); // HTTP method.
  const token = (opts.token === undefined ? "" : String(opts.token)); // Token string; empty => no auth header.
  const body = (opts.body === undefined ? undefined : JSON.stringify(opts.body)); // JSON body if provided.
  const res = await fetch(url, { method, headers: buildHeaders(token), body }); // Perform fetch.
  const text = await res.text(); // Read response body as text.
  let json = null; // Parsed JSON holder.
  try { json = text.length ? JSON.parse(text) : null; } catch { json = null; } // Best-effort JSON parse.
  return { status: res.status, json, text }; // Return status + parsed json + raw text.
}

async function fetchJsonWithRetry(url, inner) { // Retry wrapper for server warm-up / transient failures.
  const attempts = 20; // Max attempts.
  const delayMs = 300; // Delay per attempt in ms.
  let lastErr = null; // Track last error for diagnostics.
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url, inner);
    } catch (e) {
      lastErr = e;
      await sleep(delayMs);
    }
  }
  throw lastErr || new Error("fetch failed");
}

function nowMs() { return Date.now(); } // Epoch ms helper.
function randHex(nBytes) { return crypto.randomBytes(nBytes).toString("hex"); } // Random hex.
function joinUrl(base, pathname) { const u = new URL(base); u.pathname = pathname; return u.toString(); } // Safe url join.

function joinUrlWithQuery(base, pathname, query) { // Join base URL + path + query object safely.
  const u = new URL(base); // Parse base URL.
  u.pathname = pathname; // Set path component.
  const q = query || {}; // Default query object.
  for (const [k, v] of Object.entries(q)) { // Iterate query pairs.
    if (v === undefined || v === null) continue; // Skip undefined/null values.
    u.searchParams.set(String(k), String(v)); // Set query param.
  } // End loop.
  return u.toString(); // Return full URL string.
} // End joinUrlWithQuery.

async function snapshotNoSideEffectState(base) { // Snapshot read-only state that must not change due to AO-ACT writes.
  const judgeUrl = joinUrlWithQuery(base, "/api/judge/problem_states", { limit: 500 }); // Judge persisted problem_state list.
  const agrUrl = joinUrlWithQuery(base, "/api/agronomy/interpretation_v1/explain", { groupId: "local", limit: 20 }); // Agronomy interpretations list.
  const j = await fetchJsonWithRetry(judgeUrl, { method: "GET" }); // Fetch judge snapshot.
  assert.strictEqual(j.status, 200, `judge snapshot expected 200, got ${j.status} :: ${j.text}`); // Must succeed.
  const a = await fetchJsonWithRetry(agrUrl, { method: "GET" }); // Fetch agronomy snapshot.
  assert.strictEqual(a.status, 200, `agronomy snapshot expected 200, got ${a.status} :: ${a.text}`); // Must succeed.
  return { judge_text: String(j.text), agronomy_text: String(a.text) }; // Return raw texts for stable compare.
} // End snapshotNoSideEffectState.

function buildTaskBody() { // Build a minimally valid ao_act task body.
  const start = nowMs();
  const end = start + 60_000;
  return {
    tenant_id: tenantA.tenant_id,
    project_id: tenantA.project_id,
    group_id: tenantA.group_id,
    issuer: { kind: "human", id: "dev", namespace: "local" },
    action_type: "PLOW",
    target: { kind: "field", ref: "field:demo" },
    time_window: { start_ts: start, end_ts: end },
    parameter_schema: { keys: [ { name: "noop", type: "boolean" } ] },
    parameters: { noop: true },
    constraints: {},
    meta: { note: "acceptance" },
  };
}

function buildDeviceRefRecord(factId) { // Build ao_act_device_ref_v0 record_json.
  return {
    type: "ao_act_device_ref_v0",
    payload: {
      executor_id: { kind: "device", id: "devkit_001", namespace: "local" },
      kind: "log_text",
      content_type: "text/plain",
      content: `device-log:${randHex(8)}`,
      sha256: null,
      note: "acceptance",
      created_at_ts: nowMs(),
      meta: { hint: "pointer-only", tenant_id: tenantA.tenant_id, project_id: tenantA.project_id, group_id: tenantA.group_id },
    },
    _acceptance_fact_id: factId, // Not part of schema; used only by runner logic (not sent to server).
  };
}

function buildRawIngestBody(factId, recordJson) { // Build /api/raw ingestion envelope.
  return {
    fact_id: factId,
    occurred_at_iso: new Date().toISOString(),
    source: "device",
    record_json: recordJson,
  };
}

function buildReceiptBody(actTaskId, deviceFactId, meta) { // Build a minimally valid receipt with device_refs.
  const start = nowMs();
  const end = start + 5_000;
  return {
    tenant_id: tenantA.tenant_id,
    project_id: tenantA.project_id,
    group_id: tenantA.group_id,
    act_task_id: actTaskId,
    executor_id: { kind: "script", id: "sim_executor", namespace: "local" },
    execution_time: { start_ts: start, end_ts: end },
    execution_coverage: { kind: "field", ref: "field:demo" },
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null },
    logs_refs: [ { kind: "log", ref: `log:acceptance:${randHex(4)}` } ],
    constraint_check: { violated: false, violations: [] },
    observed_parameters: { noop: true },
    device_refs: [ { kind: "device_ref_fact", ref: deviceFactId, note: "acceptance" } ],
    meta: meta,
  };
}

async function main() {
    const snapBefore = await snapshotNoSideEffectState(baseUrl); // Capture pre-run snapshot (negative acceptance).
const rawUrl = joinUrl(baseUrl, "/api/raw");
  const taskUrl = joinUrl(baseUrl, "/api/control/ao_act/task");
  const receiptUrl = joinUrl(baseUrl, "/api/control/ao_act/receipt");

  // Step 0: ingest a device_ref fact via generic /api/raw (append-only).
  const deviceFactId = crypto.randomUUID();
  const deviceRecord = buildDeviceRefRecord(deviceFactId);
  const rawBody = buildRawIngestBody(deviceFactId, { type: deviceRecord.type, payload: deviceRecord.payload });
  const rawRes = await fetchJsonWithRetry(rawUrl, { method: "POST", body: rawBody });
  assert.strictEqual(rawRes.status, 200, `raw ingest expected 200, got ${rawRes.status} :: ${rawRes.text}`);
  assert.ok(rawRes.json && rawRes.json.ok === true, "raw ingest must return ok:true");

  // Step 1: create a task.
  const taskBody = buildTaskBody();
  const t = await fetchJsonWithRetry(taskUrl, { method: "POST", token: adminToken, body: taskBody });
  assert.strictEqual(t.status, 200, `task create expected 200, got ${t.status} :: ${t.text}`);
  assert.ok(t.json && t.json.ok === true, "task response must be ok:true");
  const actTaskId = String(t.json.act_task_id);
  assert.ok(actTaskId.length > 0, "act_task_id must be non-empty");

  // Case 1: receipt referencing existing device_ref fact => 200.
  const idem = `idem_${randHex(8)}`;
  const r1Body = buildReceiptBody(actTaskId, deviceFactId, { idempotency_key: idem, note: "device_ref_ok" });
  const r1 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r1Body });
  assert.strictEqual(r1.status, 200, `receipt with device_ref expected 200, got ${r1.status} :: ${r1.text}`);
  assert.ok(r1.json && r1.json.ok === true, "receipt with device_ref must return ok:true");

  // Case 2: receipt referencing missing device_ref fact => 400 DEVICE_REF_NOT_FOUND.
  const missing = crypto.randomUUID();
  const idem2 = `idem_${randHex(8)}`;
  const r2Body = buildReceiptBody(actTaskId, missing, { idempotency_key: idem2, note: "device_ref_missing" });
  const r2 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r2Body });
  assert.strictEqual(r2.status, 400, `missing device_ref expected 400, got ${r2.status} :: ${r2.text}`);
  assert.ok(r2.json && String(r2.json.error || "").startsWith("DEVICE_REF_NOT_FOUND"), "must return DEVICE_REF_NOT_FOUND:*" );
  const snapAfter = await snapshotNoSideEffectState(baseUrl); // Capture post-run snapshot (negative acceptance).
  assert.strictEqual(snapAfter.judge_text, snapBefore.judge_text, "Judge persisted problem_states must not change as side-effect of AO-ACT write"); // Enforce zero-coupling.
  assert.strictEqual(snapAfter.agronomy_text, snapBefore.agronomy_text, "Agronomy interpretation facts must not change as side-effect of AO-ACT write"); // Enforce zero-coupling.

  console.log("[OK] Sprint21 AO-ACT Device Adapter acceptance passed");
}

main().catch((e) => {
  console.error("[FAIL]", e && e.stack ? e.stack : e);
  process.exit(1);
});
