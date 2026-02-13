// GEOX/apps/server/src/routes/delivery_evidence_export_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance type for route registration.
import type { Pool } from "pg"; // Postgres pool type for queries.
import path from "node:path"; // Node path utilities for joining paths.
import fs from "node:fs"; // Node filesystem utilities for writing artifacts.
import crypto from "node:crypto"; // Node crypto for SHA-256 hashing and UUIDs.
import { randomUUID } from "node:crypto"; // UUID generator for fact ids (append-only ledger).
import { z } from "zod"; // Zod schema validation for request parsing.

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
  act_task_id: string; // Target AO-ACT act_task_id to export.
  template: string; // Export template name (v1 allows explicit templates).
  artifact_path: string | null; // Filesystem path of the produced artifact (JSON bundle for v1).
  artifact_sha256: string | null; // SHA-256 hex of produced artifact bytes.
  stdout_tail: string; // Tail of job logs (human debugging, truncated).
  stderr_tail: string; // Tail of job errors (human debugging, truncated).
  acceptance_fact_id: string | null; // fact_id of acceptance_result_v1 created by this job.
  acceptance_result: any | null; // Small in-memory summary of the acceptance_result_v1 payload (for status endpoint).
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

  // 5) Build evidence bundle (artifact) as a single JSON file (minimal serviceable v1).
  const evidence_fact_ids = [ // Build evidence fact id list (for acceptance_result_v1 refs).
    ...taskFacts.map((x: any) => x.fact_id), // Task fact ids.
    ...receiptFacts.map((x: any) => x.fact_id), // Receipt fact ids.
    ...decisionFacts.map((x: any) => x.fact_id), // Decision fact ids.
    ...requestFacts.map((x: any) => x.fact_id) // Request fact ids.
  ]; // End list.

  const artifact_core = { // Define deterministic core (excludes generated_at_ts and sha256 fields).
    tenant_id: job.tenant_id, // Tenant triple: tenant_id.
    project_id: job.project_id, // Tenant triple: project_id.
    group_id: job.group_id, // Tenant triple: group_id.
    act_task_id: job.act_task_id, // Target act_task_id.
    template: job.template, // Template name.
    facts: { // Facts bundle.
      ao_act_task_v0: taskFacts, // Task facts list.
      ao_act_receipt_v0: receiptFacts, // Receipt facts list.
      approval_decision_v1: decisionFacts, // Decision facts list.
      approval_request_v1: requestFacts // Request facts list.
    }, // End facts bundle.
    manifest: { // Minimal manifest for human inspection.
      counts: { // Counts of each fact type included.
        ao_act_task_v0: taskFacts.length, // Count task facts.
        ao_act_receipt_v0: receiptFacts.length, // Count receipt facts.
        approval_decision_v1: decisionFacts.length, // Count decision facts.
        approval_request_v1: requestFacts.length // Count request facts.
      }, // End counts.
      evidence_fact_ids // Flat list of all fact ids referenced by the artifact.
    } // End manifest.
  }; // End artifact_core.

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
  const verdict = taskFacts.length > 0 ? "PASS" : "FAIL"; // Minimal template: task must exist.
  const acceptance_payload_core = { // Define deterministic acceptance core.
    tenant_id: job.tenant_id, // Tenant triple: tenant_id.
    project_id: job.project_id, // Tenant triple: project_id.
    group_id: job.group_id, // Tenant triple: group_id.
    act_task_id: job.act_task_id, // Target act_task_id.
    template: job.template, // Template name.
    verdict, // PASS/FAIL verdict.
    evidence_fact_ids, // Evidence pointers by fact_id.
    artifact_sha256, // Bind acceptance to produced artifact sha256.
    deterministic_hash: "" // Placeholder to be filled after hashing.
  }; // End acceptance core.

  const acceptance_deterministic_hash = sha256HexBytes(Buffer.from(stableStringify({ ...acceptance_payload_core, deterministic_hash: undefined }), "utf8")); // Compute deterministic hash without self-reference.
  acceptance_payload_core.deterministic_hash = acceptance_deterministic_hash; // Set deterministic_hash field.

  const acceptance_record = { // Build acceptance_result_v1 fact record_json object.
    type: "acceptance_result_v1", // Fact type marker.
    schema_version: "1", // Schema version marker.
    payload: { // Payload block.
      ...acceptance_payload_core, // Copy computed acceptance payload.
      computed_at_ts: Date.now() // Add audit timestamp (non-deterministic).
    } // End payload.
  }; // End acceptance record.

  const acceptance_fact_id = randomUUID(); // Generate new fact_id for append-only insert.
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

export function registerDeliveryEvidenceExportV1Routes(app: FastifyInstance, pool: Pool): void { // Register Sprint 26 evidence export API v1 routes.
  // POST /api/delivery/evidence_export/v1/jobs
  // Creates an async export job that produces an artifact and an acceptance_result_v1 fact.
  app.post("/api/delivery/evidence_export/v1/jobs", async (req, reply) => { // Create job endpoint.
    try { // Guard with try/catch for consistent 400 errors.
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.
      if (!auth) return; // Stop if auth failed (handler already replied).

      const body = z.object({ // Define body schema.
        tenant_id: z.string().min(1), // Tenant id.
        project_id: z.string().min(1), // Project id.
        group_id: z.string().min(1), // Group id.
        act_task_id: z.string().min(1), // AO-ACT act_task_id.
        template: z.string().min(1).default("ao_act_basic_v1") // Template name (default).
      }).parse((req as any).body ?? {}); // Parse request body.

      const tenant = { tenant_id: body.tenant_id, project_id: body.project_id, group_id: body.group_id }; // Normalize tenant triple.
      if (!requireTenantMatchOr404(auth, tenant, reply)) return; // Enforce tenant triple match (404 non-enumerable).

      const job_id = `exp_${Date.now()}_${randomUUID().replace(/-/g, "")}`; // Create job id with exp_ prefix.
      const job: ExportJob = { // Initialize job record.
        job_id, // Job id.
        state: "queued", // Initial state.
        created_at: Date.now(), // Creation timestamp.
        updated_at: Date.now(), // Update timestamp.
        tenant_id: tenant.tenant_id, // Tenant id.
        project_id: tenant.project_id, // Project id.
        group_id: tenant.group_id, // Group id.
        act_task_id: body.act_task_id, // Act task id.
        template: body.template, // Template name.
        artifact_path: null, // Not produced yet.
        artifact_sha256: null, // Not computed yet.
        stdout_tail: "job:queued\n", // Initial log.
        stderr_tail: "", // Initial stderr tail.
        acceptance_fact_id: null, // Not produced yet.
        acceptance_result: null, // Not produced yet.
        error: null // No error yet.
      }; // End job initialization.

      exportJobs.set(job_id, job); // Store job in map.

      // Kick off async execution without blocking request/response (best-effort in-process job runner).
      setImmediate(async () => { // Schedule job execution on event loop.
        try { // Catch errors inside job runner.
          await runEvidenceExportJob(pool, job); // Run job logic.
        } catch (e: any) { // Handle job failure.
          job.state = "error"; // Mark error.
          job.error = String(e?.message ?? e); // Store error message.
          job.stderr_tail = tailAppend(job.stderr_tail, `error:${job.error}\n`); // Append to stderr tail.
          job.updated_at = Date.now(); // Update timestamp.
        } // End catch.
      }); // End setImmediate.

      return reply.send({ ok: true, job_id }); // Return job id to client.
    } catch (e: any) { // Catch parse errors.
      return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
    } // End catch.
  }); // End create job route.

  // GET /api/delivery/evidence_export/v1/jobs/:job_id
  // Returns job status + small result summary (including acceptance_result_v1 pointers).
  app.get("/api/delivery/evidence_export/v1/jobs/:job_id", async (req, reply) => { // Job status endpoint.
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
  app.get("/api/delivery/evidence_export/v1/jobs/:job_id/download", async (req, reply) => { // Download endpoint.
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.
    if (!auth) return; // Stop if auth failed.

    const p = (req as any).params ?? {}; // Read params.
    const job_id = typeof p.job_id === "string" ? p.job_id.trim() : ""; // Extract job id.
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

    reply.header("content-type", "application/json"); // Serve JSON content type.
    reply.header("x-artifact-sha256", job.artifact_sha256); // Provide sha256 header for client verification.
    reply.header("content-disposition", `attachment; filename="${job.job_id}.json"`); // Provide download filename.

    const rs = fs.createReadStream(job.artifact_path); // Create read stream.
    return reply.send(rs); // Stream file to client.
  }); // End download route.
} // End register routes.