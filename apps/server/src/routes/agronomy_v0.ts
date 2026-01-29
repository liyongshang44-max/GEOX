// File: apps/server/src/routes/agronomy_v0.ts // Define Agronomy v0 routes and Sprint 14 interpretation append/read endpoints.

import type { FastifyInstance, FastifyPluginAsync } from "fastify"; // Import Fastify types for plugin registration.
import type { Pool } from "pg"; // Import pg Pool type for database access.
import crypto from "node:crypto"; // Import crypto for deterministic SHA-256 hashing.
import { randomUUID } from "node:crypto"; // Import UUID generator for append-only fact_id creation.
import { z } from "zod"; // Import Zod for request validation and parsing.

type SubjectRef = { projectId: string; groupId: string }; // Define group-scoped subject reference used by Agronomy v0 report endpoints.
type Window = { startTs: number; endTs: number }; // Define time window in epoch milliseconds (inclusive bounds).

type MetricStats = { // Define per-metric descriptive stats derived from raw_sample_v1 facts.
  metric: string; // Metric identifier (e.g. soil_moisture_vwc_30cm).
  count: number; // Number of samples observed for this metric.
  first_ts_ms: number; // Earliest timestamp for this metric in ms.
  last_ts_ms: number; // Latest timestamp for this metric in ms.
  first_value: number; // Value at earliest timestamp.
  last_value: number; // Value at latest timestamp.
  min_value: number; // Minimum value observed.
  max_value: number; // Maximum value observed.
  delta_value: number; // last_value - first_value.
};

export type EvidenceRef = { kind: string; ref_id: string }; // Define frozen v0 pointer: kind + ref_id only.

const AGRONOMY_INTERPRETATION_FORBID_KEYS = new Set<string>([ // Define forbidden keys (exact match) to block decision/control semantics in interpretation payloads.
  "problem_state_id", // Block ProblemState coupling.
  "lifecycle_state", // Block lifecycle coupling.
  "recommendation", // Block prescriptive/decision language.
  "suggestion", // Block prescriptive/decision language.
  "proposal", // Block prescriptive/decision language.
  "agronomy", // Block ambiguous “agronomy” nesting that may encode prescriptions.
  "prescription", // Block explicit prescriptions.
  "severity", // Block severity scoring semantics.
  "priority", // Block priority semantics.
  "expected_outcome", // Block outcome optimization semantics.
  "effectiveness", // Block effectiveness scoring semantics.
  "quality", // Block quality scoring semantics.
  "desirability", // Block desirability scoring semantics.
  "next_action", // Block action planning semantics.
  "follow_up", // Block action planning semantics.
  "autotrigger", // Block implicit triggering.
  "auto", // Block implicit triggering / automation.
  "success_criteria", // Block hidden optimization criteria.
  "success_score", // Block scoring semantics.
  "yield", // Block yield/profit objective coupling.
  "profit", // Block yield/profit objective coupling.
  "mode", // Block mode/preset semantics.
  "profile", // Block profile semantics.
  "preset" // Block preset semantics.
]); // End forbidden key set.

function scanForbiddenKeyRecursive(v: unknown): string | null { // Recursively scan a payload for forbidden keys (exact match, case-sensitive).
  if (v === null || v === undefined) return null; // Treat null/undefined as no hit.
  if (Array.isArray(v)) { // If the value is an array, scan each element.
    for (const it of v) { // Iterate array elements.
      const hit = scanForbiddenKeyRecursive(it); // Recurse into element.
      if (hit) return hit; // Return first hit found.
    } // End for.
    return null; // No hit in array.
  } // End array branch.
  if (typeof v === "object") { // If the value is an object, scan keys and values.
    const obj = v as Record<string, unknown>; // Treat as key/value record.
    for (const k of Object.keys(obj)) { // Iterate object keys.
      if (AGRONOMY_INTERPRETATION_FORBID_KEYS.has(k)) return k; // Reject on exact forbidden key match.
      const hit = scanForbiddenKeyRecursive(obj[k]); // Recurse into nested value.
      if (hit) return hit; // Return first nested hit.
    } // End for.
    return null; // No hit in object.
  } // End object branch.
  return null; // Primitives cannot contain keys, so no hit.
} // End scanForbiddenKeyRecursive.

function mustString(q: unknown, name: string): string { // Validate a query param as a non-empty string.
  if (typeof q !== "string" || q.trim() === "") throw new Error(`missing_or_invalid_${name}`); // Enforce non-empty string.
  return q; // Return validated string.
} // End mustString.

function mustInt(q: unknown, name: string): number { // Validate a query param as an integer-like value.
  const s = mustString(q, name); // Ensure it is a string first.
  const n = Number(s); // Convert to number.
  if (!Number.isFinite(n) || Math.floor(n) !== n) throw new Error(`missing_or_invalid_${name}`); // Enforce finite integer.
  return n; // Return validated integer.
} // End mustInt.

function stableStringify(v: unknown): string { // Deterministic JSON stringify with stable key ordering.
  const seen = new WeakSet<object>(); // Track visited objects to guard against cycles.
  const helper = (x: any): any => { // Recursive normalizer for stable serialization.
    if (x === null || typeof x !== "object") return x; // Pass-through primitives.
    if (x instanceof Date) return x.toISOString(); // Normalize Date to ISO string.
    if (Array.isArray(x)) return x.map(helper); // Preserve array order, normalize elements.
    if (seen.has(x)) return "[Circular]"; // Guard against circular refs (should not occur).
    seen.add(x); // Mark object as seen.
    const keys = Object.keys(x).sort(); // Sort keys for deterministic output.
    const out: Record<string, any> = {}; // Create normalized output object.
    for (const k of keys) out[k] = helper(x[k]); // Normalize each property value.
    return out; // Return normalized object.
  }; // End helper.
  return JSON.stringify(helper(v)); // Serialize normalized structure to JSON.
} // End stableStringify.

function sha256Hex(s: string): string { // Compute SHA-256 hex digest of input string.
  return crypto.createHash("sha256").update(s).digest("hex"); // Return SHA-256 hex digest.
} // End sha256Hex.

function parseRecordJson(rowValue: unknown): any { // Parse facts.record_json (may be string or already-object depending on driver).
  if (rowValue === null || rowValue === undefined) return null; // Treat null/undefined as missing.
  if (typeof rowValue === "object") return rowValue; // If already parsed by driver, return as-is.
  if (typeof rowValue !== "string" || rowValue.trim() === "") return null; // Reject empty/non-string.
  try { // Attempt JSON parsing.
    return JSON.parse(rowValue); // Parse JSON string into object.
  } catch { // Catch parse errors.
    return null; // Fail-closed to null.
  } // End catch.
} // End parseRecordJson.

async function fetchFactByFactId(pool: Pool, factId: string): Promise<any | null> { // Read a single fact row by fact_id (ledger read-only).
  const sql = `SELECT fact_id, occurred_at, source, record_json FROM facts WHERE fact_id = $1 LIMIT 1`; // Primary-key lookup by fact_id.
  const r = await pool.query(sql, [factId]); // Execute query using pool.
  if (r.rowCount === 0) return null; // Return null if not found.
  const row: any = r.rows[0]; // Extract first row.
  const record = parseRecordJson(row.record_json); // Parse record_json column.
  if (!record) return null; // Fail-closed if JSON is malformed.
  return { fact_id: String(row.fact_id), occurred_at: row.occurred_at, source: String(row.source), record_json: record }; // Return normalized fact row.
} // End fetchFactByFactId.

function buildDeterministicInterpretationId(receiptFactId: string, receiptRecordJson: any): string { // Compute a deterministic interpretation id from receipt fact.
  const core = { receipt_fact_id: receiptFactId, receipt: receiptRecordJson }; // Define deterministic hash core.
  const h = sha256Hex(stableStringify(core)); // Compute deterministic SHA-256 hash.
  return `agr_aoact_${h.slice(0, 24)}`; // Return stable id with fixed prefix and hash prefix.
} // End buildDeterministicInterpretationId.

async function fetchRawSampleFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load raw_sample_v1 facts for a window (ledger-based).
  const sql = `
    SELECT record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'raw_sample_v1'
      AND (record_json::jsonb->'entity'->>'project_id') = $1
      AND (record_json::jsonb->'entity'->>'group_id') = $2
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint >= $3
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint <= $4
  `; // Query facts ledger for raw_sample_v1 within time window.
  const rows = await pool.query(sql, [subject.projectId, subject.groupId, window.startTs, window.endTs]); // Execute read-only query.
  return rows.rows.map((r) => parseRecordJson((r as any).record_json)).filter((x) => x); // Parse record_json and filter nulls.
} // End fetchRawSampleFacts.

async function fetchMarkerFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load marker_v1 facts intersecting the window (ledger-based).
  const sql = `
    SELECT record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'marker_v1'
      AND (record_json::jsonb->'entity'->>'project_id') = $1
      AND (record_json::jsonb->'entity'->>'group_id') = $2
      AND (record_json::jsonb->'payload'->'time_range'->>'startTs')::bigint <= $4
      AND (record_json::jsonb->'payload'->'time_range'->>'endTs')::bigint >= $3
  `; // Overlap predicate: marker_range intersects [startTs, endTs].
  const rows = await pool.query(sql, [subject.projectId, subject.groupId, window.startTs, window.endTs]); // Execute read-only query.
  return rows.rows.map((r) => parseRecordJson((r as any).record_json)).filter((x) => x); // Parse record_json and filter nulls.
} // End fetchMarkerFacts.

function computeMetricStats(rawFacts: any[]): MetricStats[] { // Compute per-metric descriptive stats from raw_sample_v1 facts.
  const byMetric = new Map<string, { ts: number; v: number }[]>(); // Group samples by metric identifier.
  for (const f of rawFacts) { // Iterate over raw_sample facts.
    const metric = f?.payload?.metric; // Read metric id from payload.
    const ts = Number(f?.payload?.ts_ms); // Read sample timestamp in ms.
    const v = Number(f?.payload?.value); // Read sample value.
    if (typeof metric !== "string" || metric.trim() === "") continue; // Skip invalid metric ids.
    if (!Number.isFinite(ts) || !Number.isFinite(v)) continue; // Skip invalid numeric fields.
    if (!byMetric.has(metric)) byMetric.set(metric, []); // Create bucket for metric if missing.
    byMetric.get(metric)!.push({ ts, v }); // Append sample to metric bucket.
  } // End for.

  const out: MetricStats[] = []; // Prepare output list.
  const entries = [...byMetric.entries()].sort(([a], [b]) => a.localeCompare(b)); // Sort metrics deterministically.
  for (const [metric, arr] of entries) { // Compute stats per metric.
    arr.sort((a, b) => a.ts - b.ts); // Sort samples by timestamp.
    const first = arr[0]; // Select earliest sample.
    const last = arr[arr.length - 1]; // Select latest sample.
    let min = first.v; // Initialize minimum value.
    let max = first.v; // Initialize maximum value.
    for (const s of arr) { // Scan samples to compute min/max.
      if (s.v < min) min = s.v; // Update min.
      if (s.v > max) max = s.v; // Update max.
    } // End scan loop.
    out.push({ // Push computed metric stats.
      metric, // Metric id.
      count: arr.length, // Count of samples.
      first_ts_ms: first.ts, // Earliest timestamp.
      last_ts_ms: last.ts, // Latest timestamp.
      first_value: first.v, // Value at earliest timestamp.
      last_value: last.v, // Value at latest timestamp.
      min_value: min, // Minimum observed value.
      max_value: max, // Maximum observed value.
      delta_value: last.v - first.v // Simple change over window.
    }); // End push.
  } // End for.
  return out; // Return computed stats list.
} // End computeMetricStats.

function buildEvidenceRefsFromInputs(metricStats: MetricStats[], markers: any[]): EvidenceRef[] { // Build neutral evidence pointers (pointer-only, no prescriptions).
  const seen = new Set<string>(); // Track duplicates.
  const out: EvidenceRef[] = []; // Output pointer list.

  const push = (kind: string, ref_id: string) => { // Helper to add unique pointers.
    if (typeof kind !== "string" || kind.trim() === "") return; // Require non-empty kind.
    if (typeof ref_id !== "string" || ref_id.trim() === "") return; // Require non-empty ref_id.
    const k = `${kind}::${ref_id}`; // Create stable composite key.
    if (seen.has(k)) return; // Skip duplicates.
    seen.add(k); // Record key.
    out.push({ kind, ref_id }); // Append evidence ref.
  }; // End push.

  for (const s of metricStats) { // Add pointers for each metric summary.
    push("metric_summary", s.metric); // Use metric id as ref_id pointer.
  } // End for.

  for (const m of markers) { // Add pointers for each marker id (if present).
    const markerId = m?.marker_id ?? m?.payload?.marker_id ?? null; // Probe common marker id locations.
    if (typeof markerId === "string" && markerId.trim() !== "") push("marker_id", markerId); // Add marker id pointer.
  } // End for.

  out.sort((a, b) => (a.kind !== b.kind ? a.kind.localeCompare(b.kind) : a.ref_id.localeCompare(b.ref_id))); // Sort pointers deterministically.
  return out; // Return evidence pointer list.
} // End buildEvidenceRefsFromInputs.

function buildReportIds( // Compute deterministic report id/hash used consistently across endpoints.
  subject: SubjectRef, // Subject scope for report.
  window: Window, // Time window for report.
  metricStats: MetricStats[], // Metric stats used in report.
  markers: any[] // Markers used in report.
): { report_id: string; determinism_hash: string } {
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Build deterministic marker kind list.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Build deterministic evidence pointers.

  const reportCore = { // Define report core for hashing (must be stable).
    type: "agronomy_report_v0", // Contract type marker.
    schema_version: "0", // Contract version marker.
    subjectRef: subject, // Subject scope.
    window, // Window scope.
    evidence: { // Evidence summary block.
      metric_stats: metricStats, // Metric stats.
      marker_kinds: markerKinds, // Marker kinds list.
      marker_count: markers.length, // Marker count.
      evidence_refs // Evidence pointer list.
    }
  }; // End reportCore.

  const determinism_hash = sha256Hex(stableStringify(reportCore)); // Compute deterministic hash from stable JSON.
  const report_id = `ar_${determinism_hash.slice(0, 24)}`; // Compute deterministic report id from hash prefix.
  return { report_id, determinism_hash }; // Return report id and hash.
} // End buildReportIds.

function buildReport(subject: SubjectRef, window: Window, metricStats: MetricStats[], markers: any[]): any { // Build full report payload (read-only).
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Compute deterministic marker kinds.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Compute evidence refs.

  const reportCore = { // Build core report without ids.
    type: "agronomy_report_v0", // Report contract type.
    schema_version: "0", // Report contract version.
    subjectRef: subject, // Subject scope.
    window, // Window.
    evidence: { // Evidence block.
      metric_stats: metricStats, // Per-metric stats.
      marker_kinds: markerKinds, // Marker kinds present.
      marker_count: markers.length, // Marker count.
      evidence_refs // Evidence refs list.
    }
  }; // End reportCore.

  const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Compute ids deterministically from same inputs.
  return { ...reportCore, report_id, determinism_hash }; // Return report with ids and hash.
} // End buildReport.

export function buildAgronomyV0Routes(pool: Pool): FastifyPluginAsync { // Build Fastify plugin for Agronomy v0 + Sprint 13/14 endpoints.
  const plugin: FastifyPluginAsync = async (app: FastifyInstance) => { // Register routes onto Fastify instance.

    app.get("/api/agronomy/v0/report", async (req, reply) => { // Provide full deterministic agronomy report for a window.
      try { // Guard with try/catch for consistent 400 errors.
        const q: any = (req as any).query ?? {}; // Read query object.
        const subject: SubjectRef = { // Parse subjectRef fields.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        }; // End subject parse.
        const window: Window = { // Parse window fields.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        }; // End window parse.
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute metric stats.
        const report = buildReport(subject, window, metricStats, markers); // Build deterministic report.

        return reply.send(report); // Return report JSON.
      } catch (e: any) { // Catch input/processing errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error payload.
      } // End catch.
    }); // End /report route.

    app.get("/api/agronomy/v0/summary", async (req, reply) => { // Provide stable report_id/hash and counts for a window.
      try { // Guard with try/catch.
        const q: any = (req as any).query ?? {}; // Read query.
        const subject: SubjectRef = { // Parse subject.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        }; // End subject.
        const window: Window = { // Parse window.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        }; // End window.
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute stats.
        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Compute deterministic ids.

        return reply.send({ // Return summary payload.
          type: "agronomy_report_summary_v0", // Summary contract type.
          schema_version: "0", // Summary version.
          report_id, // Deterministic report id.
          determinism_hash, // Deterministic hash.
          subjectRef: subject, // Echo subject.
          window, // Echo window.
          metric_count: metricStats.length, // Metric count.
          marker_count: markers.length // Marker count.
        }); // End reply.
      } catch (e: any) { // Catch errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
      } // End catch.
    }); // End /summary route.

    app.get("/api/agronomy/v0/evidence_refs", async (req, reply) => { // Provide pointer-only evidence refs for a window.
      try { // Guard with try/catch.
        const q: any = (req as any).query ?? {}; // Read query.
        const subject: SubjectRef = { // Parse subject.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        }; // End subject.
        const window: Window = { // Parse window.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        }; // End window.
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markerFacts = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute stats.

        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markerFacts); // Compute deterministic ids.
        const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markerFacts); // Compute pointer list.

        return reply.send({ // Return evidence refs payload.
          type: "agronomy_evidence_refs_v0", // Evidence refs contract type.
          schema_version: "0", // Evidence refs version.
          report_id, // Must match report.
          determinism_hash, // Must match report.
          evidence_refs // Evidence pointer list.
        }); // End reply.
      } catch (e: any) { // Catch errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
      } // End catch.
    }); // End /evidence_refs route.

    app.post("/api/agronomy/v0/ao_act/interpretation", async (req, reply) => { // Sprint 13: write a read-only interpretation fact derived from an AO-ACT receipt fact (no AO-ACT mutation).
      try { // Guard with try/catch.
        const body = z.object({ // Define input schema.
          receipt_fact_id: z.string().min(1), // Receipt fact_id pointer to interpret (ledger read).
          meta: z.record(z.any()).optional() // Optional audit meta for this interpretation write.
        }).parse((req as any).body ?? {}); // Parse request body.

        const receiptRow = await fetchFactByFactId(pool, body.receipt_fact_id); // Load receipt fact row from ledger.
        if (!receiptRow) return reply.code(400).send({ ok: false, error: "UNKNOWN_RECEIPT_FACT" }); // Require receipt fact existence.

        const receiptRecord = receiptRow.record_json; // Extract parsed receipt record_json.
        if (receiptRecord?.type !== "ao_act_receipt_v0") return reply.code(400).send({ ok: false, error: "RECEIPT_FACT_TYPE_MISMATCH" }); // Enforce AO-ACT receipt type.

        const interpretation_id = buildDeterministicInterpretationId(body.receipt_fact_id, receiptRecord); // Compute deterministic interpretation id.
        const created_at_ts = Date.now(); // Create local audit timestamp for payload.

        const record_json = { // Build ledger record_json payload.
          type: "agronomy_ao_act_receipt_interpretation_v0", // Fact type for Sprint 13 (Agronomy-only, append-only).
          schema_version: "0", // Schema version marker.
          payload: { // Payload block.
            interpretation_id, // Deterministic interpretation id.
            receipt_fact_id: body.receipt_fact_id, // Pointer to source receipt fact.
            act_task_id: receiptRecord?.payload?.act_task_id ?? null, // Echo act_task_id (pointer-like field).
            status: receiptRecord?.payload?.status ?? null, // Echo status (non-prescriptive).
            execution_time: receiptRecord?.payload?.execution_time ?? null, // Echo execution_time.
            execution_coverage: receiptRecord?.payload?.execution_coverage ?? null, // Echo execution_coverage.
            constraint_check: receiptRecord?.payload?.constraint_check ?? null, // Echo constraint_check.
            observed_parameters: receiptRecord?.payload?.observed_parameters ?? null, // Echo observed_parameters.
            created_at_ts, // Creation time in ms.
            meta: body.meta // Optional audit meta.
          } // End payload.
        }; // End record_json.

        const fact_id = randomUUID(); // Generate new fact id for append-only ledger write.
        const source = "agronomy_v0"; // Mark facts.source for provenance.

        await pool.query( // Append-only insert into facts ledger.
          "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", // SQL insert.
          [fact_id, source, record_json] // SQL parameters.
        ); // End insert.

        return reply.send({ ok: true, fact_id, interpretation_id }); // Return created fact pointer + deterministic id.
      } catch (e: any) { // Catch parse/insert errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
      } // End catch.
    }); // End Sprint 13 write route.

    app.get("/api/agronomy/v0/ao_act/interpretation", async (req, reply) => { // Sprint 13: read interpretations by interpretation_id (read-only).
      try { // Guard with try/catch.
        const q = z.object({ // Define query schema.
          interpretation_id: z.string().min(1) // Required interpretation id.
        }).parse((req as any).query ?? {}); // Parse query.

        const sql = `
          SELECT fact_id, occurred_at, source, record_json
          FROM facts
          WHERE (record_json::jsonb->>'type') = 'agronomy_ao_act_receipt_interpretation_v0'
            AND (record_json::jsonb#>>'{payload,interpretation_id}') = $1
          ORDER BY occurred_at DESC, fact_id DESC
          LIMIT 20
        `; // Deterministic ordering for stable reads.

        const r = await pool.query(sql, [q.interpretation_id]); // Execute ledger read.
        const rows = r.rows.map((row: any) => ({ // Normalize rows.
          fact_id: String(row.fact_id), // Fact id.
          occurred_at: row.occurred_at, // Occurred time.
          source: String(row.source), // Source string.
          record_json: parseRecordJson(row.record_json) // Parsed record_json.
        })); // End map.

        return reply.send({ ok: true, rows }); // Return rows.
      } catch (e: any) { // Catch errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
      } // End catch.
    }); // End Sprint 13 read route.

    // Sprint 14: agronomy_interpretation_v1 minimal append-only write endpoint (contract: explain-only, non-executing semantics).
    app.post("/api/agronomy/interpretation_v1/append", async (req, reply) => { // Append an agronomy_interpretation_v1 fact into the ledger.
      try { // Guard with try/catch for consistent 400 errors.
        const bodyRaw = (req as any).body ?? {}; // Read raw request body (Fastify JSON).
        const hit = scanForbiddenKeyRecursive(bodyRaw); // Recursively scan for forbidden keys (write-side redline).
        if (hit) return reply.code(400).send({ ok: false, error: `FORBIDDEN_KEY:${hit}` }); // Reject immediately on forbidden key.

        const body = z.object({ // Define minimal contract input schema.
          subject_ref: z.object({ groupId: z.string().min(1) }), // Require group-scoped subject reference (minimal).
          dimension: z.string().min(1), // Require interpretation dimension label.
          description: z.string().min(1), // Require human-readable explanation (non-executable).
          evidence_refs: z.array(z.object({ kind: z.string().min(1), ref: z.string().min(1) })).min(1), // Require at least one evidence pointer (external shape uses "ref").
          confidence: z.number().min(0).max(1), // Confidence is descriptive, not an action threshold.
          meta: z.record(z.any()).optional() // Optional meta (still subject to forbid scan above).
        }).parse(bodyRaw); // Parse and validate request.

        const evidence_refs = body.evidence_refs.map((x) => ({ // Map external evidence pointer shape to internal canonical shape.
          kind: x.kind, // Preserve evidence kind label.
          ref_id: x.ref // Normalize external "ref" into internal "ref_id".
        })); // End evidence ref normalization.

        const created_at_ts = Date.now(); // Create local payload timestamp (facts.occurred_at remains authoritative).
        const record_json = { // Build facts.record_json for append-only ledger write.
          type: "agronomy_interpretation_v1", // Contract type marker.
          schema_version: "1.0.0", // Schema version marker for governance and future migration safety.
          payload: { // Payload block.
            subject_ref: body.subject_ref, // Subject reference.
            dimension: body.dimension, // Interpretation dimension.
            description: body.description, // Explanation text.
            evidence_refs, // Canonical evidence pointers: {kind, ref_id}.
            confidence: body.confidence, // Confidence value.
            created_at_ts, // Payload created timestamp.
            meta: body.meta // Optional meta.
          } // End payload.
        }; // End record_json.

        const fact_id = randomUUID(); // Generate new append-only fact id.
        const source = "agronomy_interpretation_v1"; // Tag facts.source for provenance.

        await pool.query( // Insert into ledger (append-only).
          "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", // SQL insert.
          [fact_id, source, record_json] // SQL args.
        ); // End insert.

        return reply.send({ ok: true, fact_id }); // Return ok + fact id pointer.
      } catch (e: any) { // Catch validation/db errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error payload.
      } // End catch.
    }); // End Sprint 14 append route.

    // Sprint 14: explain-only read endpoint (read-only; returns interpretations for a group, newest first).
    app.get("/api/agronomy/interpretation_v1/explain", async (req, reply) => { // Return explain-only interpretations without executable semantics.
      try { // Guard with try/catch.
        const q = z.object({ // Define query schema.
          groupId: z.string().min(1), // Require group id to scope the query.
          limit: z.string().optional() // Optional limit as string for query parsing consistency.
        }).parse((req as any).query ?? {}); // Parse query.

        const limitNum = q.limit ? Math.max(1, Math.min(100, Number(q.limit))) : 20; // Clamp limit to [1..100] with default 20.
        if (!Number.isFinite(limitNum)) throw new Error("missing_or_invalid_limit"); // Enforce numeric limit if provided.

        const sql = `
          SELECT fact_id, occurred_at, source, record_json
          FROM facts
          WHERE (record_json::jsonb->>'type') = 'agronomy_interpretation_v1'
            AND (record_json::jsonb#>>'{payload,subject_ref,groupId}') = $1
          ORDER BY occurred_at DESC, fact_id DESC
          LIMIT $2
        `; // Deterministic ordering: occurred_at then fact_id.

        const r = await pool.query(sql, [q.groupId, limitNum]); // Execute read-only query.
        const rows = r.rows.map((row: any) => ({ // Normalize rows for response.
          fact_id: String(row.fact_id), // Fact id.
          occurred_at: row.occurred_at, // Occurred time.
          source: String(row.source), // Source.
          record_json: parseRecordJson(row.record_json) // Parsed record_json.
        })); // End map.

        return reply.send({ ok: true, rows }); // Return explain-only rows.
      } catch (e: any) { // Catch errors.
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return standardized error.
      } // End catch.
    }); // End Sprint 14 explain read route.

  }; // End plugin function.

  return plugin; // Return Fastify plugin for registration.
} // End buildAgronomyV0Routes.

export function registerAgronomyV0Routes(app: FastifyInstance, pool: Pool) { // Provide register helper to match server.ts patterns.
  app.register(buildAgronomyV0Routes(pool)); // Register plugin with shared PG pool.
} // End registerAgronomyV0Routes.
