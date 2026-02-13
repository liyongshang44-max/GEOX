/* eslint-disable @typescript-eslint/no-explicit-any */ // Allow minimal prototype typing without adding lint toolchain. 
import crypto from "node:crypto"; // Node crypto for stable random IDs and hashing if needed. 
import process from "node:process"; // Node process for env + exit codes. 

type Args = { // CLI arguments parsed from process.argv. 
  baseUrl: string; // Server base URL, e.g. http://127.0.0.1:3000. 
  token: string; // Bearer token for AO-ACT scoped calls. 
  tenant_id: string; // Tenant id for hard isolation triple. 
  project_id: string; // Project id for hard isolation triple. 
  group_id: string; // Group id for hard isolation triple. 
  executor_id: string; // Executor identity written into ao_act_receipt_v0 payload. 
  limit: number; // Max tasks to process in this run. 
}; 

function nowMs(): number { // Helper: current epoch milliseconds. 
  return Date.now(); // Return current time in ms. 
} 

function parseArgs(argv: string[]): Args { // Parse flags from argv. 
  const get = (k: string): string | undefined => { // Helper: read --k value from argv. 
    const idx = argv.indexOf(`--${k}`); // Locate the flag index. 
    if (idx === -1) return undefined; // Return undefined if flag missing. 
    const v = argv[idx + 1]; // Read next token as value. 
    if (!v || v.startsWith("--")) return undefined; // Guard: missing value. 
    return v; // Return parsed value. 
  }; 

  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3000"; // Resolve baseUrl from args/env/default. 
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? ""; // Resolve token from args/env. 
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA"; // Resolve tenant id. 
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA"; // Resolve project id. 
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA"; // Resolve group id. 
  const executor_id = get("executor_id") ?? process.env.GEOX_EXECUTOR_ID ?? `exec_${crypto.randomUUID().replace(/-/g, "")}`; // Resolve executor id. 
  const limitRaw = get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1"; // Resolve limit raw. 
  const limit = Math.max(1, Number.parseInt(limitRaw, 10) || 1); // Parse limit as positive integer. 

  if (!token) { // Enforce that token exists for auth. 
    throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)"); // Fail early with actionable message. 
  } 

  return { baseUrl, token, tenant_id, project_id, group_id, executor_id, limit }; // Return normalized args. 
} 

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> { // Minimal JSON HTTP helper with Bearer auth. 
  const headers: Record<string, string> = { "Accept": "application/json" }; // Default Accept header. 
  if (init?.body) headers["Content-Type"] = "application/json"; // Add Content-Type for JSON body. 
  headers["Authorization"] = `Bearer ${token}`; // Add Bearer token header. 
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } }); // Execute fetch with merged headers. 
  const text = await res.text(); // Read response body as text for error visibility. 
  let obj: any; // Parsed object placeholder. 
  try { obj = text ? JSON.parse(text) : {}; } catch { obj = { _non_json: text }; } // Best-effort JSON parse. 
  if (!res.ok) { // If HTTP non-2xx, throw with payload. 
    throw new Error(`http ${res.status} ${res.statusText}: ${text}`); // Include status + raw payload. 
  } 
  return obj; // Return parsed object. 
} 

function pickExecutableTasks(rows: any[]): any[] { // Select tasks that do not yet have a receipt. 
  return rows.filter((r) => { // Filter row set. 
    const receiptFactId = r.receipt_fact_id ?? r.receiptFactId ?? null; // Normalize receipt fact id field. 
    return !receiptFactId; // Execute only tasks with no latest receipt. 
  }); 
} 

async function writeReceipt(baseUrl: string, token: string, tenant_id: string, project_id: string, group_id: string, act_task_id: string, executor_id: string): Promise<{ receipt_fact_id: string }> { // Write ao_act_receipt_v0 for a task. 
  const start = nowMs() - 50; // Synthetic start time just before now. 
  const end = nowMs(); // Synthetic end time at now. 
  const body = { // Build receipt payload record matching ao_act_receipt_v0 schema. 
    type: "ao_act_receipt_v0", // Record type discriminator. 
    payload: { // Payload object required by schema. 
      tenant_id, // Tenant id for isolation. 
      project_id, // Project id for isolation. 
      group_id, // Group id for isolation. 
      act_task_id, // Task id this receipt refers to. 
      executor_id, // Executor identity. 
      execution_time: { start_ts: start, end_ts: end }, // Execution time window. 
      execution_coverage: { kind: "field", ref: "simulated" }, // Minimal coverage stub. 
      resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 }, // Zero resource usage stub. 
      logs_refs: [{ kind: "stdout", ref: "executor_runtime_v1/run_once" }], // Required logs_refs with minItems=1. 
      status: "executed", // Mark as executed (enum). 
      constraint_check: { violated: false, violations: [] }, // Mark no constraint violations. 
      observed_parameters: {}, // Empty observed parameters object. 
      created_at_ts: end, // Created timestamp for receipt. 
      device_refs: [], // Optional device refs list (empty). 
      meta: { runtime: "executor_runtime_v1", mode: "run_once" } // Optional meta object with runtime marker. 
    } 
  }; 

  const out = await httpJson(`${baseUrl}/api/control/ao_act/receipt`, token, { method: "POST", body: JSON.stringify(body) }); // Call receipt append endpoint. 
  if (!out?.ok || !out?.fact_id) { // Validate expected response shape. 
    throw new Error(`receipt write failed: ${JSON.stringify(out)}`); // Throw with payload for debugging. 
  } 
  return { receipt_fact_id: String(out.fact_id) }; // Return receipt fact id. 
} 

async function createEvidenceExportJob(baseUrl: string, token: string, tenant_id: string, project_id: string, group_id: string, act_task_id: string): Promise<string> { // Create evidence export job via v1 API. 
  const body = { tenant_id, project_id, group_id, act_task_id, template: "ao_act_basic_v1" }; // Build job create payload. 
  const out = await httpJson(`${baseUrl}/api/delivery/evidence_export/v1/jobs`, token, { method: "POST", body: JSON.stringify(body) }); // Create job. 
  const jobId = out?.job_id ?? out?.jobId ?? out?.id; // Normalize job id. 
  if (!jobId) { // Validate job id exists. 
    throw new Error(`job create missing job_id: ${JSON.stringify(out)}`); // Throw with payload. 
  } 
  return String(jobId); // Return job id. 
} 

async function waitJobDone(baseUrl: string, token: string, jobId: string, maxMs: number): Promise<any> { // Poll job status until done/failed or timeout. 
  const start = nowMs(); // Start time for timeout. 
  while (true) { // Loop until terminal state. 
    const out = await httpJson(`${baseUrl}/api/delivery/evidence_export/v1/jobs/${jobId}`, token, { method: "GET" }); // Query job status. 
    const job = out?.job ?? out; // Normalize job envelope. 
    const state = job?.state ?? job?.status; // Normalize state/status field. 
    if (state === "done") return job; // Return job payload on success. 
    if (state === "failed") throw new Error(`job failed: ${JSON.stringify(job)}`); // Throw on failure. 
    if (nowMs() - start > maxMs) throw new Error(`job timeout after ${maxMs}ms: ${JSON.stringify(job)}`); // Throw on timeout. 
    await new Promise((r) => setTimeout(r, 500)); // Sleep before next poll. 
  } 
} 

async function main(): Promise<void> { // Program entrypoint. 
  const args = parseArgs(process.argv.slice(2)); // Parse CLI args. 
  console.log(`INFO: executor_runtime_v1 run_once baseUrl=${args.baseUrl}`); // Print base URL for traceability. 
  console.log(`INFO: executor_id=${args.executor_id}`); // Print executor id for traceability. 

  const index = await httpJson( // Query AO-ACT index for tasks + latest receipt. 
    `${args.baseUrl}/api/control/ao_act/index?tenant_id=${encodeURIComponent(args.tenant_id)}&project_id=${encodeURIComponent(args.project_id)}&group_id=${encodeURIComponent(args.group_id)}&limit=100`, // Build query URL. 
    args.token, // Provide auth token. 
    { method: "GET" } // Use GET method. 
  ); 

  if (!index?.ok || !Array.isArray(index.rows)) { // Validate expected index response. 
    throw new Error(`unexpected index response: ${JSON.stringify(index)}`); // Throw for contract mismatch. 
  } 

  const todo = pickExecutableTasks(index.rows).slice(0, args.limit); // Pick tasks to execute in this run. 
  console.log(`INFO: index rows=${index.rows.length} todo=${todo.length}`); // Print selection summary. 
  if (todo.length === 0) { // If no tasks to execute, exit successfully. 
    console.log("INFO: no executable tasks found (no-op)"); // Informational message. 
    return; // Exit without error. 
  } 

  for (const row of todo) { // Process each selected task. 
    const act_task_id = String(row.act_task_id ?? row.actTaskId); // Normalize act_task_id field. 
    if (!act_task_id) { // Guard missing task id. 
      throw new Error(`missing act_task_id in row: ${JSON.stringify(row)}`); // Fail with row payload. 
    } 

    console.log(`INFO: executing act_task_id=${act_task_id} action_type=${row.action_type ?? row.actionType ?? "?"}`); // Print task info. 
    const receipt = await writeReceipt(args.baseUrl, args.token, args.tenant_id, args.project_id, args.group_id, act_task_id, args.executor_id); // Append receipt. 
    console.log(`INFO: wrote receipt_fact_id=${receipt.receipt_fact_id}`); // Print receipt fact id. 

    const jobId = await createEvidenceExportJob(args.baseUrl, args.token, args.tenant_id, args.project_id, args.group_id, act_task_id); // Create evidence export job. 
    console.log(`INFO: created export job_id=${jobId}`); // Print job id. 

    const job = await waitJobDone(args.baseUrl, args.token, jobId, 60_000); // Wait for job completion (60s). 
    console.log(`INFO: export done sha256=${job.artifact_sha256} acceptance_fact_id=${job.acceptance_fact_id}`); // Print key output pointers. 
    if (job.acceptance_result?.verdict) { // If acceptance_result is present, print verdict. 
      console.log(`INFO: acceptance verdict=${job.acceptance_result.verdict} deterministic_hash=${job.acceptance_result.deterministic_hash}`); // Print verdict + hash. 
    } 

    console.log(`PASS: executor_runtime_v1 completed act_task_id=${act_task_id}`); // Emit PASS marker for acceptance scripts. 
  } 
} 

main().catch((err) => { // Top-level error handler. 
  console.error(`FAIL: ${err?.message ?? String(err)}`); // Print error message to stderr. 
  process.exit(1); // Exit non-zero for CI/acceptance detection. 
}); 
