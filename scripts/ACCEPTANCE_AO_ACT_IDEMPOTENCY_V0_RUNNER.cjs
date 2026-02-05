// GEOX/scripts/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0_RUNNER.cjs
// Sprint 20: AO-ACT receipt idempotency v0 acceptance runner (Node.js).

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
    } // End if.
  } // End loop.
  return out; // Return parsed args object.
} // End parseArgs.

const args = parseArgs(process.argv); // Parse process argv.
const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Base URL for server under test.
console.log(`[INFO] Sprint20 Idempotency acceptance (baseUrl=${baseUrl})`); // Print run header.

const adminToken = String(process.env.GEOX_AO_ACT_TOKEN || "dev_ao_act_admin_v0"); // Token with ao_act.task.write + ao_act.receipt.write.

function buildHeaders(token) { // Build request headers; omit Authorization unless token is non-empty.
  const h = { "content-type": "application/json" }; // Always send JSON content-type.
  if (typeof token === "string" && token.length > 0) { // Only set auth header when token is provided.
    h["authorization"] = `Bearer ${token}`; // Use Bearer scheme expected by server.
  } // End if.
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
  for (let i = 0; i < attempts; i += 1) { // Attempt loop.
    try { // Try block for fetch.
      return await fetchJson(url, inner); // Attempt request and return on success.
    } catch (e) { // Catch network errors (e.g., ECONNREFUSED).
      lastErr = e; // Save error.
      await sleep(delayMs); // Wait before retry.
    } // End catch.
  } // End loop.
  throw lastErr || new Error("fetch failed"); // Throw last error after exhausting retries.
} // End fetchJsonWithRetry.

function nowMs() { // Get current epoch ms.
  return Date.now(); // Return current ms.
} // End nowMs.

function randHex(nBytes) { // Generate random hex string.
  return crypto.randomBytes(nBytes).toString("hex"); // Convert random bytes to hex.
} // End randHex.

function joinUrl(base, pathname) { // Join base URL + path safely.
  const u = new URL(base); // Parse base.
  u.pathname = pathname; // Set path (overwrites).
  return u.toString(); // Return full URL string.
} // End joinUrl.

function buildTaskBody() { // Build a minimally valid ao_act task body (matches server zod schema).
  const start = nowMs(); // Start ts.
  const end = start + 60_000; // End ts (+60s).
  return { // Return task body (endpoint expects body fields directly).
    issuer: { kind: "human", id: "dev", namespace: "local" }, // Required issuer.
    action_type: "PLOW", // Use an allowlisted action_type.
    target: { kind: "field", ref: "field:demo" }, // Minimal target.
    time_window: { start_ts: start, end_ts: end }, // Required time window.
    parameter_schema: { keys: [ { name: "noop", type: "boolean" } ] }, // Minimal schema.
    parameters: { noop: true }, // Params map.
    constraints: {}, // Constraints map.
    meta: { note: "acceptance" }, // Optional meta.
  }; // End task body.
} // End buildTaskBody.

function buildReceiptBody(actTaskId, meta) { // Build a minimally valid receipt body.
  const start = nowMs(); // Start ts.
  const end = start + 5_000; // End ts.
  return { // Receipt body expected by server contract.
    act_task_id: actTaskId, // Link to task id returned by server.
    executor_id: { kind: "script", id: "sim_executor", namespace: "local" }, // Executor id ref.
    execution_time: { start_ts: start, end_ts: end }, // Execution time.
    execution_coverage: { kind: "field", ref: "field:demo" }, // Coverage.
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null }, // Required keys (nullable).
    logs_refs: [ { kind: "log", ref: `log:acceptance:${randHex(4)}` } ], // Logs refs.
    constraint_check: { violated: false, violations: [] }, // Constraint check.
    observed_parameters: { noop: true }, // Observed params (must match task schema).
    meta: meta, // Meta container (used to carry idempotency key).
  }; // End receipt body.
} // End buildReceiptBody.

async function main() { // Main acceptance entrypoint.
  const taskUrl = joinUrl(baseUrl, "/api/control/ao_act/task"); // Task endpoint URL.
  const receiptUrl = joinUrl(baseUrl, "/api/control/ao_act/receipt"); // Receipt endpoint URL.

  // Step 1: create a task.
  const taskBody = buildTaskBody(); // Build task body.
  const t = await fetchJsonWithRetry(taskUrl, { method: "POST", token: adminToken, body: taskBody }); // Create task.
  assert.strictEqual(t.status, 200, `task create expected 200, got ${t.status} :: ${t.text}`); // Must succeed.
  assert.ok(t.json && t.json.ok === true, "task response must be ok:true"); // Enforce ok=true.
  const actTaskId = String(t.json.act_task_id); // Extract generated act_task_id.
  assert.ok(actTaskId.length > 0, "act_task_id must be non-empty"); // Validate act_task_id.

  // Case 1: missing idempotency key => 400 IDEMPOTENCY_KEY_REQUIRED.
  const r1Body = buildReceiptBody(actTaskId, { note: "missing_key" }); // Receipt meta lacks idempotency_key.
  const r1 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r1Body }); // Attempt write.
  assert.strictEqual(r1.status, 400, `missing key expected 400, got ${r1.status} :: ${r1.text}`); // Must reject.
  assert.ok(r1.json && r1.json.error === "IDEMPOTENCY_KEY_REQUIRED", "must return IDEMPOTENCY_KEY_REQUIRED"); // Validate error code.

  // Case 2: first write with key => 200.
  const idem = `idem_${randHex(8)}`; // Generate idempotency key.
  const r2Body = buildReceiptBody(actTaskId, { idempotency_key: idem, note: "first_write" }); // Include key.
  const r2 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r2Body }); // Write receipt.
  assert.strictEqual(r2.status, 200, `first write expected 200, got ${r2.status} :: ${r2.text}`); // Must succeed.
  assert.ok(r2.json && r2.json.ok === true, "first write must return ok:true"); // Validate ok.
  const firstFactId = String(r2.json.fact_id); // Capture fact id.
  assert.ok(firstFactId.length > 0, "fact_id must be non-empty"); // Validate fact id.

  // Case 3: retry with same key => 409 DUPLICATE_RECEIPT with existing_fact_id.
  const r3Body = buildReceiptBody(actTaskId, { idempotency_key: idem, note: "retry_same_key" }); // Same key.
  const r3 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r3Body }); // Retry write.
  assert.strictEqual(r3.status, 409, `duplicate expected 409, got ${r3.status} :: ${r3.text}`); // Must reject.
  assert.ok(r3.json && r3.json.error === "DUPLICATE_RECEIPT", "must return DUPLICATE_RECEIPT"); // Validate error code.
  assert.ok(String(r3.json.existing_fact_id || "").length > 0, "existing_fact_id must be present"); // Must provide existing fact.

  // Case 4: write with different key => 200 (allowed as separate receipt).
  const idem2 = `idem_${randHex(8)}`; // Generate a second idempotency key.
  const r4Body = buildReceiptBody(actTaskId, { idempotency_key: idem2, note: "different_key" }); // Different key.
  const r4 = await fetchJsonWithRetry(receiptUrl, { method: "POST", token: adminToken, body: r4Body }); // Write again.
  assert.strictEqual(r4.status, 200, `different key expected 200, got ${r4.status} :: ${r4.text}`); // Must succeed.
  assert.ok(r4.json && r4.json.ok === true, "different key must return ok:true"); // Validate ok.

  console.log("[OK] Sprint20 AO-ACT receipt idempotency acceptance passed"); // Print success.
} // End main.

main().catch((e) => { // Top-level error handler.
  console.error("[FAIL]", e && e.stack ? e.stack : e); // Print stack.
  process.exit(1); // Exit non-zero.
}); // End error handler.
