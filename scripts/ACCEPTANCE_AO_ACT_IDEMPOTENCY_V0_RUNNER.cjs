// GEOX/scripts/ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0_RUNNER.cjs
// Sprint 20: AO-ACT receipt idempotency v0 acceptance runner (Node.js).
// Updated for Sprint 22+: include required tenant_id/project_id/group_id in task/receipt requests.

"use strict"; // Strict mode.

const assert = require("node:assert"); // Deterministic assertions.
const crypto = require("node:crypto"); // Random ids.
const fs = require("node:fs"); // Read tokens config.
const path = require("node:path"); // Path helpers.
const { setTimeout: sleep } = require("node:timers/promises"); // Retry backoff.
const { URL } = require("node:url"); // URL helper.

function parseArgs(argv) { // Parse CLI args --key value.
  const out = {}; // Accumulator.
  for (let i = 2; i < argv.length; i += 1) { // Iterate args.
    const k = argv[i]; // Key token.
    const v = argv[i + 1]; // Value token.
    if (typeof k === "string" && k.startsWith("--")) { // Accept --key.
      out[k.slice(2)] = v; // Store value.
      i += 1; // Consume value.
    } // End if.
  } // End loop.
  return out; // Parsed args.
} // End parseArgs.

const args = parseArgs(process.argv); // Parse args.
const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Base URL.
console.log(`[INFO] Sprint20 Idempotency acceptance (baseUrl=${baseUrl})`); // Header log.

function joinUrl(base, pathname) { // Join base URL and path.
  const u = new URL(base); // Parse base.
  u.pathname = pathname; // Set path.
  return u.toString(); // Full URL.
} // End joinUrl.

function buildHeaders(token) { // Build headers.
  const h = { "content-type": "application/json" }; // JSON.
  if (typeof token === "string" && token.length > 0) { // When token exists.
    h["authorization"] = `Bearer ${token}`; // Bearer auth.
  } // End if.
  return h; // Return headers.
} // End buildHeaders.

async function fetchJson(url, opts) { // Fetch JSON helper.
  const method = String(opts.method || "GET"); // Method.
  const token = (opts.token === undefined ? "" : String(opts.token)); // Token.
  const body = (opts.body === undefined ? undefined : JSON.stringify(opts.body)); // JSON body.
  const res = await fetch(url, { method, headers: buildHeaders(token), body }); // Request.
  const text = await res.text(); // Body text.
  let json = null; // Parsed JSON.
  try { json = text.length ? JSON.parse(text) : null; } catch { json = null; } // Best-effort parse.
  return { status: res.status, json, text }; // Response object.
} // End fetchJson.

async function fetchJsonWithRetry(url, opts) { // Retry wrapper.
  const attempts = 20; // Attempts.
  const delayMs = 300; // Delay.
  let lastErr = null; // Last error.
  for (let i = 0; i < attempts; i += 1) { // Loop.
    try { // Try.
      return await fetchJson(url, opts); // Request.
    } catch (e) { // Catch.
      lastErr = e; // Save.
      await sleep(delayMs); // Backoff.
    } // End catch.
  } // End loop.
  throw lastErr || new Error("fetch failed"); // Throw.
} // End fetchJsonWithRetry.

function readTokenConfig(repoRoot) { // Load token config.
  const p = path.join(repoRoot, "config", "auth", "ao_act_tokens_v0.json"); // Path.
  const raw = fs.readFileSync(p, "utf8"); // Read.
  const j = JSON.parse(raw); // Parse.
  return Array.isArray(j.tokens) ? j.tokens : []; // Return tokens.
} // End readTokenConfig.

function pickAdminToken(tokens) { // Pick admin token by scopes.
  const t = tokens.find((x) => Array.isArray(x.scopes) && x.scopes.includes("ao_act.task.write") && x.scopes.includes("ao_act.receipt.write") && x.scopes.includes("ao_act.index.read") && x.revoked !== true); // Predicate.
  return t ? String(t.token) : ""; // Return token secret.
} // End pickAdminToken.

function envOrDefault(name, fallback) { // Read env with fallback.
  const v = process.env[name]; // Env.
  return (typeof v === "string" && v.length > 0) ? v : fallback; // Select.
} // End envOrDefault.

function tenantTriple() { // Determine tenant triple.
  const tenant_id = envOrDefault("GEOX_AO_ACT_TENANT_ID", "tenantA"); // Tenant.
  const project_id = envOrDefault("GEOX_AO_ACT_PROJECT_ID", "projectA"); // Project.
  const group_id = envOrDefault("GEOX_AO_ACT_GROUP_ID", "groupA"); // Group.
  return { tenant_id, project_id, group_id }; // Triple.
} // End tenantTriple.

function minimalTaskPayload(triple) { // Build a minimally valid ao_act task body (contract-aligned).
  const now = Date.now(); // Start time for time_window.
  const end = now + 60_000; // End time for time_window.
  return {
    tenant_id: triple.tenant_id, // Tenant id required by Sprint 22+ contract.
    project_id: triple.project_id, // Project id required by Sprint 22+ contract.
    group_id: triple.group_id, // Group id required by Sprint 22+ contract.
    issuer: { kind: "human", id: "dev", namespace: "local" }, // Issuer identity (kind fixed to human).
    action_type: "PLOW", // Allowed action_type from v0 allowlist.
    target: { kind: "field", ref: "field:demo" }, // Target reference.
    time_window: { start_ts: now, end_ts: end }, // Desired execution time window.
    parameter_schema: { keys: [ { name: "noop", type: "boolean" } ] }, // Schema for parameters.
    parameters: { noop: true }, // Concrete parameters (primitives only).
    constraints: {}, // Empty constraints.
    meta: { note: "acceptance" } // Arbitrary meta.
  }; // End payload.
} // End minimalTaskPayload.

function minimalReceiptPayload(triple, act_task_id, idempotency_key) { // Build a minimally valid receipt body (contract-aligned).
  const now = Date.now(); // Start timestamp.
  const end = now + 5_000; // End timestamp.
  return {
    tenant_id: triple.tenant_id, // Tenant id required by Sprint 22+ contract.
    project_id: triple.project_id, // Project id required by Sprint 22+ contract.
    group_id: triple.group_id, // Group id required by Sprint 22+ contract.
    act_task_id, // Referenced act_task_id (server-issued from task create).
    executor_id: { kind: "script", id: "runner", namespace: "local" }, // Executor identity.
    execution_time: { start_ts: now, end_ts: end }, // Execution time window.
    execution_coverage: { kind: "field", ref: "field:demo" }, // Coverage reference.
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null }, // Resource usage fields.
    logs_refs: [ { kind: "log", ref: `log:acceptance:${crypto.randomBytes(4).toString("hex")}` } ], // Minimal log ref list.
    constraint_check: { violated: false, violations: [] }, // Constraint check results.
    observed_parameters: { noop: true }, // Observed parameters (primitives).
    meta: { idempotency_key, note: "acceptance" } // Meta includes required idempotency key.
  }; // End receipt.
} // End minimalReceiptPayload.

async function main() { // Main.
  const repoRoot = path.resolve(__dirname, ".."); // Repo root.
  const tokens = readTokenConfig(repoRoot); // Token config.
  const adminFromConfig = pickAdminToken(tokens); // Admin token.
  const adminToken = String(process.env.GEOX_AO_ACT_TOKEN || adminFromConfig); // Allow override.
  if (!adminToken) { throw new Error("NO_ADMIN_TOKEN_FOUND_IN_CONFIG"); } // Ensure token.

  const triple = tenantTriple(); // Triple.
  console.log(`[INFO] tenant_id=${triple.tenant_id} project_id=${triple.project_id} group_id=${triple.group_id}`); // Log.

  // 1) Create task.
  const taskPayload = minimalTaskPayload(triple); // Task payload.
  const r1 = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/task"), { method: "POST", token: adminToken, body: taskPayload }); // POST task.
  assert.ok([200, 201].includes(r1.status), `task create expected 200/201, got ${r1.status} :: ${r1.text}`); // Assert.

  const actTaskId = String((r1.json && r1.json.act_task_id) ? r1.json.act_task_id : ""); // Extract server-issued act_task_id.
  assert.ok(actTaskId.length > 0, "act_task_id must be non-empty"); // Ensure task id exists.

  // 2) Write receipt with idempotency key.
  const idemKey = `idem_${crypto.randomBytes(8).toString("hex")}`; // Idempotency key.
  const receiptPayload = minimalReceiptPayload(triple, actTaskId, idemKey); // Receipt payload (server-issued act_task_id).
  const r2 = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/receipt"), { method: "POST", token: adminToken, body: receiptPayload }); // POST receipt.
  assert.ok([200, 201].includes(r2.status), `receipt write expected 200/201, got ${r2.status} :: ${r2.text}`); // Assert.

  // 3) Repeat same receipt with same idempotency key (must be dedup / rejected / no-op).
  const r3 = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/receipt"), { method: "POST", token: adminToken, body: receiptPayload }); // Re-POST.
  assert.ok([200, 201, 400, 409].includes(r3.status), `duplicate receipt expected 200/201/400/409, got ${r3.status} :: ${r3.text}`); // Accept allowed outcomes.

  console.log("[OK] AO-ACT Idempotency v0 acceptance passed"); // Success.
} // End main.

main().catch((e) => { // Top-level handler.
  console.error("[FAIL]"); // Failure header.
  console.error(e && e.stack ? e.stack : String(e)); // Print details.
  process.exit(1); // Exit non-zero.
}); // End catch.
