#!/usr/bin/env node // Run the AO-ACT sim executor adapter manually.
"use strict"; // Enforce strict mode.

const process = require("node:process"); // Read argv and exit deterministically.
const { getIndex, postReceipt } = require("./ao_act_client_v0.cjs"); // Use the existing AO-ACT API endpoints only.
const { buildReceiptPayloadV0 } = require("./receipt_builder_v0.cjs"); // Build schema-valid receipt payload.

function parseArgs(argv) { // Parse minimal CLI flags without introducing extra behavior.
  const out = { baseUrl: null, taskFactId: null, actTaskId: null, once: false }; // Initialize arg bag.
  for (let i = 0; i < argv.length; i++) { // Iterate argv tokens.
    const a = argv[i]; // Current token.
    if (a === "--baseUrl") { out.baseUrl = String(argv[i + 1] ?? ""); i++; continue; } // Read --baseUrl.
    if (a === "--taskFactId") { out.taskFactId = String(argv[i + 1] ?? ""); i++; continue; } // Read --taskFactId.
    if (a === "--actTaskId") { out.actTaskId = String(argv[i + 1] ?? ""); i++; continue; } // Read --actTaskId.
    if (a === "--once") { out.once = true; continue; } // Read --once (demo-only index pick).
  } // End block.
  return out; // Return parsed args.
} // End block.

function assert(cond, msg) { // Provide simple assertion helper.
  if (!cond) throw new Error(msg); // Throw with stable message on failure.
} // End block.

async function selectTaskRowByExplicitId(baseUrl, args) { // Select a task row using explicit identifiers.
  if (args.actTaskId) { // If act_task_id is provided, use server-side filter.
    const r = await getIndex(baseUrl, { act_task_id: args.actTaskId }); // Fetch index for the specified act_task_id.
    assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Enforce successful index call.
    const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
    assert(rows.length >= 1, "TASK_NOT_FOUND_BY_ACT_TASK_ID"); // Require at least one matching row.
    return rows[0]; // Return first row (act_task_id should be unique in index).
  } // End block.

  const r = await getIndex(baseUrl, {}); // Fetch full index when selecting by task_fact_id.
  assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Enforce successful index call.
  const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
  const hit = rows.find((x) => String(x?.task_fact_id ?? "") === String(args.taskFactId)); // Find row by task_fact_id exact match.
  assert(hit, "TASK_NOT_FOUND_BY_TASK_FACT_ID"); // Require a matching row.
  return hit; // Return matching row.
} // End block.

async function selectTaskRowDemoOnce(baseUrl) { // Demo-only selection: pick first task with no receipt.
  const r = await getIndex(baseUrl, {}); // Fetch full index (no filtering beyond receipt absence).
  assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Enforce successful index call.
  const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
  const hit = rows.find((x) => x?.receipt_fact_id === null || x?.receipt_fact_id === undefined); // Only criterion: latest receipt missing.
  assert(hit, "NO_TASK_WITHOUT_RECEIPT_FOUND"); // Fail if no eligible task exists.
  return hit; // Return first eligible row in index order.
} // End block.

async function main() { // Main executor flow.
  const args = parseArgs(process.argv.slice(2)); // Parse args after node+script.
  const baseUrl = args.baseUrl || process.env.GEOX_BASE_URL || "http://127.0.0.1:3000"; // Resolve base URL with env fallback.
  const hasExplicit = Boolean(args.taskFactId) || Boolean(args.actTaskId); // Compute whether explicit selection is configured.
  if (!hasExplicit && !args.once) { // Enforce that some selection mode is provided.
    throw new Error("MISSING_TASK_SELECTOR: use --taskFactId or --actTaskId (preferred), or --once (demo-only)"); // Provide stable guidance.
  } // End block.

  const row = hasExplicit ? await selectTaskRowByExplicitId(baseUrl, args) : await selectTaskRowDemoOnce(baseUrl); // Select task row per mode.
  assert(row && typeof row === "object", "INDEX_ROW_INVALID"); // Validate row shape.
  if (row.receipt_fact_id !== null && row.receipt_fact_id !== undefined) { // Refuse to execute tasks that already have a receipt.
    throw new Error("TASK_ALREADY_HAS_RECEIPT"); // Guard against accidental duplicate execution.
  } // End block.

  const taskRecordJson = row.task_record_json; // Extract task_record_json from index row.
  assert(taskRecordJson && typeof taskRecordJson === "object", "TASK_RECORD_JSON_MISSING"); // Require task_record_json.

  const executorId = { kind: "script", id: "ao_act_sim_executor_v0", namespace: "geox.local" }; // Define fixed executor identity for audit.
  const nowTs = Date.now(); // Capture current time for created_at_ts.
  const receiptPayload = buildReceiptPayloadV0(taskRecordJson, executorId, nowTs, undefined, { kind: "sim", ref: `sim://ao_act/${taskRecordJson.payload.act_task_id}` }); // Build receipt payload.

  const wr = await postReceipt(baseUrl, receiptPayload); // Write receipt via the existing server endpoint.
  assert(wr.status === 200 && wr.json && wr.json.ok === true, `RECEIPT_WRITE_FAILED:${wr.status}:${wr.text}`); // Require successful write.

  console.log(`[OK] sim executor wrote receipt (act_task_id=${taskRecordJson.payload.act_task_id})`); // Print success line.
} // End block.

main().catch((err) => { // Catch fatal errors and exit deterministically.
  console.error("[FAIL] ao_act_executor_sim_v0 failed:"); // Print stable failure header.
  console.error(err?.stack ?? String(err)); // Print stack or string for diagnostics.
  process.exit(13); // Exit with stable non-zero code.
}); // End call and close block.
