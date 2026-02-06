// GEOX/scripts/ACCEPTANCE_AO_ACT_AUTHZ_V0_RUNNER.cjs
// Sprint 19: AO-ACT AuthZ v0 acceptance runner (Node.js).
// Updated for Sprint 22+: include required tenant_id/project_id/group_id in task/index requests.

"use strict"; // Strict mode for safer JS semantics.

const assert = require("node:assert"); // Deterministic acceptance assertions.
const crypto = require("node:crypto"); // Random ids for unique task ids.
const fs = require("node:fs"); // Read token config from disk.
const path = require("node:path"); // Resolve token config path.
const { setTimeout: sleep } = require("node:timers/promises"); // Retry backoff helper.
const { URL } = require("node:url"); // Safe URL joins.

function parseArgs(argv) { // Parse CLI args of form --key value.
  const out = {}; // Parsed args accumulator.
  for (let i = 2; i < argv.length; i += 1) { // Skip node + script.
    const k = argv[i]; // Current arg token.
    const v = argv[i + 1]; // Next token as value.
    if (typeof k === "string" && k.startsWith("--")) { // Only accept --key.
      out[k.slice(2)] = v; // Store value.
      i += 1; // Consume value.
    } // End if.
  } // End loop.
  return out; // Return parsed args.
} // End parseArgs.

const args = parseArgs(process.argv); // Parse process args.
const baseUrl = String(args.baseUrl || "http://127.0.0.1:3000"); // Server base URL.
console.log(`[INFO] Sprint19 AuthZ acceptance (baseUrl=${baseUrl})`); // Header log.

function joinUrl(base, pathname) { // Join base URL + path.
  const u = new URL(base); // Parse base URL.
  u.pathname = pathname; // Overwrite path.
  return u.toString(); // Full URL.
} // End joinUrl.

function buildHeaders(token) { // Build request headers.
  const h = { "content-type": "application/json" }; // Always JSON.
  if (typeof token === "string" && token.length > 0) { // Only set auth when token provided.
    h["authorization"] = `Bearer ${token}`; // Bearer auth as used by AO-ACT.
  } // End if.
  return h; // Return headers.
} // End buildHeaders.

async function fetchJson(url, opts) { // Fetch JSON with best-effort parse.
  const method = String(opts.method || "GET"); // HTTP method.
  const token = (opts.token === undefined ? "" : String(opts.token)); // Token string.
  const body = (opts.body === undefined ? undefined : JSON.stringify(opts.body)); // JSON body.
  const res = await fetch(url, { method, headers: buildHeaders(token), body }); // Execute request.
  const text = await res.text(); // Read body text.
  let json = null; // Parsed JSON holder.
  try { json = text.length ? JSON.parse(text) : null; } catch { json = null; } // Best-effort parse.
  return { status: res.status, json, text }; // Return structured response.
} // End fetchJson.

async function fetchJsonWithRetry(url, opts) { // Retry wrapper for warm-up.
  const attempts = 20; // Retry attempts.
  const delayMs = 300; // Delay per attempt.
  let lastErr = null; // Keep last error.
  for (let i = 0; i < attempts; i += 1) { // Attempt loop.
    try { // Try request.
      return await fetchJson(url, opts); // Return on success.
    } catch (e) { // Catch network errors.
      lastErr = e; // Save error.
      await sleep(delayMs); // Backoff.
    } // End catch.
  } // End loop.
  throw lastErr || new Error("fetch failed"); // Throw final error.
} // End fetchJsonWithRetry.

function readTokenConfig(repoRoot) { // Load tokens config JSON.
  const p = path.join(repoRoot, "config", "auth", "ao_act_tokens_v0.json"); // Config path.
  const raw = fs.readFileSync(p, "utf8"); // Read file text.
  const j = JSON.parse(raw); // Parse JSON.
  const tokens = Array.isArray(j.tokens) ? j.tokens : []; // Extract tokens array.
  return { path: p, tokens }; // Return parsed tokens.
} // End readTokenConfig.

function pickTokens(tokens) { // Pick admin + task-only tokens by scopes.
  const byScopes = (wantAll, wantAny, forbidAny) => { // Helper predicate builder.
    return (t) => { // Predicate over token object.
      const scopes = Array.isArray(t.scopes) ? t.scopes : []; // Normalize scopes.
      const hasAll = wantAll.every((s) => scopes.includes(s)); // Require all scopes.
      const hasAny = wantAny.length === 0 ? true : wantAny.some((s) => scopes.includes(s)); // Require any.
      const hasForbidden = forbidAny.some((s) => scopes.includes(s)); // Forbid list.
      return Boolean(t && t.token && hasAll && hasAny && !hasForbidden && t.revoked !== true); // Final predicate.
    }; // End predicate.
  }; // End helper.

  const admin = tokens.find(byScopes(["ao_act.task.write", "ao_act.receipt.write", "ao_act.index.read"], [], [])); // Full token.
  const taskOnly = tokens.find(byScopes(["ao_act.task.write", "ao_act.index.read"], [], ["ao_act.receipt.write"])); // Missing receipt.write.
  const invalid = `invalid_${crypto.randomBytes(8).toString("hex")}`; // Unknown token for 401 path.
  return { adminToken: admin ? String(admin.token) : "", taskOnlyToken: taskOnly ? String(taskOnly.token) : "", invalidToken: invalid }; // Return picks.
} // End pickTokens.

function envOrDefault(name, fallback) { // Read env var with fallback.
  const v = process.env[name]; // Env read.
  return (typeof v === "string" && v.length > 0) ? v : fallback; // Choose value.
} // End envOrDefault.

function tenantTriple() { // Determine tenant triple for requests.
  const tenant_id = envOrDefault("GEOX_AO_ACT_TENANT_ID", "tenantA"); // Default tenant id.
  const project_id = envOrDefault("GEOX_AO_ACT_PROJECT_ID", "projectA"); // Default project id.
  const group_id = envOrDefault("GEOX_AO_ACT_GROUP_ID", "groupA"); // Default group id.
  return { tenant_id, project_id, group_id }; // Return triple.
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

async function main() { // Main entry.
  const repoRoot = path.resolve(__dirname, ".."); // Repo root as scripts/.. (works in repo + delivery bundle).
  const { tokens } = readTokenConfig(repoRoot); // Load token config.
  const picks = pickTokens(tokens); // Pick tokens by scope.
  const adminToken = String(process.env.GEOX_AO_ACT_TOKEN || picks.adminToken); // Allow explicit override.
  const taskOnlyToken = String(process.env.GEOX_AO_ACT_TOKEN_TASK_ONLY || picks.taskOnlyToken || adminToken); // Optional override.
  const invalidToken = picks.invalidToken; // Unknown token for negative test.

  if (!adminToken) { // Enforce at least one usable token exists.
    throw new Error("NO_ADMIN_TOKEN_FOUND_IN_CONFIG"); // Fail fast with clear reason.
  } // End if.

  const triple = tenantTriple(); // Determine tenant triple.
  console.log(`[INFO] tenant_id=${triple.tenant_id} project_id=${triple.project_id} group_id=${triple.group_id}`); // Log triple.

  // 0) No token -> 401 for index (AuthZ gate). 
  {
    const r = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/index"), { method: "GET" }); // No token header.
    assert.strictEqual(r.status, 401, `expected 401 without token, got ${r.status} body=${r.text}`); // Assert 401.
  }

  // 1) Invalid token -> 401 for index.
  {
    const r = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/index"), { method: "GET", token: invalidToken }); // Invalid token.
    assert.strictEqual(r.status, 401, `expected 401 invalid token, got ${r.status} body=${r.text}`); // Assert 401.
  }

  // 2) Valid token -> 200 for index (with required tenant triple query).
  {
    const u = new URL(joinUrl(baseUrl, "/api/control/ao_act/index")); // Build URL with query.
    u.searchParams.set("tenant_id", triple.tenant_id); // Required tenant query.
    u.searchParams.set("project_id", triple.project_id); // Required project query.
    u.searchParams.set("group_id", triple.group_id); // Required group query.
    const r = await fetchJsonWithRetry(u.toString(), { method: "GET", token: adminToken }); // Authorized request.
    assert.strictEqual(r.status, 200, `expected 200 index, got ${r.status} body=${r.text}`); // Assert 200.
  }

  // 3) Valid token -> can write task (200/201). 
  const taskPayload = minimalTaskPayload(triple); // Build minimal valid task payload.
  {
    const r = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/task"), { method: "POST", token: adminToken, body: taskPayload }); // Create task.
    assert.ok([200, 201].includes(r.status), `expected 200/201, got status=${r.status} body=${r.text}`); // Assert success.
  }

  // 4) Token missing receipt.write should still be allowed to write task (authz scope check).
  {
    const r = await fetchJsonWithRetry(joinUrl(baseUrl, "/api/control/ao_act/task"), { method: "POST", token: taskOnlyToken, body: minimalTaskPayload(triple) }); // Task write.
    assert.ok([200, 201].includes(r.status), `expected 200/201 taskOnly task.write, got ${r.status} body=${r.text}`); // Assert.
  }

  console.log("[OK] AO-ACT AuthZ v0 acceptance passed"); // Success line.
} // End main.

main().catch((e) => { // Top-level error handler.
  console.error("[FAIL] Sprint19 AuthZ acceptance failed"); // Failure header.
  console.error(e && e.stack ? e.stack : String(e)); // Print stack for debugging.
  process.exit(1); // Non-zero exit for CI gate.
}); // End catch.
