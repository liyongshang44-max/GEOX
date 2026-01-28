import type { FastifyInstance, FastifyPluginAsync } from "fastify"; // Fastify types for plugin + instance.
import type { Pool } from "pg"; // Postgres pool type for queries.
import crypto from "node:crypto"; // Node crypto for deterministic SHA-256 hashing.
import type { FastifyInstance, FastifyPluginAsync } from "fastify"; // Fastify types for plugin + instance.
import type { Pool } from "pg"; // Postgres pool type for queries.
import crypto from "node:crypto"; // Node crypto for deterministic SHA-256 hashing.
import { randomUUID } from "node:crypto"; // Generate UUIDs for new facts written by Agronomy (append-only ledger).
import { z } from "zod"; // Zod schema validation for request parsing.

type SubjectRef = { projectId: string; groupId: string }; // Group-scoped subject reference for agronomy reads.
type Window = { startTs: number; endTs: number }; // Time window in epoch milliseconds (inclusive bounds).

type MetricStats = { // Per-metric descriptive stats derived from raw_sample_v1 facts.
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

export type EvidenceRef = { kind: string; ref_id: string }; // Frozen v0 pointer: kind + ref_id only.

function mustString(q: unknown, name: string): string { // Validate a query param as a non-empty string.
  if (typeof q !== "string" || q.trim() === "") throw new Error(`missing_or_invalid_${name}`); // Enforce non-empty string.
  return q; // Return validated string.
}

function mustInt(q: unknown, name: string): number { // Validate a query param as an integer-like value.
  const s = mustString(q, name); // Ensure it is a string first.
  const n = Number(s); // Convert to number.
  if (!Number.isFinite(n) || Math.floor(n) !== n) throw new Error(`missing_or_invalid_${name}`); // Enforce finite integer.
  return n; // Return validated integer.
}

function stableStringify(v: unknown): string { // Deterministic JSON stringify with stable key ordering.
  const seen = new WeakSet<object>(); // Track visited objects to guard against cycles.
  const helper = (x: any): any => { // Recursive normalizer.
    if (x === null || typeof x !== "object") return x; // Pass-through primitives.
    if (x instanceof Date) return x.toISOString(); // Normalize Date to ISO.
    if (Array.isArray(x)) return x.map(helper); // Preserve array order, normalize elements.
    if (seen.has(x)) return "[Circular]"; // Guard against circular refs (should not occur).
    seen.add(x); // Mark object as seen.
    const keys = Object.keys(x).sort(); // Sort keys for deterministic output.
    const out: Record<string, any> = {}; // Create normalized object.
    for (const k of keys) out[k] = helper(x[k]); // Normalize each property.
    return out; // Return normalized object.
  };
  return JSON.stringify(helper(v)); // Serialize normalized structure to JSON.
}

function sha256Hex(s: string): string { // SHA-256 hex digest of input string.
  return crypto.createHash("sha256").update(s).digest("hex"); // Return hex digest.
}

function parseRecordJson(rowValue: unknown): any { // Parse facts.record_json (may be string or already-object depending on driver/schema).
  if (rowValue === null || rowValue === undefined) return null; // Treat null/undefined as missing.
  if (typeof rowValue === "object") return rowValue; // If already parsed by driver, return as-is.
  if (typeof rowValue !== "string" || rowValue.trim() === "") return null; // Reject empty/non-string.
  try {
    return JSON.parse(rowValue); // Parse JSON string.
  } catch {
    return null; // Fail-closed to null.
  }
}
async function fetchFactByFactId(pool: Pool, factId: string): Promise<any | null> { // Read a single fact row by fact_id (ledger read-only).
  const sql = `SELECT fact_id, occurred_at, source, record_json FROM facts WHERE fact_id = $1 LIMIT 1`; // Simple primary-key lookup.
  const r = await pool.query(sql, [factId]); // Execute query.
  if (r.rowCount === 0) return null; // Not found.
  const row: any = r.rows[0]; // Extract row.
  const record = parseRecordJson(row.record_json); // Parse record_json.
  if (!record) return null; // Fail-closed if JSON is malformed.
  return { fact_id: String(row.fact_id), occurred_at: row.occurred_at, source: String(row.source), record_json: record }; // Return normalized row.
}

function buildDeterministicInterpretationId(receiptFactId: string, receiptRecordJson: any): string { // Compute a deterministic interpretation id from receipt fact.
  const core = { receipt_fact_id: receiptFactId, receipt: receiptRecordJson }; // Deterministic core payload.
  const h = sha256Hex(stableStringify(core)); // Deterministic hash.
  return `agr_aoact_${h.slice(0, 24)}`; // Stable id with fixed prefix and hash prefix.
}

async function fetchRawSampleFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load raw_sample_v1 facts from ledger for a window.
  const sql = `
    SELECT record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'raw_sample_v1'
      AND (record_json::jsonb->'entity'->>'project_id') = $1
      AND (record_json::jsonb->'entity'->>'group_id') = $2
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint >= $3
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint <= $4
  `; // Use facts ledger so we do not depend on projections.
  const rows = await pool.query(sql, [subject.projectId, subject.groupId, window.startTs, window.endTs]); // Execute read-only query.
  return rows.rows.map((r) => parseRecordJson((r as any).record_json)).filter((x) => x); // Parse and filter non-null.
}

async function fetchMarkerFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load marker_v1 facts intersecting the window.
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
  return rows.rows.map((r) => parseRecordJson((r as any).record_json)).filter((x) => x); // Parse and filter non-null.
}

function computeMetricStats(rawFacts: any[]): MetricStats[] { // Compute descriptive per-metric statistics from raw_sample_v1 facts.
  const byMetric = new Map<string, { ts: number; v: number }[]>(); // Group samples by metric id.
  for (const f of rawFacts) { // Walk facts.
    const metric = f?.payload?.metric; // Extract metric id.
    const ts = Number(f?.payload?.ts_ms); // Extract timestamp.
    const v = Number(f?.payload?.value); // Extract value.
    if (typeof metric !== "string" || metric.trim() === "") continue; // Skip invalid metric id.
    if (!Number.isFinite(ts) || !Number.isFinite(v)) continue; // Skip invalid numeric values.
    if (!byMetric.has(metric)) byMetric.set(metric, []); // Create bucket if missing.
    byMetric.get(metric)!.push({ ts, v }); // Append sample.
  }

  const out: MetricStats[] = []; // Output stats list.
  const entries = [...byMetric.entries()].sort(([a], [b]) => a.localeCompare(b)); // Deterministic metric order.
  for (const [metric, arr] of entries) { // Compute stats per metric.
    arr.sort((a, b) => a.ts - b.ts); // Sort by time.
    const first = arr[0]; // Earliest sample.
    const last = arr[arr.length - 1]; // Latest sample.
    let min = first.v; // Initialize min.
    let max = first.v; // Initialize max.
    for (const s of arr) { // Scan all values.
      if (s.v < min) min = s.v; // Update min.
      if (s.v > max) max = s.v; // Update max.
    }
    out.push({ // Push computed stats.
      metric, // Metric id.
      count: arr.length, // Sample count.
      first_ts_ms: first.ts, // Earliest timestamp.
      last_ts_ms: last.ts, // Latest timestamp.
      first_value: first.v, // Value at earliest timestamp.
      last_value: last.v, // Value at latest timestamp.
      min_value: min, // Minimum observed value.
      max_value: max, // Maximum observed value.
      delta_value: last.v - first.v // Simple change.
    });
  }
  return out; // Return stats list.
}

function buildEvidenceRefsFromInputs(metricStats: MetricStats[], markers: any[]): EvidenceRef[] { // Build neutral evidence pointers from computed inputs.
  const seen = new Set<string>(); // Dedup key set.
  const out: EvidenceRef[] = []; // Output evidence pointer list.

  const push = (kind: string, ref_id: string) => { // Push if valid and not duplicate.
    if (typeof kind !== "string" || kind.trim() === "") return; // Require non-empty kind.
    if (typeof ref_id !== "string" || ref_id.trim() === "") return; // Require non-empty ref_id.
    const k = `${kind}::${ref_id}`; // Stable composite key.
    if (seen.has(k)) return; // Skip duplicates.
    seen.add(k); // Record key.
    out.push({ kind, ref_id }); // Append pointer.
  };

  for (const s of metricStats) { // Reference each metric id.
    push("metric_summary", s.metric); // Use metric id as ref_id.
  }

  for (const m of markers) { // Reference marker facts by marker_id if available.
    const markerId = m?.marker_id ?? m?.payload?.marker_id ?? null; // Probe common locations.
    if (typeof markerId === "string" && markerId.trim() !== "") push("marker_id", markerId); // Push marker id.
  }

  out.sort((a, b) => (a.kind !== b.kind ? a.kind.localeCompare(b.kind) : a.ref_id.localeCompare(b.ref_id))); // Deterministic order.
  return out; // Return evidence refs.
}

function buildReportIds( // Compute deterministic report id/hash used consistently across endpoints.
  subject: SubjectRef,
  window: Window,
  metricStats: MetricStats[],
  markers: any[]
): { report_id: string; determinism_hash: string } {
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Deterministic marker kinds list.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Deterministic evidence refs list.

  const reportCore = { // Hash core (must remain stable across endpoints).
    type: "agronomy_report_v0", // Contract type marker.
    schema_version: "0", // Contract version marker.
    subjectRef: subject, // Subject scope.
    window, // Window scope.
    evidence: { // Evidence summary block.
      metric_stats: metricStats, // Metric stats.
      marker_kinds: markerKinds, // Marker kinds.
      marker_count: markers.length, // Marker count.
      evidence_refs // Evidence pointer list.
    }
  };

  const determinism_hash = sha256Hex(stableStringify(reportCore)); // Deterministic hash from stable JSON.
  const report_id = `ar_${determinism_hash.slice(0, 24)}`; // Deterministic id from hash prefix.
  return { report_id, determinism_hash }; // Return ids.
}

function buildReport(subject: SubjectRef, window: Window, metricStats: MetricStats[], markers: any[]): any { // Build full report payload (read-only, no prescriptions).
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Deterministic marker kinds.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Evidence pointers.

  const reportCore = { // Core report payload without ids.
    type: "agronomy_report_v0", // Contract type marker.
    schema_version: "0", // Contract version.
    subjectRef: subject, // Subject scope.
    window, // Window.
    evidence: { // Evidence block.
      metric_stats: metricStats, // Per-metric stats.
      marker_kinds: markerKinds, // Marker kinds present.
      marker_count: markers.length, // Marker count.
      evidence_refs // Evidence pointers.
    }
  };

  const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Compute ids from same inputs.
  return { ...reportCore, report_id, determinism_hash }; // Return report with ids.
}

export function buildAgronomyV0Routes(pool: Pool): FastifyPluginAsync { // Build Fastify plugin for Agronomy v0 endpoints.
  const plugin: FastifyPluginAsync = async (app: FastifyInstance) => { // Register routes onto Fastify instance.

    app.get("/api/agronomy/v0/report", async (req, reply) => { // Full report endpoint.
      try {
        const q: any = (req as any).query ?? {}; // Read query object.
        const subject: SubjectRef = { // Parse subjectRef.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = { // Parse window.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute stats.
        const report = buildReport(subject, window, metricStats, markers); // Build deterministic report.

        return reply.send(report); // Return report JSON.
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return simple input/error payload.
      }
    });

    app.get("/api/agronomy/v0/summary", async (req, reply) => { // Summary endpoint (stable id/hash + counts).
      try {
        const q: any = (req as any).query ?? {}; // Read query object.
        const subject: SubjectRef = { // Parse subjectRef.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = { // Parse window.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute stats.
        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Compute deterministic ids.

        return reply.send({ // Return summary payload.
          type: "agronomy_report_summary_v0", // Summary contract type.
          schema_version: "0", // Summary contract version.
          report_id, // Must match report.
          determinism_hash, // Must match report.
          subjectRef: subject, // Echo scope.
          window, // Echo window.
          metric_count: metricStats.length, // Metric count.
          marker_count: markers.length // Marker count.
        });
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return simple input/error payload.
      }
    });

    app.get("/api/agronomy/v0/evidence_refs", async (req, reply) => { // Evidence ref endpoint (pointer list only).
      try {
        const q: any = (req as any).query ?? {}; // Read query object.
        const subject: SubjectRef = { // Parse subjectRef.
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = { // Parse window.
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markerFacts = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute stats.

        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markerFacts); // Compute ids deterministically.
        const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markerFacts); // Compute pointer list deterministically.

        return reply.send({ // Return evidence refs payload.
          type: "agronomy_evidence_refs_v0", // Evidence refs contract type.
          schema_version: "0", // Evidence refs version.
          report_id, // Must match report.
          determinism_hash, // Must match report.
          evidence_refs // Pointer list.
        });
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return simple input/error payload.
      }
    });
    app.post("/api/agronomy/v0/ao_act/interpretation", async (req, reply) => { // Sprint 13: write a read-only interpretation fact from an AO-ACT receipt (no AO-ACT mutation).
  try {
    const body = z
      .object({
        receipt_fact_id: z.string().min(1), // Receipt fact_id to interpret (ledger pointer).
        meta: z.record(z.any()).optional() // Optional audit meta for this interpretation write.
      })
      .parse((req as any).body ?? {}); // Parse request body.

    const receiptRow = await fetchFactByFactId(pool, body.receipt_fact_id); // Load receipt fact row from ledger.
    if (!receiptRow) return reply.code(400).send({ ok: false, error: "UNKNOWN_RECEIPT_FACT" }); // Require receipt fact existence.

    const receiptRecord = receiptRow.record_json; // Extract parsed receipt record_json.
    if (receiptRecord?.type !== "ao_act_receipt_v0") return reply.code(400).send({ ok: false, error: "RECEIPT_FACT_TYPE_MISMATCH" }); // Enforce AO-ACT receipt type.

    const interpretation_id = buildDeterministicInterpretationId(body.receipt_fact_id, receiptRecord); // Compute deterministic interpretation id.
    const created_at_ts = Date.now(); // Local timestamp for audit (facts.occurred_at remains authoritative).

    const record_json = {
      type: "agronomy_ao_act_receipt_interpretation_v0", // New Sprint 13 fact type (Agronomy-only, append-only).
      schema_version: "0", // Contract version marker.
      payload: {
        interpretation_id, // Deterministic interpretation id.
        receipt_fact_id: body.receipt_fact_id, // Pointer to source receipt fact.
        act_task_id: receiptRecord?.payload?.act_task_id ?? null, // Echo act_task_id if present (pointer-only).
        status: receiptRecord?.payload?.status ?? null, // Echo receipt status if present.
        execution_time: receiptRecord?.payload?.execution_time ?? null, // Echo execution time if present.
        execution_coverage: receiptRecord?.payload?.execution_coverage ?? null, // Echo execution coverage if present.
        constraint_check: receiptRecord?.payload?.constraint_check ?? null, // Echo constraint check if present.
        observed_parameters: receiptRecord?.payload?.observed_parameters ?? null, // Echo observed parameters if present.
        created_at_ts, // Interpretation creation time (ms).
        meta: body.meta // Optional audit meta.
      }
    }; // Record payload is strictly derived from receipt + local audit meta.

    const fact_id = randomUUID(); // New ledger fact_id (append-only).
    const source = "agronomy_v0"; // facts.source marker for write provenance.

    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", // Append-only write into ledger.
      [fact_id, source, record_json] // Provide args (fact_id, source, record_json).
    );

    return reply.send({ ok: true, fact_id, interpretation_id }); // Return created fact pointer + deterministic id.
  } catch (e: any) {
    return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return input/error payload.
  }
});

app.get("/api/agronomy/v0/ao_act/interpretation", async (req, reply) => { // Sprint 13: read interpretations by interpretation_id (read-only query).
  try {
    const q = z
      .object({ interpretation_id: z.string().min(1) })
      .parse((req as any).query ?? {}); // Parse query.

    const sql = `
      SELECT fact_id, occurred_at, source, record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'agronomy_ao_act_receipt_interpretation_v0'
        AND (record_json::jsonb#>>'{payload,interpretation_id}') = $1
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 20
    `; // Deterministic ordering for stable reads.

    const r = await pool.query(sql, [q.interpretation_id]); // Execute read.
    const rows = r.rows.map((row: any) => ({
      fact_id: String(row.fact_id), // Fact id.
      occurred_at: row.occurred_at, // Occurred at.
      source: String(row.source), // Source.
      record_json: parseRecordJson(row.record_json) // Parsed record_json.
    }));
    return reply.send({ ok: true, rows }); // Return rows.
  } catch (e: any) {
    return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return error payload.
  }
});


  }; // End plugin function.

  return plugin; // Return Fastify plugin.
}

export function registerAgronomyV0Routes(app: FastifyInstance, pool: Pool) { // Register helper to match server.ts patterns.
  app.register(buildAgronomyV0Routes(pool)); // Register plugin with shared PG pool.
}
