// GEOX/scripts/ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0_RUNNER.cjs
// Sprint 22: AO-ACT multi-tenant hard isolation v0 acceptance runner (Node.js).

"use strict"; // Enforce strict mode for safer JS semantics.

const assert = require("node:assert"); // Node assert for deterministic acceptance checks.
const crypto = require("node:crypto"); // Node crypto for UUID + random hex.
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
    } // End arg parse guard.
  } // End loop.
  return out; // Return parsed args object.
} // End parseArgs.

const args = parseArgs(process.argv); // Parse process argv.
const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Base URL for server under test.
console.log(`[INFO] Sprint22 MultiTenant Isolation acceptance (baseUrl=${baseUrl})`); // Print run header.

const tenantA = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" }; // Tenant A triple.
const tenantB = { tenant_id: "tenantB", project_id: "projectB", group_id: "groupB" }; // Tenant B triple.

const tokenA = String(process.env.GEOX_AO_ACT_TOKEN_A || "dev_ao_act_admin_v0"); // Token bound to tenantA.
const tokenB = String(process.env.GEOX_AO_ACT_TOKEN_B || "dev_ao_act_admin_tenantB_v0"); // Token bound to tenantB.

function buildHeaders(token) { // Build request headers; omit Authorization unless token is non-empty.
  const h = { "content-type": "application/json" }; // Always send JSON content-type.
  if (typeof token === "string" && token.length > 0) { // Only set auth header when token is provided.
    h["authorization"] = `Bearer ${token}`; // Use Bearer scheme expected by server.
  }
  return h; // Return headers.
} // End buildHeaders.

async function fetchJson(url, opts) { // Fetch JSON with optional token and JSON body.
  const method = String(opts.method || "GET"); // HTTP method.
  const token = (opts.token === undefined ? "" : String(opts.token)); // Token string; empty => no auth header.
  const body = (opts.body === undefined ? undefined : JSON.stringify(opts.body)); // JSON body if provided.
  const res = await fetch(url, { method, headers: buildHeaders(token), body }); // Perform fetch.
  const text = await res.text(); // Read response body as text.
  let json = null; // Parsed JSON holder.
  try { json = text.length ? JSON.parse(text) : null; } catch { json = null; } // Best-effort JSON parse.
  return { status: res.status, json, text }; // Return status + parsed json + raw text.
} // End fetchJson.

async function fetchJsonWithRetry(url, inner) { // Retry wrapper for server warm-up / transient failures.
  const attempts = 20; // Max attempts.
  const delayMs = 300; // Delay per attempt in ms.
  let lastErr = null; // Track last error for diagnostics.
  for (let i = 0; i < attempts; i += 1) { // Retry loop.
    try { return await fetchJson(url, inner); } catch (e) { lastErr = e; await sleep(delayMs); } // Retry on error.
  } // End loop.
  throw lastErr || new Error("fetch failed"); // Throw final error.
} // End fetchJsonWithRetry.

function randHex(nBytes) { return crypto.randomBytes(nBytes).toString("hex"); } // Random hex helper.

function joinUrl(base, pathname) { // Safe join for base URL + pathname.
  const u = new URL(base); // Parse base URL.
  u.pathname = pathname; // Set path component.
  return u.toString(); // Return full URL.
} // End joinUrl.

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

function nowMs() { return Date.now(); } // Epoch ms helper.

function buildTaskBody(tenant) { // Build a minimally valid ao_act task body (tenant-scoped).
  const start = nowMs(); // Start time for time_window.
  const end = start + 60_000; // End time for time_window.
  return {
    tenant_id: tenant.tenant_id, // Tenant id required by Sprint 22 contract.
    project_id: tenant.project_id, // Project id required by Sprint 22 contract.
    group_id: tenant.group_id, // Group id required by Sprint 22 contract.
    issuer: { kind: "human", id: "dev", namespace: "local" }, // Issuer identity.
    action_type: "PLOW", // Allowed action_type from v0 allowlist.
    target: { kind: "field", ref: "field:demo" }, // Target reference.
    time_window: { start_ts: start, end_ts: end }, // Desired execution time window.
    parameter_schema: { keys: [ { name: "noop", type: "boolean" } ] }, // Schema for parameters.
    parameters: { noop: true }, // Concrete parameters (primitives only).
    constraints: {}, // Empty constraints.
    meta: { note: "acceptance" } // Arbitrary meta.
  }; // End body.
} // End buildTaskBody.

function buildDeviceRefRecord(factId, tenant) { // Build ao_act_device_ref_v0 record_json for /api/raw ingestion.
  return {
    type: "ao_act_device_ref_v0", // Record type.
    payload: {
      executor_id: { kind: "device", id: "devkit_001", namespace: "local" }, // Producer identity.
      kind: "log_text", // Evidence kind.
      content_type: "text/plain", // MIME type.
      content: `device-log:${randHex(8)}`, // Opaque content.
      sha256: null, // Optional checksum.
      note: "acceptance", // Optional note.
      created_at_ts: nowMs(), // Client timestamp.
      meta: { hint: "pointer-only", tenant_id: tenant.tenant_id, project_id: tenant.project_id, group_id: tenant.group_id } // Tenant-scoped meta for Sprint 22 checks.
    }
  }; // End record.
} // End buildDeviceRefRecord.

function buildRawIngestBody(factId, recordJson) { // Build /api/raw ingestion envelope.
  return {
    fact_id: factId, // Provide deterministic fact_id for reference.
    occurred_at_iso: new Date().toISOString(), // Occurred timestamp.
    source: "device", // Source label.
    record_json: recordJson // Record payload.
  }; // End envelope.
} // End buildRawIngestBody.

function buildReceiptBody(actTaskId, deviceFactId, tenant, idem) { // Build a minimally valid receipt body (tenant-scoped).
  const start = nowMs(); // Start timestamp.
  const end = start + 5_000; // End timestamp.
  return {
    tenant_id: tenant.tenant_id, // Tenant id required by Sprint 22 contract.
    project_id: tenant.project_id, // Project id required by Sprint 22 contract.
    group_id: tenant.group_id, // Group id required by Sprint 22 contract.
    act_task_id: actTaskId, // Referenced act_task_id.
    executor_id: { kind: "script", id: "sim_executor", namespace: "local" }, // Executor identity.
    execution_time: { start_ts: start, end_ts: end }, // Execution time window.
    execution_coverage: { kind: "field", ref: "field:demo" }, // Coverage reference.
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null }, // Resource usage fields.
    logs_refs: [ { kind: "log", ref: `log:acceptance:${randHex(4)}` } ], // Minimal log ref list.
    constraint_check: { violated: false, violations: [] }, // Constraint check results.
    observed_parameters: { noop: true }, // Observed parameters (primitives).
    device_refs: [ { kind: "device_ref_fact", ref: deviceFactId, note: "acceptance" } ], // Evidence pointers.
    meta: { idempotency_key: idem, note: "acceptance" } // Meta includes required idempotency key.
  }; // End receipt body.
} // End buildReceiptBody.

async function main() {
  const rawUrl = joinUrl(baseUrl, "/api/raw"); // Raw ingestion endpoint (append-only).
  const taskUrl = joinUrl(baseUrl, "/api/control/ao_act/task"); // Task endpoint URL.
  const receiptUrl = joinUrl(baseUrl, "/api/control/ao_act/receipt"); // Receipt endpoint URL.

  // Case A1: tokenA writes tenantA task + receipt => PASS.
  const taskA = await fetchJsonWithRetry(taskUrl, { method: "POST", token: tokenA, body: buildTaskBody(tenantA) });
  assert.strictEqual(taskA.status, 200, `tenantA task expected 200, got ${taskA.status} :: ${taskA.text}`);
  const actTaskIdA = String(taskA.json.act_task_id || "");
  assert.ok(actTaskIdA.length > 0, "act_task_id for tenantA must be non-empty");

  const devFactA = crypto.randomUUID(); // Device evidence fact id for tenantA.
  const rawA = await fetchJsonWithRetry(rawUrl, { method: "POST", body: buildRawIngestBody(devFactA, buildDeviceRefRecord(devFactA, tenantA)) });
  assert.strictEqual(rawA.status, 200, `raw ingest tenantA device_ref expected 200, got ${rawA.status} :: ${rawA.text}`);

  const recA = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: tokenA, body: buildReceiptBody(actTaskIdA, devFactA, tenantA, `idem_${randHex(8)}`) });
  assert.strictEqual(recA.status, 200, `tenantA receipt expected 200, got ${recA.status} :: ${recA.text}`);

  // Case A2: tokenA reads tenantB index => FAIL (404).
  const idxB = await fetchJsonWithRetry(joinUrlWithQuery(baseUrl, "/api/control/ao_act/index", tenantB), { method: "GET", token: tokenA });
  assert.strictEqual(idxB.status, 404, `tokenA reading tenantB index expected 404, got ${idxB.status} :: ${idxB.text}`);

  // Case A3: tokenA writes tenantB receipt => FAIL (404).
  const fakeTaskIdB = "act_fake_tenantB"; // Fake task id; tenant mismatch must be rejected before task lookup.
  const recWrong = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: tokenA, body: buildReceiptBody(fakeTaskIdB, devFactA, tenantB, `idem_${randHex(8)}`) });
  assert.strictEqual(recWrong.status, 404, `tokenA writing tenantB receipt expected 404, got ${recWrong.status} :: ${recWrong.text}`);

  // Case B1: tokenB writes tenantB receipt referencing tenantA device_ref => FAIL (404).
  const taskB = await fetchJsonWithRetry(taskUrl, { method: "POST", token: tokenB, body: buildTaskBody(tenantB) });
  assert.strictEqual(taskB.status, 200, `tenantB task expected 200, got ${taskB.status} :: ${taskB.text}`);
  const actTaskIdB = String(taskB.json.act_task_id || "");
  assert.ok(actTaskIdB.length > 0, "act_task_id for tenantB must be non-empty");

  const recCross = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: tokenB, body: buildReceiptBody(actTaskIdB, devFactA, tenantB, `idem_${randHex(8)}`) });
  assert.strictEqual(recCross.status, 404, `tenantB receipt referencing tenantA device_ref expected 404, got ${recCross.status} :: ${recCross.text}`);

  console.log("[OK] Sprint22 MultiTenant Isolation acceptance passed");
} // End main.

main().catch((e) => { // Top-level error handler.
  console.error("[FAIL]", e && e.stack ? e.stack : e); // Print stack for deterministic debugging.
  process.exit(1); // Fail process for CI integration.
});
