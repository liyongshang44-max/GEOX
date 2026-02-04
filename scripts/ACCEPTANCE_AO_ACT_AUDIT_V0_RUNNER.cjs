#!/usr/bin/env node // Run Sprint 18 AO-ACT audit tools acceptance (offline pack + integrity check). 
"use strict"; // Enforce strict mode for predictable behavior. 
const assert = require("node:assert/strict"); // Use strict assertions for deterministic failures. 
const fs = require("node:fs"); // Use filesystem for artifact output. 
const path = require("node:path"); // Use path utilities for cross-platform joins. 
const process = require("node:process"); // Use process for argv/env access. 
const { spawn } = require("node:child_process"); // Use spawn to run offline tools as child processes. 

function parseArgs(argv) { // Parse CLI args with a minimal explicit surface. 
  const out = { baseUrl: null }; // Initialize args bag. 
  for (let i = 0; i < argv.length; i++) { // Iterate argv tokens. 
    const a = argv[i]; // Read current token. 
    if (a === "--baseUrl") { out.baseUrl = String(argv[i + 1] ?? ""); i++; continue; } // Parse --baseUrl value. 
  } // End loop. 
  return out; // Return parsed args. 
} // End function. 

function isoStampForPath(now) { // Convert ISO timestamp to filesystem-safe string. 
  return now.toISOString().replace(/[:.]/g, "-"); // Replace ':' and '.' to avoid Windows path issues. 
} // End function. 

function writeFileUtf8(filePath, text) { // Write UTF-8 file with ensured parent directory. 
  fs.mkdirSync(path.dirname(filePath), { recursive: true }); // Ensure output directory exists. 
  fs.writeFileSync(filePath, text, { encoding: "utf8" }); // Write UTF-8 without BOM (Node default). 
} // End function. 

function readJsonFile(filePath) { // Read and parse a JSON file deterministically. 
  const text = fs.readFileSync(filePath, { encoding: "utf8" }); // Read file as UTF-8. 
  return JSON.parse(text); // Parse JSON into object. 
} // End function. 

function readActionTypeAllowlistFirst(repoRoot) { // Read first action_type from server allowlist SSOT. 
  const fp = path.join(repoRoot, "apps", "server", "src", "routes", "control_ao_act.ts"); // Locate frozen allowlist file. 
  const src = fs.readFileSync(fp, { encoding: "utf8" }); // Read TS source text. 
  const m = src.match(/AO_ACT_ACTION_TYPE_ALLOWLIST_V0\s*=\s*\[([\s\S]*?)\]\s*as\s*const/); // Extract allowlist array literal body. 
  assert(m && m[1], "ALLOWLIST_PARSE_FAILED"); // Require match to keep acceptance stable. 
  const body = m[1]; // Extract inner array contents. 
  const items = [...body.matchAll(/"([A-Z0-9_]+)"/g)].map((x) => x[1]); // Extract quoted enum strings. 
  assert(items.length >= 1, "ALLOWLIST_EMPTY"); // Require at least one allowlisted value. 
  return items[0]; // Pick first value deterministically (no strategy). 
} // End function. 

function buildMinimalTaskPayload(actionType, nowTs) { // Build a schema-valid minimal task body (matches server zod). 
  return { // Return request body object. 
    issuer: { kind: "human", id: "acceptance", namespace: "geox.acceptance" }, // Provide required issuer identity. 
    action_type: actionType, // Use allowlisted action_type from SSOT. 
    target: { kind: "field", ref: "field_demo_001" }, // Provide required target (field). 
    time_window: { start_ts: nowTs - 1000, end_ts: nowTs }, // Provide a valid time window. 
    parameter_schema: { keys: [ { name: "depth_cm", type: "number", min: 0, max: 100 } ] }, // Provide a single numeric parameter schema. 
    parameters: { depth_cm: 10 }, // Provide 1:1 parameters coverage for schema. 
    constraints: { }, // Provide empty constraints (allowed by z.record). 
    meta: { note: "sprint18_ao_act_audit_acceptance" } // Provide optional meta (must not include forbidden keys). 
  }; // End body. 
} // End function. 

async function spawnAndCapture(cmd, args, opts) { // Spawn a process and capture stdout/stderr deterministically. 
  return new Promise((resolve) => { // Wrap spawn lifecycle in a promise. 
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] }); // Spawn with stdout/stderr pipes. 
    let stdout = ""; // Initialize stdout accumulator. 
    let stderr = ""; // Initialize stderr accumulator. 
    child.stdout.on("data", (c) => { stdout += String(c); }); // Append stdout chunks. 
    child.stderr.on("data", (c) => { stderr += String(c); }); // Append stderr chunks. 
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })); // Resolve with exit code and outputs. 
  }); // End promise. 
} // End function. 

function assertLexAsc(arr) { // Assert array is lexicographically non-decreasing. 
  for (let i = 1; i < arr.length; i++) { // Iterate consecutive pairs. 
    const prev = String(arr[i - 1]); // Normalize previous element to string. 
    const cur = String(arr[i]); // Normalize current element to string. 
    assert(prev <= cur, `NOT_LEX_ASC:${prev}>${cur}`); // Enforce lexicographic ordering. 
  } // End loop. 
} // End function. 

function readJsonLines(filePath) { // Read JSONL file into parsed objects. 
  const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, { encoding: "utf8" }) : ""; // Read file or empty string. 
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0); // Split and keep non-empty lines. 
  return lines.map((l) => JSON.parse(l)); // Parse each line as JSON. 
} // End function. 

function assertOnlyAoActEndpoints(requests) { // Enforce negative guard: only AO-ACT task/receipt/index endpoints used. 
  const allowed = [ // Define allowed URL regexes. 
    /\/api\/control\/ao_act\/task$/, // Allow task write endpoint. 
    /\/api\/control\/ao_act\/receipt$/, // Allow receipt write endpoint. 
    /\/api\/control\/ao_act\/index(\?.*)?$/ // Allow index read endpoint (optional query string). 
  ]; // End allowed list. 
  for (const r of requests) { // Iterate request log entries. 
    const url = String(r?.url ?? ""); // Read recorded URL string. 
    const ok = allowed.some((re) => re.test(url)); // Check membership in allowed set. 
    assert(ok, `DISALLOWED_REQUEST_URL:${url}`); // Fail if any unexpected URL exists. 
  } // End loop. 
} // End function. 

async function main() { // Main acceptance entrypoint. 
  const args = parseArgs(process.argv.slice(2)); // Parse CLI args. 
  const baseUrl = args.baseUrl || process.env.GEOX_BASE_URL || "http://127.0.0.1:3000"; // Resolve base URL. 
  const repoRoot = path.resolve(__dirname, ".."); // Resolve repo root from scripts directory. 
  const artifactsDir = path.join(repoRoot, "acceptance", `ao_act_audit_v0_${isoStampForPath(new Date())}`); // Create unique artifacts directory. 
  fs.mkdirSync(artifactsDir, { recursive: true }); // Ensure artifacts directory exists. 

  const requestLogPath = path.join(artifactsDir, "request_log.jsonl"); // Define request log path. 
  writeFileUtf8(requestLogPath, ""); // Truncate request log at start. 
  process.env.GEOX_AO_ACT_CLIENT_LOG_PATH = requestLogPath; // Enable request logging for this process (negative guard). 

  const { postTask, postReceipt, getIndex } = require("./ao_act_executor/ao_act_client_v0.cjs"); // Load AO-ACT client after env is set. 
  const { buildReceiptPayloadV0 } = require("./ao_act_executor/receipt_builder_v0.cjs"); // Load receipt builder for schema-valid receipts. 

  console.log(`[INFO] Sprint18 AO-ACT audit acceptance (baseUrl=${baseUrl})`); // Print header line. 
  console.log(`[INFO] artifactsDir=${artifactsDir}`); // Print artifact directory path. 

  const actionType = readActionTypeAllowlistFirst(repoRoot); // Resolve allowlisted action_type deterministically. 
  const nowTs = Date.now(); // Capture now timestamp for task time_window. 
  const taskBody = buildMinimalTaskPayload(actionType, nowTs); // Build minimal task request body. 

  const taskResPath = path.join(artifactsDir, "task_response.json"); // Define raw task response artifact path. 
  const taskRes = await postTask(baseUrl, taskBody, { saveRawPath: taskResPath }); // Create task via AO-ACT API and save raw response. 
  assert.equal(taskRes.status, 200, `TASK_WRITE_STATUS_${taskRes.status}`); // Require HTTP 200 for task write. 
  assert(taskRes.json && taskRes.json.ok === true, "TASK_WRITE_OK_REQUIRED"); // Require ok=true for task write. 
  const taskFactId = String(taskRes.json.fact_id); // Extract task fact_id. 
  const actTaskId = String(taskRes.json.act_task_id); // Extract act_task_id. 

  const idxRes = await getIndex(baseUrl, { act_task_id: actTaskId }, { saveRawPath: path.join(artifactsDir, "index_response.json") }); // Fetch index row by act_task_id. 
  assert.equal(idxRes.status, 200, `INDEX_STATUS_${idxRes.status}`); // Require HTTP 200 for index. 
  assert(idxRes.json && idxRes.json.ok === true, "INDEX_OK_REQUIRED"); // Require ok=true for index. 
  const rows = Array.isArray(idxRes.json.rows) ? idxRes.json.rows : []; // Normalize rows array. 
  assert(rows.length >= 1, "INDEX_NO_ROWS"); // Require at least one row. 
  const taskRecordJson = rows[0].task_record_json; // Extract task_record_json. 
  assert(taskRecordJson && typeof taskRecordJson === "object", "TASK_RECORD_JSON_REQUIRED"); // Require task_record_json presence. 

  const execSim = { kind: "script", id: "ao_act_sim_executor_v0", namespace: "geox.local" }; // Define sim executor identity (audit-only). 
  const execDev = { kind: "device", id: "ao_act_device_executor_v0", namespace: "geox.local" }; // Define device executor identity (audit-only). 

  const receipt1 = buildReceiptPayloadV0(taskRecordJson, execSim, Date.now(), undefined, { kind: "executor_log", ref: `local://ao_act/${actTaskId}/sim` }); // Build receipt payload for sim. 
  const receipt2 = buildReceiptPayloadV0(taskRecordJson, execDev, Date.now(), undefined, { kind: "executor_log", ref: `local://ao_act/${actTaskId}/device` }); // Build receipt payload for device. 

  const r1 = await postReceipt(baseUrl, receipt1, { saveRawPath: path.join(artifactsDir, "receipt_sim_response.json") }); // Write first receipt via AO-ACT API. 
  assert.equal(r1.status, 200, `RECEIPT1_WRITE_STATUS_${r1.status}`); // Require HTTP 200 for receipt write. 
  assert(r1.json && r1.json.ok === true, "RECEIPT1_WRITE_OK_REQUIRED"); // Require ok=true for receipt write. 

  const r2 = await postReceipt(baseUrl, receipt2, { saveRawPath: path.join(artifactsDir, "receipt_device_response.json") }); // Write second receipt via AO-ACT API. 
  assert.equal(r2.status, 200, `RECEIPT2_WRITE_STATUS_${r2.status}`); // Require HTTP 200 for receipt write. 
  assert(r2.json && r2.json.ok === true, "RECEIPT2_WRITE_OK_REQUIRED"); // Require ok=true for receipt write. 

  const nodeCmd = "node"; // Use system node binary to run offline scripts. 
  const evidencePackOut = path.join(artifactsDir, "evidence_pack.json"); // Define evidence pack output path. 
  const integrityOut = path.join(artifactsDir, "integrity_report.json"); // Define integrity report output path. 

  const evidenceScript = path.join(repoRoot, "scripts", "audit", "ao_act_evidence_pack_v0.cjs"); // Locate evidence pack exporter script. 
  const integrityScript = path.join(repoRoot, "scripts", "audit", "ao_act_integrity_check_v0.cjs"); // Locate integrity checker script. 

  const ev = await spawnAndCapture(nodeCmd, [evidenceScript, "--actTaskId", actTaskId, "--out", evidencePackOut], { env: process.env }); // Run evidence pack tool (DB-only). 
  writeFileUtf8(path.join(artifactsDir, "evidence_pack_stdout.txt"), ev.stdout); // Persist evidence tool stdout. 
  writeFileUtf8(path.join(artifactsDir, "evidence_pack_stderr.txt"), ev.stderr); // Persist evidence tool stderr. 
  assert.equal(ev.code, 0, `EVIDENCE_PACK_EXIT_${ev.code}`); // Require success exit code. 

  const ic = await spawnAndCapture(nodeCmd, [integrityScript, "--actTaskId", actTaskId, "--out", integrityOut], { env: process.env }); // Run integrity check tool (DB-only). 
  writeFileUtf8(path.join(artifactsDir, "integrity_stdout.txt"), ic.stdout); // Persist integrity stdout. 
  writeFileUtf8(path.join(artifactsDir, "integrity_stderr.txt"), ic.stderr); // Persist integrity stderr. 
  assert.equal(ic.code, 0, `INTEGRITY_EXIT_${ic.code}`); // Require success exit code (ok report). 

  const pack = readJsonFile(evidencePackOut); // Parse evidence pack JSON. 
  assert.equal(pack.type, "ao_act_receipt_evidence_pack_v0", "PACK_TYPE_MISMATCH"); // Assert evidence pack type. 
  assert.equal(pack.ordering_rule, "fact_id_lex_asc", "PACK_ORDERING_RULE_MISMATCH"); // Assert frozen ordering rule. 
  assert(pack.act_task && pack.act_task.record_json && pack.act_task.record_json.payload, "PACK_TASK_REQUIRED"); // Require task section. 
  assert.equal(String(pack.act_task.fact_id), taskFactId, "PACK_TASK_FACT_ID_MISMATCH"); // Assert task fact_id linkage. 
  assert.equal(String(pack.act_task.record_json.payload.act_task_id), actTaskId, "PACK_TASK_ACT_TASK_ID_MISMATCH"); // Assert task act_task_id linkage. 
  assert(Array.isArray(pack.receipts), "PACK_RECEIPTS_ARRAY_REQUIRED"); // Require receipts array. 
  assert(pack.receipts.length >= 2, "PACK_RECEIPTS_MIN_2_REQUIRED"); // Require at least two receipts. 
  const receiptFactIds = pack.receipts.map((r) => String(r.fact_id)); // Extract receipt fact_ids. 
  assertLexAsc(receiptFactIds); // Assert lexicographic ordering by fact_id. 
  assert(Array.isArray(pack.refs), "PACK_REFS_ARRAY_REQUIRED"); // Require refs array. 
  assert(pack.refs.length >= 1, "PACK_REFS_MIN_1_REQUIRED"); // Require at least one ref collected. 

  const report = readJsonFile(integrityOut); // Parse integrity report JSON. 
  assert.equal(report.type, "ao_act_integrity_report_v0", "REPORT_TYPE_MISMATCH"); // Assert report type. 
  assert.equal(String(report.act_task_id), actTaskId, "REPORT_ACT_TASK_ID_MISMATCH"); // Assert report act_task_id linkage. 
  assert.equal(report.ok, true, "REPORT_OK_REQUIRED"); // Require ok=true. 
  assert(Array.isArray(report.errors) && report.errors.length === 0, "REPORT_ERRORS_MUST_BE_EMPTY"); // Require no errors. 
  assert(report.receipts_checked >= 2, "REPORT_RECEIPTS_CHECKED_MIN_2_REQUIRED"); // Require at least two receipts checked. 

  const requests = readJsonLines(requestLogPath); // Read request log JSONL for negative guard enforcement. 
  assertOnlyAoActEndpoints(requests); // Enforce only AO-ACT endpoints were called. 

  const summary = { ok: true, baseUrl, act_task_id: actTaskId, task_fact_id: taskFactId, receipts_written: 2, request_count: requests.length }; // Build summary object. 
  writeFileUtf8(path.join(artifactsDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n"); // Write summary JSON. 

  console.log("[OK] Sprint18 AO-ACT audit acceptance passed"); // Print success line. 
} // End main. 

main().catch((err) => { // Handle fatal errors with stable exit code. 
  console.error("[FAIL] Sprint18 AO-ACT audit acceptance failed:"); // Print failure header. 
  console.error(err?.stack ?? String(err)); // Print diagnostic stack. 
  process.exit(13); // Exit with deterministic non-zero code. 
}); // End script. 
