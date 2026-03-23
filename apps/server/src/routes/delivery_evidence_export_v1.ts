// GEOX/apps/server/src/routes/delivery_evidence_export_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance type for route registration.
import type { Pool } from "pg"; // Postgres pool type for queries.
import path from "node:path"; // Node path utilities for joining paths.
import fs from "node:fs"; // Node filesystem utilities for writing artifacts.
import crypto from "node:crypto"; // Node crypto for SHA-256 hashing and UUIDs.
import { randomUUID } from "node:crypto"; // UUID generator for fact ids (append-only ledger).
import { fileURLToPath } from "node:url"; // ESM 下替代 __filename / __dirname.
import { z } from "zod"; // Zod schema validation for request parsing.
import GeoxContracts from "@geox/contracts";
import type { AcceptanceResultV1Payload } from "@geox/contracts";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Reuse AO-ACT token/scope authorization (read-only scope).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context type for tenant triple checks.

type ExportJobState = "queued" | "running" | "done" | "error"; // Evidence export job state machine (in-memory).
type ExportJob = { // Evidence export job record stored in memory.
  job_id: string; // Job id returned to caller.
  state: ExportJobState; // Current state.
  created_at: number; // Creation time (ms since epoch).
  updated_at: number; // Last update time (ms since epoch).
  tenant_id: string; // Tenant identifier (hard isolation).
  project_id: string; // Project identifier (hard isolation).
  group_id: string; // Group identifier (hard isolation).
  program_id: string | null; // Optional program binding for compatibility migration.
  field_id: string | null; // Optional field binding for compatibility migration.
  season_id: string | null; // Optional season binding for compatibility migration.
  act_task_id: string; // Target AO-ACT act_task_id to export.
  template: string; // Export template name (v1 allows explicit templates).
  artifact_path: string | null; // Filesystem path of the produced artifact (JSON bundle for v1).
  artifact_sha256: string | null; // SHA-256 hex of produced artifact bytes.
  stdout_tail: string; // Tail of job logs (human debugging, truncated).
  stderr_tail: string; // Tail of job errors (human debugging, truncated).
  acceptance_fact_id: string | null; // fact_id of acceptance_result_v1 created by this job.
  acceptance_result: AcceptanceResultV1Payload | null; // Small in-memory summary of the acceptance_result_v1 payload (for status endpoint).
  error: string | null; // Terminal error message.
}; // End ExportJob.

const exportJobs = new Map<string, ExportJob>(); // In-memory job store (similar to importJobs).

function tailAppend(prev: string, next: string, max = 8000): string { // Append with truncation to keep only last max chars.
  const merged = (prev + next).slice(-max); // Merge then truncate.
  return merged; // Return tail string.
} // End tailAppend.

function stableStringify(v: unknown): string { // Deterministic JSON stringify with stable key ordering.
  const seen = new WeakSet<object>(); // Track visited objects to guard against cycles.
  const helper = (x: any): any => { // Recursive normalizer for stable serialization.
    if (x === null || typeof x !== "object") return x; // Pass-through primitives.
    if (x instanceof Date) return x.toISOString(); // Normalize Date to ISO string.
    if (Array.isArray(x)) return x.map(helper); // Preserve array order, normalize elements.
    if (seen.has(x)) return "[Circular]"; // Guard against circular references (should not occur).
    seen.add(x); // Mark object as seen.
    const keys = Object.keys(x).sort(); // Sort keys for deterministic output.
    const out: Record<string, any> = {}; // Create normalized object.
    for (const k of keys) out[k] = helper(x[k]); // Normalize each property value.
    return out; // Return normalized object.
  }; // End helper.
  return JSON.stringify(helper(v)); // Serialize normalized structure to JSON.
} // End stableStringify.

function sha256HexBytes(buf: Buffer): string { // Compute SHA-256 hex digest for bytes.
  return crypto.createHash("sha256").update(buf).digest("hex"); // Return SHA-256 hex digest.
} // End sha256HexBytes.

function sha256HexFile(fp: string): string { // Compute SHA-256 hex digest for a file.
  return sha256HexBytes(fs.readFileSync(fp)); // Read bytes then hash.
} // End sha256HexFile.

function parseRecordJson(rowValue: unknown): any { // Parse facts.record_json which is stored as TEXT in Postgres.
  if (rowValue === null || rowValue === undefined) return null; // Treat null/undefined as missing.
  if (typeof rowValue === "object") return rowValue; // If driver already parsed, return as-is.
  if (typeof rowValue !== "string" || rowValue.trim() === "") return null; // Reject empty/non-string.
  try { // Attempt JSON parsing.
    return JSON.parse(rowValue); // Parse JSON string to object.
  } catch { // Catch parse errors.
    return null; // Fail closed to null.
  } // End catch.
} // End parseRecordJson.

function requireTenantMatchOr404(auth: AoActAuthContextV0, tenant: { tenant_id: string; project_id: string; group_id: string }, reply: any): boolean { // Enforce tenant triple match or return 404 (non-enumerable).
  const ok = auth.tenant_id === tenant.tenant_id && auth.project_id === tenant.project_id && auth.group_id === tenant.group_id; // Compare hard triple.
  if (ok) return true; // Return true when matched.
  reply.code(404).send({ ok: false, error: "NOT_FOUND" }); // Return 404 to preserve non-enumerability.
  return false; // Return false to stop route handler.
} // End requireTenantMatchOr404.

async function fetchFactsByJsonPath(pool: Pool, whereSql: string, params: any[]): Promise<any[]> { // Helper to query facts table with a custom where clause.
  const sql = `SELECT fact_id, occurred_at, source, record_json FROM facts WHERE ${whereSql} ORDER BY occurred_at ASC, fact_id ASC`; // Build deterministic query.
  const r = await pool.query(sql, params); // Execute query.
  return r.rows.map((row: any) => ({ // Normalize each row.
    fact_id: String(row.fact_id), // Fact id (string).
    occurred_at: row.occurred_at, // Occurred timestamp.
    source: String(row.source), // Source string.
    record_json: parseRecordJson(row.record_json) // Parsed record_json object.
  })).filter((x: any) => x.record_json); // Drop rows with invalid JSON.
} // End fetchFactsByJsonPath.

async function runEvidenceExportJob(pool: Pool, job: ExportJob): Promise<void> { // Execute export job: read facts, write artifact, write acceptance_result_v1.
  job.state = "running"; // Mark job as running.
  job.updated_at = Date.now(); // Update timestamp.
  job.stdout_tail = tailAppend(job.stdout_tail, "job:running\n"); // Append log line.

  // 1) Load AO-ACT task facts by act_task_id (must exist for this template).
  const taskFacts = await fetchFactsByJsonPath( // Query task facts.
    pool, // Pool for query.
    "(record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1", // Filter by type + act_task_id.
    [job.act_task_id] // Parameters.
  ); // End task query.

  // 2) Load AO-ACT receipt facts by act_task_id (may be empty if not executed yet).
  const receiptFacts = await fetchFactsByJsonPath( // Query receipt facts.
    pool, // Pool for query.
    "(record_json::jsonb->>'type')='ao_act_receipt_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1", // Filter by type + act_task_id.
    [job.act_task_id] // Parameters.
  ); // End receipt query.

  // 3) Load approval_decision_v1 facts referencing act_task_id (optional).
  const decisionFacts = await fetchFactsByJsonPath( // Query decision facts.
    pool, // Pool for query.
    "(record_json::jsonb->>'type')='approval_decision_v1' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1", // Filter by type + act_task_id.
    [job.act_task_id] // Parameters.
  ); // End decision query.

  // 4) If we have a decision, load its referenced approval_request_v1 fact by request_id (optional).
  const requestIds = Array.from(new Set(decisionFacts.map((d: any) => String(d.record_json?.payload?.request_id ?? "")).filter(Boolean))); // Collect unique request_id values.
  const requestFacts: any[] = []; // Prepare request facts list.
  for (const rid of requestIds) { // Iterate over referenced request ids.
    const rows = await fetchFactsByJsonPath( // Query request facts.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='approval_request_v1' AND (record_json::jsonb#>>'{payload,request_id}')=$1", // Filter by type + request_id.
      [rid] // Parameters.
    ); // End request query.
    requestFacts.push(...rows); // Append results.
  } // End request loop.

  // 5) Extend chain: recommendation-approval links and recommendation facts.
  const recommendationLinkFacts: any[] = []; // Link facts from recommendation to approval requests.
  for (const rid of requestIds) { // Find link facts by approval_request_id.
    const rows = await fetchFactsByJsonPath( // Query recommendation->approval link facts.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='decision_recommendation_approval_link_v1' AND (record_json::jsonb#>>'{payload,approval_request_id}')=$1", // Filter by approval_request_id.
      [rid] // Parameters.
    ); // End query.
    recommendationLinkFacts.push(...rows); // Append normalized link facts.
  } // End link lookup loop.

  const recommendationIds = Array.from(new Set(recommendationLinkFacts.map((x: any) => String(x.record_json?.payload?.recommendation_id ?? "")).filter(Boolean))); // Collect unique recommendation ids.
  const recommendationFacts: any[] = []; // Collect recommendation facts.
  for (const recId of recommendationIds) { // Resolve each recommendation fact by recommendation_id.
    const rows = await fetchFactsByJsonPath( // Query recommendation facts.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='decision_recommendation_v1' AND (record_json::jsonb#>>'{payload,recommendation_id}')=$1", // Filter by recommendation_id.
      [recId] // Parameters.
    ); // End query.
    recommendationFacts.push(...rows); // Append normalized recommendation facts.
  } // End recommendation lookup loop.

  // 5b) Extend chain: operation_plan facts and transitions derived from approval / task bridge.
  const operationPlanFacts: any[] = []; // Collect operation_plan_v1 facts referenced by this export chain.
  const operationPlanIds = new Set<string>(); // Track unique operation_plan_id values for transition lookup.
  for (const rid of requestIds) { // Resolve operation plans by approval_request_id first.
    const rows = await fetchFactsByJsonPath( // Query operation plans linked to approval_request_id.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='operation_plan_v1' AND (record_json::jsonb#>>'{payload,approval_request_id}')=$1", // Filter by approval_request_id.
      [rid] // Parameters.
    ); // End query.
    operationPlanFacts.push(...rows); // Append operation plan facts.
  } // End approval_request-driven lookup.
  if (operationPlanFacts.length < 1) { // Fallback for chains where only act_task_id is stable.
    const fallbackRows = await fetchFactsByJsonPath( // Query operation plans linked by act_task_id.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='operation_plan_v1' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1", // Filter by act_task_id.
      [job.act_task_id] // Parameters.
    ); // End query.
    operationPlanFacts.push(...fallbackRows); // Append fallback operation plan facts.
  } // End fallback branch.
  for (const planFact of operationPlanFacts) { // Collect operation_plan_id values for transition lookup.
    const operationPlanId = String(planFact.record_json?.payload?.operation_plan_id ?? '').trim(); // Read operation_plan_id from payload.
    if (operationPlanId) operationPlanIds.add(operationPlanId); // Record non-empty operation_plan_id values.
  } // End plan id collection.
  const operationPlanTransitionFacts: any[] = []; // Collect operation_plan_transition_v1 facts.
  for (const operationPlanId of Array.from(operationPlanIds)) { // Query transitions per operation_plan_id.
    const rows = await fetchFactsByJsonPath( // Query transition facts.
      pool, // Pool for query.
      "(record_json::jsonb->>'type')='operation_plan_transition_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$1", // Filter by operation_plan_id.
      [operationPlanId] // Parameters.
    ); // End query.
    operationPlanTransitionFacts.push(...rows); // Append normalized transition facts.
  } // End transition lookup loop.

  // 6) Build evidence bundle (artifact) as a single JSON file (minimal serviceable v1).
  const evidence_fact_ids = [ // Build evidence fact id list (for acceptance_result_v1 refs).
    ...taskFacts.map((x: any) => x.fact_id), // Task fact ids.
    ...receiptFacts.map((x: any) => x.fact_id), // Receipt fact ids.
    ...decisionFacts.map((x: any) => x.fact_id), // Decision fact ids.
    ...requestFacts.map((x: any) => x.fact_id), // Request fact ids.
    ...recommendationLinkFacts.map((x: any) => x.fact_id), // Link fact ids.
    ...recommendationFacts.map((x: any) => x.fact_id), // Recommendation fact ids.
    ...operationPlanFacts.map((x: any) => x.fact_id), // Operation plan fact ids.
    ...operationPlanTransitionFacts.map((x: any) => x.fact_id) // Operation plan transition fact ids.
  ]; // End list.

  const recommendationApprovalLinks = recommendationLinkFacts.map((x: any) => ({ // Flatten recommendation->approval links for offline audit closure.
    recommendation_id: String(x.record_json?.payload?.recommendation_id ?? ""), // Upstream recommendation id.
    approval_request_id: String(x.record_json?.payload?.approval_request_id ?? ""), // Downstream approval request id.
    link_fact_id: String(x.fact_id ?? ""), // Fact id carrying this link.
    recommendation_fact_id: String(x.record_json?.payload?.recommendation_fact_id ?? "") // Source recommendation fact id when available.
  })).filter((x: any) => x.recommendation_id && x.approval_request_id); // Keep only complete link records.

  const recommendationTaskLinks = operationPlanFacts.map((x: any) => ({ // Flatten recommendation->task links through operation plans.
    recommendation_id: String(x.record_json?.payload?.recommendation_id ?? ""), // Upstream recommendation id.
    operation_plan_id: String(x.record_json?.payload?.operation_plan_id ?? ""), // Bridge operation plan id.
    act_task_id: String(x.record_json?.payload?.act_task_id ?? ""), // Downstream act task id when available.
    operation_plan_fact_id: String(x.fact_id ?? "") // Fact id of bridge operation plan.
  })).filter((x: any) => x.recommendation_id && x.act_task_id); // Keep only closed recommendation->task chains.

  const taskReceipts = receiptFacts.map((x: any) => ({ // Flatten task->receipt links for offline execution evidence closure.
    act_task_id: String(x.record_json?.payload?.act_task_id ?? ""), // Task id tied to this receipt.
    receipt_fact_id: String(x.fact_id ?? ""), // Receipt fact id.
    command_id: String(x.record_json?.payload?.command_id ?? "") // Command id when present.
  })).filter((x: any) => x.act_task_id && x.receipt_fact_id); // Keep only complete task->receipt links.

  const artifact_core = { // Define deterministic core (excludes generated_at_ts and sha256 fields).
    tenant_id: job.tenant_id, // Tenant triple: tenant_id.
    project_id: job.project_id, // Tenant triple: project_id.
    group_id: job.group_id, // Tenant triple: group_id.
    program_id: job.program_id ?? null, // Optional program binding.
    field_id: job.field_id ?? null, // Optional field binding.
    season_id: job.season_id ?? null, // Optional season binding.
    act_task_id: job.act_task_id, // Target act_task_id.
    template: job.template, // Template name.
    facts: { // Facts bundle.
      ao_act_task_v0: taskFacts, // Task facts list.
      ao_act_receipt_v0: receiptFacts, // Receipt facts list.
      approval_decision_v1: decisionFacts, // Decision facts list.
      approval_request_v1: requestFacts, // Request facts list.
      decision_recommendation_approval_link_v1: recommendationLinkFacts, // Recommendation->approval link facts.
      decision_recommendation_v1: recommendationFacts, // Recommendation facts.
      operation_plan_v1: operationPlanFacts, // Operation plan facts.
      operation_plan_transition_v1: operationPlanTransitionFacts // Operation plan transition facts.
    }, // End facts bundle.
    evidence_files: { // Stable logical file map for offline export consumers.
      "recommendation.json": recommendationFacts, // Primary recommendation file content.
      "approval.json": { // Approval closure data.
        approval_decision_v1: decisionFacts, // Approval decision facts.
        approval_request_v1: requestFacts // Approval request facts.
      },
      "plan.json": { // Plan closure data.
        operation_plan_v1: operationPlanFacts, // Operation plan facts.
        operation_plan_transition_v1: operationPlanTransitionFacts // Operation plan transition facts.
      },
      "task.json": taskFacts, // Task facts file content.
      "receipt.json": receiptFacts, // Receipt facts file content.
      "recommendation_approval_links.json": recommendationApprovalLinks, // recommendation -> approval_request links.
      "recommendation_task_links.json": recommendationTaskLinks, // recommendation -> task links.
      "task_receipts.json": taskReceipts // task -> receipt links.
    }, // End logical file map.
    manifest: { // Minimal manifest for human inspection.
      counts: { // Counts of each fact type included.
        ao_act_task_v0: taskFacts.length, // Count task facts.
        ao_act_receipt_v0: receiptFacts.length, // Count receipt facts.
        approval_decision_v1: decisionFacts.length, // Count decision facts.
        approval_request_v1: requestFacts.length, // Count request facts.
        decision_recommendation_approval_link_v1: recommendationLinkFacts.length, // Count link facts.
        decision_recommendation_v1: recommendationFacts.length, // Count recommendation facts.
        operation_plan_v1: operationPlanFacts.length, // Count operation plan facts.
        operation_plan_transition_v1: operationPlanTransitionFacts.length // Count operation plan transition facts.
      }, // End counts.
      files: [ // Logical files present in this evidence export payload.
        "recommendation.json",
        "approval.json",
        "plan.json",
        "task.json",
        "receipt.json",
        "recommendation_approval_links.json",
        "recommendation_task_links.json",
        "task_receipts.json"
      ],
      links: { // Closure link counts for recommendation -> approval -> operation_plan -> task -> receipt.
        recommendation_approval_links: recommendationApprovalLinks.length,
        recommendation_task_links: recommendationTaskLinks.length,
        task_receipts: taskReceipts.length
      },
      required_chain: { // Task Pack 7.1 mandatory bundle sections.
        recommendation: recommendationFacts.length,
        approval: decisionFacts.length + requestFacts.length,
        plan: operationPlanFacts.length + operationPlanTransitionFacts.length,
        task: taskFacts.length,
        receipt: receiptFacts.length
      },
      evidence_fact_ids // Flat list of all fact ids referenced by the artifact.
    } // End manifest.
  }; // End artifact_core.

  const requiredMissing: string[] = []; // Collect missing mandatory closure sections.
  if (recommendationFacts.length < 1) requiredMissing.push("recommendation");
  if (decisionFacts.length + requestFacts.length < 1) requiredMissing.push("approval");
  if (operationPlanFacts.length + operationPlanTransitionFacts.length < 1) requiredMissing.push("plan");
  if (taskFacts.length < 1) requiredMissing.push("task");
  if (receiptFacts.length < 1) requiredMissing.push("receipt");
  if (requiredMissing.length > 0) { // Reject export jobs without closed commercial chain evidence.
    throw new Error(`EVIDENCE_CHAIN_INCOMPLETE:${requiredMissing.join(",")}`);
  }

  const deterministic_hash = sha256HexBytes(Buffer.from(stableStringify(artifact_core), "utf8")); // Compute deterministic hash of artifact core.
  const generated_at_ts = Date.now(); // Record artifact generation time (non-deterministic audit field).

  const artifact = { // Full artifact object written to file.
    type: "evidence_pack_export_v1", // Artifact type marker for v1 export.
    schema_version: "1", // Version marker.
    generated_at_ts, // Generation time.
    deterministic_hash, // Deterministic hash of artifact_core.
    payload: artifact_core // Payload core.
  }; // End artifact object.

  // 6) Write artifact file under runtime/evidence_exports_v1 (runtime is excluded from git, safe for artifacts).
  const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..", ".."); // Resolve repo root from apps/server/src/routes.
  const outDir = path.join(repoRoot, "runtime", "evidence_exports_v1"); // Output directory for export artifacts.
  fs.mkdirSync(outDir, { recursive: true }); // Ensure output directory exists.

  const artifact_path = path.join(outDir, `${job.job_id}.json`); // Artifact file path for this job.
  const artifact_bytes = Buffer.from(JSON.stringify(artifact, null, 2), "utf8"); // Serialize artifact with stable formatting.
  fs.writeFileSync(artifact_path, artifact_bytes); // Write artifact bytes to disk (atomic enough for v1).

  const artifact_sha256 = sha256HexBytes(artifact_bytes); // Compute SHA-256 of the artifact bytes.
  job.artifact_path = artifact_path; // Record artifact path in job record.
  job.artifact_sha256 = artifact_sha256; // Record artifact sha256 in job record.
  job.stdout_tail = tailAppend(job.stdout_tail, `artifact:written sha256=${artifact_sha256}\n`); // Append log.

  // 7) Compute minimal acceptance_result_v1 and append it to facts ledger (append-only).
  const acceptance_fact_id = randomUUID(); // Generate new fact_id for append-only insert.
  const verdict = taskFacts.length > 0 ? "PASS" : "FAIL"; // Minimal template: task must exist.
  const acceptance_record = {
    type: "acceptance_result_v1",
    payload: GeoxContracts.AcceptanceResultV1PayloadSchema.parse({
      acceptance_id: acceptance_fact_id,
      tenant_id: job.tenant_id,
      project_id: job.project_id,
      group_id: job.group_id,
      program_id: job.program_id ?? undefined,
      field_id: job.field_id ?? "unknown_field",
      act_task_id: job.act_task_id,
      verdict,
      metrics: { coverage_ratio: verdict === "PASS" ? 1 : 0, in_field_ratio: 0, telemetry_delta: 0 },
      evidence_refs: evidence_fact_ids,
      evaluated_at: new Date().toISOString()
    })
  };

  await pool.query( // Insert acceptance_result_v1 fact into facts table (append-only).
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", // SQL insert.
    [acceptance_fact_id, "api/delivery/evidence_export/v1", acceptance_record] // Parameters.
  ); // End insert.

  job.acceptance_fact_id = acceptance_fact_id; // Record acceptance fact id in job.
  job.acceptance_result = acceptance_record.payload; // Store payload summary for status API.
  job.stdout_tail = tailAppend(job.stdout_tail, `acceptance:written fact_id=${acceptance_fact_id} verdict=${verdict}\n`); // Append log.

  // 8) Mark job done.
  job.state = "done"; // Mark done.
  job.updated_at = Date.now(); // Update timestamp.
} // End runEvidenceExportJob.


function createExportJob(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  act_task_id: string;
  template: string;
  program_id?: string;
  field_id?: string;
  season_id?: string;
}): ExportJob {
  const now = Date.now();
  const job_id = `exp_${now}_${randomUUID().replace(/-/g, "")}`;
  return {
    job_id,
    state: "queued",
    created_at: now,
    updated_at: now,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    program_id: input.program_id ?? null,
    field_id: input.field_id ?? null,
    season_id: input.season_id ?? null,
    act_task_id: input.act_task_id,
    template: input.template,
    artifact_path: null,
    artifact_sha256: null,
    stdout_tail: "job:queued\n",
    stderr_tail: "",
    acceptance_fact_id: null,
    acceptance_result: null,
    error: null
  };
}


function setLegacyDeprecatedWarning(reply: any): void {
  reply.header("Warning", '299 - "Deprecated API: use /api/v1/evidence-export/jobs"');
  reply.header("X-API-Deprecated", "true");
}

export function registerDeliveryEvidenceExportV1Routes(app: FastifyInstance, pool: Pool): void { // Register Sprint 26 evidence export API v1 routes.
  // POST /api/delivery/evidence_export/v1/jobs
  // Creates an async export job that produces an artifact and an acceptance_result_v1 fact.
  const createJobHandler = async (req: any, reply: any) => { // Create job endpoint (enqueue only).
    setLegacyDeprecatedWarning(reply);
    try { // Guard with try/catch for consistent 400 errors.
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.
      if (!auth) return; // Stop if auth failed (handler already replied).

      const body = z.object({ // Define body schema.
        tenant_id: z.string().min(1), // Tenant id.
        project_id: z.string().min(1), // Project id.
        group_id: z.string().min(1), // Group id.
        act_task_id: z.string().min(1), // AO-ACT act_task_id.
        program_id: z.string().min(1).optional(), // Optional program binding.
        field_id: z.string().min(1).optional(), // Optional field binding.
        season_id: z.string().min(1).optional(), // Optional season binding.
        template: z.string().min(1).default("ao_act_basic_v1") // Template name (default).
      }).parse((req as any).body ?? {}); // Parse request body.

      const tenant = { tenant_id: body.tenant_id, project_id: body.project_id, group_id: body.group_id }; // Normalize tenant triple.
      if (!requireTenantMatchOr404(auth, tenant, reply)) return; // Enforce tenant triple match (404 non-enumerable).

      const job = createExportJob({
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id: body.program_id,
        field_id: body.field_id,
        season_id: body.season_id,
        act_task_id: body.act_task_id,
        template: body.template
      });
      exportJobs.set(job.job_id, job);

      return reply.send({ ok: true, job_id: job.job_id });
    } catch (e: any) { // Catch parse errors.
      return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
    } // End catch.
  }; // End create job handler.

  app.post("/api/delivery/evidence_export/v1/jobs", createJobHandler); // Backward-compatible endpoint (deprecated: true).

  // GET /api/delivery/evidence_export/v1/jobs/:job_id
  // Returns job status + small result summary (including acceptance_result_v1 pointers).
  app.get("/api/delivery/evidence_export/v1/jobs/:job_id", async (req, reply) => { // Job status endpoint.
    setLegacyDeprecatedWarning(reply);
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.
    if (!auth) return; // Stop if auth failed.

    const p = (req as any).params ?? {}; // Read params.
    const job_id = typeof p.job_id === "string" ? p.job_id.trim() : ""; // Extract job id.
    const job = exportJobs.get(job_id); // Lookup job.
    if (!job) return reply.code(404).send({ ok: false, error: "NOT_FOUND" }); // 404 for missing job id.

    const tenant = { tenant_id: job.tenant_id, project_id: job.project_id, group_id: job.group_id }; // Job tenant triple.
    if (!requireTenantMatchOr404(auth, tenant, reply)) return; // Enforce tenant triple match (404 non-enumerable).

    return reply.send({ // Return job status payload.
      ok: true, // Success.
      job: { // Job summary (do not leak filesystem paths across tenant mismatch; guarded above).
        job_id: job.job_id, // Job id.
        state: job.state, // State.
        created_at: job.created_at, // Created timestamp.
        updated_at: job.updated_at, // Updated timestamp.
        tenant_id: job.tenant_id, // Tenant id.
        project_id: job.project_id, // Project id.
        group_id: job.group_id, // Group id.
        program_id: job.program_id, // Optional program id.
        field_id: job.field_id, // Optional field id.
        season_id: job.season_id, // Optional season id.
        act_task_id: job.act_task_id, // Act task id.
        template: job.template, // Template.
        artifact_sha256: job.artifact_sha256, // Artifact sha256.
        acceptance_fact_id: job.acceptance_fact_id, // Acceptance fact id.
        acceptance_result: job.acceptance_result, // Acceptance payload summary.
        stdout_tail: job.stdout_tail, // Stdout tail.
        stderr_tail: job.stderr_tail, // Stderr tail.
        error: job.error // Error message.
      } // End job.
    }); // End reply.
  }); // End status route.

  // GET /api/delivery/evidence_export/v1/jobs/:job_id/download
  // Streams the produced artifact file to client (JSON file for v1).
  const downloadHandler = async (req: any, reply: any) => { // Shared download handler for stable endpoint aliases.
    setLegacyDeprecatedWarning(reply);
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.
    if (!auth) return; // Stop if auth failed.

    const p = (req as any).params ?? {}; // Read params.
    const job_id = typeof p.job_id === "string" ? p.job_id.trim() : (typeof p.id === "string" ? p.id.trim() : ""); // Extract job id.
    const job = exportJobs.get(job_id); // Lookup job.
    if (!job) return reply.code(404).send({ ok: false, error: "NOT_FOUND" }); // 404 for missing job id.

    const tenant = { tenant_id: job.tenant_id, project_id: job.project_id, group_id: job.group_id }; // Job tenant triple.
    if (!requireTenantMatchOr404(auth, tenant, reply)) return; // Enforce tenant triple match (404 non-enumerable).

    if (job.state !== "done" || !job.artifact_path || !job.artifact_sha256) { // Require done + artifact fields.
      return reply.code(400).send({ ok: false, error: "ARTIFACT_NOT_READY" }); // Reject if not ready.
    } // End readiness check.

    if (!fs.existsSync(job.artifact_path)) { // Verify artifact file exists.
      return reply.code(500).send({ ok: false, error: "ARTIFACT_MISSING" }); // Server error if missing.
    } // End file existence check.

    const fileSha256 = sha256HexFile(job.artifact_path); // Recompute hash to enforce manifest integrity on download.
    if (fileSha256 !== job.artifact_sha256) { // Abort when artifact bytes diverge from recorded sha256(bundle).
      return reply.code(409).send({ ok: false, error: "BUNDLE_HASH_MISMATCH", expected_sha256: job.artifact_sha256, actual_sha256: fileSha256 });
    } // End integrity check.

    reply.header("content-type", "application/json"); // Serve JSON content type.
    reply.header("x-artifact-sha256", job.artifact_sha256); // Provide sha256(bundle) header for client verification.
    reply.header("content-disposition", `attachment; filename="${job.job_id}.json"`); // Provide download filename.

    const rs = fs.createReadStream(job.artifact_path); // Create read stream.
    return reply.send(rs); // Stream file to client.
  }; // End download handler.

  app.get("/api/delivery/evidence_export/v1/jobs/:job_id/download", downloadHandler); // Backward-compatible download route (deprecated: true).
  app.get("/evidence-export/jobs/:job_id/download", downloadHandler); // Stable alias with legacy param name.
} // End register routes.


export function fetchPendingJobs(): ExportJob[] {
  return [...exportJobs.values()].filter((job) => job.state === "queued");
}

export function markJobFailed(job: ExportJob, error: unknown): void {
  job.state = "error";
  job.error = String((error as any)?.message ?? error);
  job.stderr_tail = tailAppend(job.stderr_tail, `error:${job.error}\n`);
  job.updated_at = Date.now();
}

export async function runQueuedEvidenceExportJob(pool: Pool, job: ExportJob): Promise<void> {
  await runEvidenceExportJob(pool, job);
}
