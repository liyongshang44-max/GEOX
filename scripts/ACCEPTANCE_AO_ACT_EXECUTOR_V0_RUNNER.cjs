#!/usr/bin/env node // Run Sprint 17 AO-ACT executor adapter acceptance.
"use strict"; // Enforce strict mode.

const assert = require("node:assert/strict"); // Provide deterministic assertions.
const fs = require("node:fs"); // Provide artifact file writes.
const path = require("node:path"); // Provide cross-platform path joins.
const process = require("node:process"); // Read argv and environment.
const { spawn } = require("node:child_process"); // Spawn executor and stub processes.
const { setTimeout: sleep } = require("node:timers/promises"); // Provide async deterministic delays.

const { postTask, getIndex, writeFileUtf8 } = require("./ao_act_executor/ao_act_client_v0.cjs"); // Reuse AO-ACT client wrappers.

function parseArgs(argv) { // Parse CLI arguments for base URL selection.
  const out = { baseUrl: null }; // Initialize parsed args.
  for (let i = 0; i < argv.length; i++) { // Iterate argv.
    const a = argv[i]; // Current token.
    if (a === "--baseUrl") { out.baseUrl = String(argv[i + 1] ?? ""); i++; continue; } // Read --baseUrl.
  } // End block.
  return out; // Return args.
} // End block.

function isoStampForPath(now) { // Convert a Date to a filesystem-safe timestamp.
  return now.toISOString().replace(/[:.]/g, "-"); // Replace forbidden characters with dashes.
} // End block.

async function getJson(url, init) { // Fetch JSON with raw text capture for artifacts.
  const res = await fetch(url, init); // Issue fetch.
  const text = await res.text(); // Read response as text.
  let json = null; // Holder for parsed JSON.
  try { json = text ? JSON.parse(text) : null; } catch { json = null; } // Parse JSON if possible.
  return { status: res.status, text, json }; // Return stable envelope.
} // End block.

async function mustBe200Any(baseUrl, paths) { // Health check any of multiple endpoints deterministically.
  const attempts = []; // Collect attempts for diagnostics.
  for (const p of paths) { // Iterate candidate health paths.
    const u = `${baseUrl}${p}`; // Compose URL.
    try { // Begin try block.
      const r = await getJson(u, { method: "GET", headers: { "accept": "application/json" } }); // Issue health request.
      attempts.push({ path: p, status: r.status, body: r.json ?? r.text }); // Record attempt.
      if (r.status === 200) return { ok: true, path: p, attempts }; // Succeed fast on first 200.
    } catch (e) { // Begin catch block.
      attempts.push({ path: p, status: "FETCH_FAILED", error: String(e?.message ?? e) }); // Record fetch failure.
    } // End block.
  } // End block.
  throw new Error(`HEALTH_CHECK_FAILED:${JSON.stringify(attempts)}`); // Fail with detailed attempts.
} // End block.

function readActionTypeAllowlistFirst(repoRoot) { // Read first action_type from server allowlist SSOT.
  const fp = path.join(repoRoot, "apps", "server", "src", "routes", "control_ao_act.ts"); // Locate frozen TS source file.
  const src = fs.readFileSync(fp, { encoding: "utf8" }); // Read file contents.
  const m = src.match(/AO_ACT_ACTION_TYPE_ALLOWLIST_V0\s*=\s*\[([\s\S]*?)\]\s*as\s*const/); // Extract array literal body.
  assert(m && m[1], "ALLOWLIST_PARSE_FAILED"); // Require match.
  const body = m[1]; // Array literal inner content.
  const items = [...body.matchAll(/"([A-Z0-9_]+)"/g)].map((x) => x[1]); // Extract quoted strings.
  assert(items.length >= 1, "ALLOWLIST_EMPTY"); // Require at least one item.
  return items[0]; // Return first action type as deterministic choice.
} // End block.

function buildMinimalTaskPayload(actionType, nowTs) { // Build a schema-valid minimal task request body.
  return { // Return task body matching server route schema.
    issuer: { kind: "human", id: "acceptance", namespace: "geox.acceptance" }, // Provide required issuer identity.
    action_type: actionType, // Use allowlisted action_type from SSOT.
    target: { kind: "field", ref: "field_demo_001" }, // Provide required target reference.
    time_window: { start_ts: nowTs - 1000, end_ts: nowTs }, // Provide a small valid time window.
    parameter_schema: { keys: [ { name: "depth_cm", type: "number", min: 0, max: 100 } ] }, // Provide a single numeric parameter key.
    parameters: { depth_cm: 10 }, // Provide full 1:1 parameters coverage for schema.
    constraints: { }, // Provide empty constraints (allowed by z.record).
    meta: { note: "sprint17_executor_acceptance" } // Provide optional meta without forbidden keys.
  }; // End of task body.
} // End block.

async function pollIndexForReceipt(baseUrl, actTaskId, maxWaitMs, stepMs) { // Poll /index?act_task_id=... until receipt appears.
  const started = Date.now(); // Capture start time for timeout.
  while (true) { // Loop until receipt appears or timeout.
    const r = await getIndex(baseUrl, { act_task_id: actTaskId }); // Call index filter by act_task_id.
    assert.equal(r.status, 200, `INDEX_STATUS_${r.status}`); // Require HTTP 200.
    assert(r.json && r.json.ok === true, "INDEX_JSON_OK_REQUIRED"); // Require ok true.
    const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
    assert(rows.length >= 1, "INDEX_NO_ROWS"); // Require at least one row.
    const row = rows[0]; // Use first row for this act_task_id.
    if (row.receipt_fact_id !== null && row.receipt_fact_id !== undefined) return row; // Return once receipt is present.
    if (Date.now() - started > maxWaitMs) throw new Error("RECEIPT_POLL_TIMEOUT"); // Timeout deterministically.
    await sleep(stepMs); // Wait before next poll.
  } // End block.
} // End block.

function spawnAndCapture(cmd, args, opts) { // Spawn a child process and capture stdout/stderr to strings.
  return new Promise((resolve) => { // Wrap spawn into a promise.
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] }); // Spawn child with pipes.
    let stdout = ""; // Collect stdout.
    let stderr = ""; // Collect stderr.
    child.stdout.on("data", (c) => { stdout += String(c); }); // Append stdout chunks.
    child.stderr.on("data", (c) => { stderr += String(c); }); // Append stderr chunks.
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })); // Resolve on close.
  }); // End call and close block.
} // End block.

async function startDeviceStub(nodeCmd, stubPath, port, env) { // Start device gateway stub as a background process.
  const child = spawn(nodeCmd, [stubPath, "--port", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] }); // Spawn stub.
  let out = ""; // Capture stub stdout.
  let err = ""; // Capture stub stderr.
  child.stdout.on("data", (c) => { out += String(c); }); // Collect stdout for diagnostics.
  child.stderr.on("data", (c) => { err += String(c); }); // Collect stderr for diagnostics.

  const base = `http://127.0.0.1:${port}`; // Compute stub base URL.
  const deadline = Date.now() + 5000; // Set health wait timeout.
  while (Date.now() < deadline) { // Loop until healthy or timeout.
    try { // Begin try block.
      const r = await getJson(`${base}/health`, { method: "GET", headers: { "accept": "application/json" } }); // Call stub health.
      if (r.status === 200) return { child, baseUrl: base, stdout: () => out, stderr: () => err }; // Return running stub handle.
    } catch { /* ignore and retry */ } // Ignore transient errors during startup.
    await sleep(100); // Wait a short interval.
  } // End block.

  child.kill(); // Stop stub on failure.
  throw new Error(`DEVICE_STUB_START_FAILED:stdout=${out}:stderr=${err}`); // Fail with captured logs.
} // End block.

function readJsonLines(filePath) { // Read JSONL file into array of parsed objects.
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, { encoding: "utf8" }) : ""; // Read entire file or empty.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0); // Split into non-empty lines.
  return lines.map((l) => JSON.parse(l)); // Parse each line as JSON.
} // End block.

function assertOnlyAoActEndpoints(requests) { // Negative guard: only allow three AO-ACT endpoints.
  const allowed = [ // Enumerate allowed URL regexes.
    /\/api\/control\/ao_act\/task$/, // Allow task write endpoint.
    /\/api\/control\/ao_act\/receipt$/, // Allow receipt write endpoint.
    /\/api\/control\/ao_act\/index(\?.*)?$/ // Allow index read endpoint (with optional query string).
  ]; // Line is part of control flow.
  for (const r of requests) { // Iterate recorded requests.
    const url = String(r?.url ?? ""); // Read URL field.
    const ok = allowed.some((re) => re.test(url)); // Match against allowlist regexes.
    assert(ok, `DISALLOWED_REQUEST_URL:${url}`); // Fail on any unexpected URL.
  } // End block.
} // End block.

async function runCaseSim(baseUrl, repoRoot, artifactsDir, nodeCmd, requestLogPath) { // Execute sim case end-to-end.
  const actionType = readActionTypeAllowlistFirst(repoRoot); // Get allowlisted action_type.
  const nowTs = Date.now(); // Capture now for deterministic task window.
  const taskBody = buildMinimalTaskPayload(actionType, nowTs); // Build minimal task payload.

  const taskRes = await postTask(baseUrl, taskBody, { saveRawPath: path.join(artifactsDir, "case01_task_response.json") }); // Create task and save raw response.
  assert.equal(taskRes.status, 200, `TASK_WRITE_STATUS_${taskRes.status}`); // Require HTTP 200.
  assert(taskRes.json && taskRes.json.ok === true, "TASK_WRITE_OK_REQUIRED"); // Require ok true.
  const taskFactId = String(taskRes.json.fact_id); // Extract task fact_id.
  const actTaskId = String(taskRes.json.act_task_id); // Extract act_task_id.

  const simPath = path.join(repoRoot, "scripts", "ao_act_executor", "ao_act_executor_sim_v0.cjs"); // Locate sim executor script.
  const env = { ...process.env, GEOX_AO_ACT_CLIENT_LOG_PATH: requestLogPath }; // Provide shared request log path to child.
  const ex = await spawnAndCapture(nodeCmd, [simPath, "--baseUrl", baseUrl, "--taskFactId", taskFactId], { env }); // Run sim executor once.
  writeFileUtf8(path.join(artifactsDir, "case01_sim_stdout.txt"), ex.stdout); // Persist executor stdout.
  writeFileUtf8(path.join(artifactsDir, "case01_sim_stderr.txt"), ex.stderr); // Persist executor stderr.
  assert.equal(ex.code, 0, `SIM_EXECUTOR_EXIT_${ex.code}`); // Require successful executor exit.

  const row = await pollIndexForReceipt(baseUrl, actTaskId, 5000, 200); // Poll until receipt appears.
  const receipt = row.receipt_record_json; // Extract receipt_record_json.
  assert(receipt && typeof receipt === "object", "RECEIPT_RECORD_JSON_REQUIRED"); // Require receipt object.
  assert(receipt.payload && typeof receipt.payload === "object", "RECEIPT_PAYLOAD_REQUIRED"); // Require receipt payload.
  assert.equal(receipt.payload.executor_id.kind, "script", "SIM_EXECUTOR_KIND_MISMATCH"); // Assert executor kind.
  assert.equal(receipt.payload.executor_id.id, "ao_act_sim_executor_v0", "SIM_EXECUTOR_ID_MISMATCH"); // Assert executor id.
  assert.equal(receipt.payload.act_task_id, actTaskId, "SIM_ACT_TASK_ID_MISMATCH"); // Assert act_task_id linkage.

  return { taskFactId, actTaskId, receiptFactId: row.receipt_fact_id }; // Return summary fields.
} // End block.

async function runCaseDevice(baseUrl, repoRoot, artifactsDir, nodeCmd, requestLogPath) { // Execute device case end-to-end with stub.
  const port = 18080; // Use fixed port for deterministic behavior.
  const stubPath = path.join(repoRoot, "scripts", "ao_act_executor", "device_gateway_stub_v0.cjs"); // Locate stub script.
  const envStub = { ...process.env }; // Provide inherited env for stub.
  const stub = await startDeviceStub(nodeCmd, stubPath, port, envStub); // Start stub and wait healthy.

  try { // Begin try block.
    const actionType = readActionTypeAllowlistFirst(repoRoot); // Read action_type from allowlist.
    const nowTs = Date.now(); // Capture now.
    const taskBody = buildMinimalTaskPayload(actionType, nowTs); // Build task.

    const taskRes = await postTask(baseUrl, taskBody, { saveRawPath: path.join(artifactsDir, "case02_task_response.json") }); // Create task.
    assert.equal(taskRes.status, 200, `TASK_WRITE_STATUS_${taskRes.status}`); // Require HTTP 200.
    assert(taskRes.json && taskRes.json.ok === true, "TASK_WRITE_OK_REQUIRED"); // Require ok true.
    const taskFactId = String(taskRes.json.fact_id); // Extract task fact_id.
    const actTaskId = String(taskRes.json.act_task_id); // Extract act_task_id.

    const devPath = path.join(repoRoot, "scripts", "ao_act_executor", "ao_act_executor_device_v0.cjs"); // Locate device executor script.
    const envExec = { ...process.env, GEOX_AO_ACT_CLIENT_LOG_PATH: requestLogPath }; // Provide shared request log path.
    const ex = await spawnAndCapture(nodeCmd, [devPath, "--baseUrl", baseUrl, "--deviceGatewayUrl", stub.baseUrl, "--taskFactId", taskFactId], { env: envExec }); // Run device executor.
    writeFileUtf8(path.join(artifactsDir, "case02_device_stdout.txt"), ex.stdout); // Persist stdout.
    writeFileUtf8(path.join(artifactsDir, "case02_device_stderr.txt"), ex.stderr); // Persist stderr.
    assert.equal(ex.code, 0, `DEVICE_EXECUTOR_EXIT_${ex.code}`); // Require success.

    const row = await pollIndexForReceipt(baseUrl, actTaskId, 5000, 200); // Poll for receipt.
    const receipt = row.receipt_record_json; // Extract receipt.
    assert(receipt && typeof receipt === "object", "RECEIPT_RECORD_JSON_REQUIRED"); // Require receipt object.
    assert(receipt.payload && typeof receipt.payload === "object", "RECEIPT_PAYLOAD_REQUIRED"); // Require payload.
    assert.equal(receipt.payload.executor_id.kind, "device", "DEVICE_EXECUTOR_KIND_MISMATCH"); // Assert kind.
    assert.equal(receipt.payload.executor_id.id, "ao_act_device_executor_v0", "DEVICE_EXECUTOR_ID_MISMATCH"); // Assert id.
    assert.equal(receipt.payload.act_task_id, actTaskId, "DEVICE_ACT_TASK_ID_MISMATCH"); // Assert linkage.

    return { taskFactId, actTaskId, receiptFactId: row.receipt_fact_id, stubLogs: { stdout: stub.stdout(), stderr: stub.stderr() } }; // Return summary.
  } finally { // Line is part of control flow.
    stub.child.kill(); // Stop stub process to avoid lingering background processes.
  } // End block.
} // End block.

async function main() { // Runner entrypoint.
  const args = parseArgs(process.argv.slice(2)); // Parse CLI args.
  const baseUrl = args.baseUrl || process.env.GEOX_BASE_URL || "http://127.0.0.1:3000"; // Resolve base URL.
  const repoRoot = path.resolve(__dirname, ".."); // Resolve repo root from scripts directory.
  const artifactsDir = path.join(repoRoot, "acceptance", `ao_act_executor_v0_${isoStampForPath(new Date())}`); // Create unique artifacts dir.
  fs.mkdirSync(artifactsDir, { recursive: true }); // Ensure artifacts dir exists.

  const requestLogPath = path.join(artifactsDir, "request_log.jsonl"); // Define shared request log file path.
  writeFileUtf8(requestLogPath, ""); // Truncate request log to empty at start.

  console.log(`[INFO] Sprint17 AO-ACT executor acceptance (baseUrl=${baseUrl})`); // Print runner header.
  console.log(`[INFO] artifactsDir=${artifactsDir}`); // Print artifact path.

  await mustBe200Any(baseUrl, ["/api/health", "/health", "/api/admin/healthz"]); // Ensure server is reachable.

  const nodeCmd = "node"; // Use system node command.

  const case01 = await runCaseSim(baseUrl, repoRoot, artifactsDir, nodeCmd, requestLogPath); // Run sim case.
  const case02 = await runCaseDevice(baseUrl, repoRoot, artifactsDir, nodeCmd, requestLogPath); // Run device case.

  const requests = readJsonLines(requestLogPath); // Read cross-process request log.
  assertOnlyAoActEndpoints(requests); // Enforce negative guard on request URLs.

  const summary = { ok: true, baseUrl, cases: { case01, case02 }, request_count: requests.length }; // Build compact summary.
  writeFileUtf8(path.join(artifactsDir, "summary.json"), JSON.stringify(summary, null, 2)); // Write summary JSON.

  console.log("[OK] Sprint17 AO-ACT executor acceptance passed"); // Print success line.
} // End block.

main().catch((err) => { // Handle fatal runner errors.
  console.error("[FAIL] Sprint17 AO-ACT executor acceptance failed:"); // Print failure header.
  console.error(err?.stack ?? String(err)); // Print stack for diagnosis.
  process.exit(13); // Exit with deterministic non-zero code.
}); // End call and close block.
