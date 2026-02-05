// GEOX/scripts/ACCEPTANCE_AO_ACT_AUTHZ_V0_RUNNER.cjs
// Sprint 19: AO-ACT AuthZ v0 acceptance runner (Node.js).

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
console.log(`[INFO] Sprint19 AuthZ acceptance (baseUrl=${baseUrl})`); // Print run header.

// Token fixtures (must match config/auth/ao_act_tokens_v0.json).
const adminToken = String(process.env.GEOX_AO_ACT_TOKEN || "dev_ao_act_admin_v0"); // Token with all scopes.
const taskOnlyToken = "dev_ao_act_task_only_v0"; // Token missing receipt.write scope.
const invalidToken = "dev_ao_act_invalid_token_v0"; // Unknown token to trigger AUTH_INVALID.

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

function randId(prefix) { // Create random id string.
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`; // Prefix + 32 hex chars.
} // End randId.

function joinUrl(base, pathname) { // Join base URL + path safely.
  const u = new URL(base); // Parse base.
  u.pathname = pathname; // Set path (overwrites).
  return u.toString(); // Return full URL string.
} // End joinUrl.

function buildTaskBody() { // Build a minimally valid ao_act task body (matches server zod schema).
  const start = nowMs(); // Start ts.
  const end = start + 60_000; // End ts (+60s).
  const actTaskId = randId("act"); // Unique act_task_id.
  return { // Return task body (NOT wrapped in {type,payload}; endpoint expects body fields directly).
    issuer: { kind: "human", id: "dev", namespace: "local" }, // Required issuer.
    action_type: "PLOW", // Use an allowlisted action_type to avoid ACTION_TYPE_NOT_ALLOWED.
    target: { kind: "field", ref: "field:demo" }, // Minimal target.
    time_window: { start_ts: start, end_ts: end }, // Required time window.
    parameter_schema: { keys: [ { name: "noop", type: "boolean" } ] }, // Minimal schema.
    parameters: { noop: true }, // Params map.
    constraints: {}, // Constraints map (keep empty to avoid enum-schema coupling).
    meta: { act_task_id: actTaskId }, // Carry act_task_id in meta for test linkage (server generates its own act_task_id anyway).
  }; // End task body.
} // End buildTaskBody.

function buildReceiptBody(actTaskId) { // Build a minimally valid receipt body.
  const start = nowMs(); // Start ts.
  const end = start + 5_000; // End ts.
  return { // Receipt body expected by server contract.
    act_task_id: actTaskId, // Link to task id returned by server.
    executor_id: { kind: "script", id: "sim_executor", namespace: "local" }, // Executor id ref (contract enum: human|script|device).
    execution_time: { start_ts: start, end_ts: end }, // Execution time.
    execution_coverage: { kind: "field", ref: "field:demo" }, // Coverage.
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null }, // Required keys (nullable).
    logs_refs: [ { kind: "log", ref: "log:acceptance" } ], // Logs refs.
    constraint_check: { violated: false, violations: [] }, // Constraint check.
    observed_parameters: { noop: true }, // Observed params.
    meta: { note: "acceptance" }, // Optional meta.
  }; // End receipt body.
} // End buildReceiptBody.

async function main() { // Main acceptance entrypoint.
  const taskUrl = joinUrl(baseUrl, "/api/control/ao_act/task"); // Task endpoint URL.
  const receiptUrl = joinUrl(baseUrl, "/api/control/ao_act/receipt"); // Receipt endpoint URL.
  const indexUrl = joinUrl(baseUrl, "/api/control/ao_act/index"); // Index endpoint URL.

  const taskBody = buildTaskBody(); // Build task body.

  // Case 1: Missing token -> 401 AUTH_MISSING (must short-circuit before validation).
  const r0 = await fetchJsonWithRetry(taskUrl, { method: "POST", body: taskBody, token: "" }); // No auth header.
  assert.strictEqual(r0.status, 401, `expected 401 AUTH_MISSING, got status=${r0.status} body=${r0.text}`); // Status check.
  assert.strictEqual(r0.json?.error, "AUTH_MISSING", `expected AUTH_MISSING, got ${r0.text}`); // Error code check.

  // Case 2: Invalid token -> 401 AUTH_INVALID.
  const r1 = await fetchJsonWithRetry(taskUrl, { method: "POST", body: taskBody, token: invalidToken }); // Unknown token.
  assert.strictEqual(r1.status, 401, `expected 401 AUTH_INVALID, got status=${r1.status} body=${r1.text}`); // Status check.
  assert.strictEqual(r1.json?.error, "AUTH_INVALID", `expected AUTH_INVALID, got ${r1.text}`); // Error code check.

  // Case 3: Admin token can write task -> 200.
  const r2 = await fetchJsonWithRetry(taskUrl, { method: "POST", body: taskBody, token: adminToken }); // Admin token.
  assert.strictEqual(r2.status, 200, `expected 200, got status=${r2.status} body=${r2.text}`); // Status check.
  assert.strictEqual(Boolean(r2.json?.ok), true, `expected ok=true, got ${r2.text}`); // ok check.
  assert.strictEqual(typeof r2.json?.act_task_id, "string", `expected act_task_id, got ${r2.text}`); // act_task_id exists.
  const actTaskId = r2.json.act_task_id; // Use server-returned task id.

  // Case 4: task-only token cannot write receipt -> 403 AUTH_SCOPE_DENIED.
  const receiptBody = buildReceiptBody(actTaskId); // Build receipt body.
  const r3 = await fetchJsonWithRetry(receiptUrl, { method: "POST", body: receiptBody, token: taskOnlyToken }); // Insufficient scope.
  assert.strictEqual(r3.status, 403, `expected 403 AUTH_SCOPE_DENIED, got status=${r3.status} body=${r3.text}`); // Status check.
  assert.strictEqual(r3.json?.error, "AUTH_SCOPE_DENIED", `expected AUTH_SCOPE_DENIED, got ${r3.text}`); // Error code check.

  // Case 5: Admin token can write receipt -> 200.
  const r4 = await fetchJsonWithRetry(receiptUrl, { method: "POST", body: receiptBody, token: adminToken }); // Admin token.
  assert.strictEqual(r4.status, 200, `expected 200, got status=${r4.status} body=${r4.text}`); // Status check.
  assert.strictEqual(Boolean(r4.json?.ok), true, `expected ok=true, got ${r4.text}`); // ok check.

  // Case 6: task-only token can read index -> 200.
  const r5 = await fetchJsonWithRetry(indexUrl, { method: "GET", token: taskOnlyToken }); // Read index.
  assert.strictEqual(r5.status, 200, `expected 200, got status=${r5.status} body=${r5.text}`); // Status check.
  assert.strictEqual(Boolean(r5.json?.ok), true, `expected ok=true, got ${r5.text}`); // ok check.

  console.log("[PASS] Sprint19 AuthZ acceptance passed"); // Success log.
} // End main.

main().catch((e) => { // Top-level error handler.
  console.error("[FAIL] Sprint19 AuthZ acceptance failed"); // Failure header.
  console.error(e); // Print error object.
  process.exit(13); // Non-zero exit for acceptance harness.
}); // End catch.
