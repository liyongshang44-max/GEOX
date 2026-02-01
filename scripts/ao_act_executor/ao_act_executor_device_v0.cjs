#!/usr/bin/env node // Run the AO-ACT device executor adapter manually.
"use strict"; // Enforce strict mode.

const process = require("node:process"); // Read argv and exit deterministically.
const { getIndex, postReceipt } = require("./ao_act_client_v0.cjs"); // Use existing AO-ACT endpoints.
const { buildReceiptPayloadV0, validateObservedKeysAreSubsetOfSchema } = require("./receipt_builder_v0.cjs"); // Build and validate receipt fields.

function parseArgs(argv) { // Parse minimal CLI args without introducing scheduler semantics.
  const out = { baseUrl: null, deviceGatewayUrl: null, taskFactId: null, actTaskId: null, once: false }; // Initialize args.
  for (let i = 0; i < argv.length; i++) { // Iterate argv tokens.
    const a = argv[i]; // Current token.
    if (a === "--baseUrl") { out.baseUrl = String(argv[i + 1] ?? ""); i++; continue; } // Read --baseUrl.
    if (a === "--deviceGatewayUrl") { out.deviceGatewayUrl = String(argv[i + 1] ?? ""); i++; continue; } // Read --deviceGatewayUrl.
    if (a === "--taskFactId") { out.taskFactId = String(argv[i + 1] ?? ""); i++; continue; } // Read --taskFactId.
    if (a === "--actTaskId") { out.actTaskId = String(argv[i + 1] ?? ""); i++; continue; } // Read --actTaskId.
    if (a === "--once") { out.once = true; continue; } // Read --once (demo-only index pick).
  } // End block.
  return out; // Return parsed args.
} // End block.

function assert(cond, msg) { // Provide simple assertion helper.
  if (!cond) throw new Error(msg); // Throw with stable message on failure.
} // End block.

async function fetchJson(url, bodyObj) { // Send JSON POST to device gateway.
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "accept": "application/json" }, body: JSON.stringify(bodyObj) }); // Issue POST.
  const text = await res.text(); // Read response as text.
  let json = null; // Holder for parsed JSON.
  try { json = text ? JSON.parse(text) : null; } catch { json = null; } // Parse JSON if possible.
  return { status: res.status, text, json }; // Return stable envelope.
} // End block.

async function selectTaskRowByExplicitId(baseUrl, args) { // Select task row using explicit identifiers.
  if (args.actTaskId) { // If act_task_id is provided, use server-side filter.
    const r = await getIndex(baseUrl, { act_task_id: args.actTaskId }); // Fetch index for act_task_id.
    assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Require success.
    const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
    assert(rows.length >= 1, "TASK_NOT_FOUND_BY_ACT_TASK_ID"); // Require at least one row.
    return rows[0]; // Return first row.
  } // End block.

  const r = await getIndex(baseUrl, {}); // Fetch full index for task_fact_id selection.
  assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Require success.
  const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
  const hit = rows.find((x) => String(x?.task_fact_id ?? "") === String(args.taskFactId)); // Find by task_fact_id.
  assert(hit, "TASK_NOT_FOUND_BY_TASK_FACT_ID"); // Require match.
  return hit; // Return row.
} // End block.

async function selectTaskRowDemoOnce(baseUrl) { // Demo-only selection: pick first task with no receipt.
  const r = await getIndex(baseUrl, {}); // Fetch full index.
  assert(r.status === 200 && r.json && r.json.ok === true, `INDEX_FETCH_FAILED:${r.status}`); // Require success.
  const rows = Array.isArray(r.json.rows) ? r.json.rows : []; // Normalize rows.
  const hit = rows.find((x) => x?.receipt_fact_id === null || x?.receipt_fact_id === undefined); // Only criterion: no receipt.
  assert(hit, "NO_TASK_WITHOUT_RECEIPT_FOUND"); // Fail if none.
  return hit; // Return first eligible row.
} // End block.

async function main() { // Main executor flow.
  const args = parseArgs(process.argv.slice(2)); // Parse args after node+script.
  const baseUrl = args.baseUrl || process.env.GEOX_BASE_URL || "http://127.0.0.1:3000"; // Resolve base URL.
  const deviceGatewayUrl = String(args.deviceGatewayUrl || "").trim(); // Read device gateway URL.
  assert(deviceGatewayUrl.length > 0, "MISSING_DEVICE_GATEWAY_URL"); // Require gateway URL.

  const hasExplicit = Boolean(args.taskFactId) || Boolean(args.actTaskId); // Check for explicit selector.
  if (!hasExplicit && !args.once) { // Enforce selection mode.
    throw new Error("MISSING_TASK_SELECTOR: use --taskFactId or --actTaskId (preferred), or --once (demo-only)"); // Provide stable guidance.
  } // End block.

  const row = hasExplicit ? await selectTaskRowByExplicitId(baseUrl, args) : await selectTaskRowDemoOnce(baseUrl); // Select task row.
  assert(row && typeof row === "object", "INDEX_ROW_INVALID"); // Validate row.
  if (row.receipt_fact_id !== null && row.receipt_fact_id !== undefined) { // Refuse duplicate execution.
    throw new Error("TASK_ALREADY_HAS_RECEIPT"); // Guard against double-write.
  } // End block.

  const taskRecordJson = row.task_record_json; // Extract task record JSON.
  assert(taskRecordJson && typeof taskRecordJson === "object", "TASK_RECORD_JSON_MISSING"); // Require task record.

  const taskPayload = taskRecordJson.payload; // Alias task payload.
  assert(taskPayload && typeof taskPayload === "object", "TASK_PAYLOAD_REQUIRED"); // Require payload.

  const execReq = { act_task_id: taskPayload.act_task_id, action_type: taskPayload.action_type, parameters: taskPayload.parameters }; // Build device execute request.
  const execRes = await fetchJson(`${deviceGatewayUrl.replace(/\/$/, "")}/execute`, execReq); // Call device gateway execute endpoint.
  assert(execRes.status === 200 && execRes.json && execRes.json.ok === true, `DEVICE_EXEC_FAILED:${execRes.status}:${execRes.text}`); // Require success.

  const observed = execRes.json.observed_parameters; // Extract observed_parameters from gateway.
  assert(observed && typeof observed === "object" && !Array.isArray(observed), "DEVICE_OBSERVED_PARAMETERS_REQUIRED"); // Require object.
  validateObservedKeysAreSubsetOfSchema(taskRecordJson, observed); // Enforce observed keys ⊆ task.parameter_schema.keys.

  const logsRef = execRes.json.logs_ref && typeof execRes.json.logs_ref === "object" ? execRes.json.logs_ref : { kind: "device", ref: "device://unknown" }; // Derive logs ref.

  const executorId = { kind: "device", id: "ao_act_device_executor_v0", namespace: "geox.device" }; // Fixed executor identity.
  const nowTs = Date.now(); // Capture time for created_at_ts.
  const receiptPayload = buildReceiptPayloadV0(taskRecordJson, executorId, nowTs, observed, logsRef); // Build schema-valid receipt payload.

  const wr = await postReceipt(baseUrl, receiptPayload); // Write receipt.
  assert(wr.status === 200 && wr.json && wr.json.ok === true, `RECEIPT_WRITE_FAILED:${wr.status}:${wr.text}`); // Require success.

  console.log(`[OK] device executor wrote receipt (act_task_id=${taskPayload.act_task_id})`); // Print success line.
} // End block.

main().catch((err) => { // Catch fatal errors.
  console.error("[FAIL] ao_act_executor_device_v0 failed:"); // Print stable failure header.
  console.error(err?.stack ?? String(err)); // Print error stack or string.
  process.exit(13); // Exit with stable non-zero code.
}); // End call and close block.
