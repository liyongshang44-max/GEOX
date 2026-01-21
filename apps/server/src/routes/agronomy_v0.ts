import type { FastifyInstance, FastifyPluginAsync } from "fastify"; // Fastify app types used to register routes.
import type { Pool } from "pg"; // Postgres connection pool type used for read-only queries.
import crypto from "node:crypto"; // Hash function used to generate a deterministic report id/hash.

type SubjectRef = { projectId: string; groupId: string }; // Minimal subject reference for group-scoped reports.
type Window = { startTs: number; endTs: number }; // Time window in epoch ms.

type MetricStats = { // Aggregated statistics for one metric within the requested window.
  metric: string; // Metric identifier (e.g., soil_moisture_vwc_30cm).
  count: number; // Number of samples observed for this metric.
  first_ts_ms: number; // Earliest timestamp for this metric.
  last_ts_ms: number; // Latest timestamp for this metric.
  first_value: number; // Value at earliest timestamp.
  last_value: number; // Value at latest timestamp.
  min_value: number; // Minimum value observed.
  max_value: number; // Maximum value observed.
  delta_value: number; // last_value - first_value (simple descriptive change).
};

export type EvidenceRef = { kind: string; ref_id: string }; // Frozen v0: evidence reference is a pointer only (no time/meta fields).

function mustString(q: unknown, name: string): string { // Require a query param to be a non-empty string.
  if (typeof q !== "string" || q.trim() === "") throw new Error(`missing_or_invalid_${name}`); // Enforce non-empty string.
  return q; // Return validated string.
}

function mustInt(q: unknown, name: string): number { // Require a query param to be an integer-like string.
  const s = mustString(q, name); // Reuse string validator.
  const n = Number(s); // Convert to number.
  if (!Number.isFinite(n) || Math.floor(n) !== n) throw new Error(`missing_or_invalid_${name}`); // Enforce integer.
  return n; // Return validated integer number.
}

function stableStringify(v: unknown): string { // Deterministic JSON stringify (stable key order) for hashing.
  const seen = new WeakSet<object>(); // Track visited objects to avoid cycles.
  const helper = (x: any): any => { // Recursive normalizer.
    if (x === null || typeof x !== "object") return x; // Primitives are returned as-is.
    if (x instanceof Date) return x.toISOString(); // Dates normalized to ISO string (should not appear).
    if (Array.isArray(x)) return x.map(helper); // Arrays preserve order.
    if (seen.has(x)) return "[Circular]"; // Cycles should not occur; guard anyway.
    seen.add(x); // Mark object as seen.
    const keys = Object.keys(x).sort(); // Sort keys to ensure determinism.
    const out: Record<string, any> = {}; // Construct a new object with sorted keys.
    for (const k of keys) out[k] = helper(x[k]); // Recursively normalize each property.
    return out; // Return normalized object.
  };
  return JSON.stringify(helper(v)); // Serialize normalized structure.
}

function sha256Hex(s: string): string { // Compute SHA-256 hex digest for a given string.
  return crypto.createHash("sha256").update(s).digest("hex"); // Return digest.
}

function parseRecordJson(rowValue: unknown): any { // Parse facts.record_json that is stored as TEXT (JSON string).
  if (typeof rowValue !== "string" || rowValue.trim() === "") return null; // Reject empty values.
  try { return JSON.parse(rowValue); } catch { return null; } // Parse JSON safely.
}

async function fetchRawSampleFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load raw_sample_v1 facts for the group/window.
  const sql = `
    SELECT record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'raw_sample_v1'
      AND (record_json::jsonb->'entity'->>'project_id') = $1
      AND (record_json::jsonb->'entity'->>'group_id') = $2
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint >= $3
      AND (record_json::jsonb->'payload'->>'ts_ms')::bigint <= $4
  `; // Query uses the ledger (facts) so we remain projection-agnostic.
  const rows = await pool.query(sql, [subject.projectId, subject.groupId, window.startTs, window.endTs]); // Run read-only query.
  return rows.rows.map((r) => parseRecordJson(r.record_json)).filter((x) => x); // Extract JSON payloads.
}

async function fetchMarkerFacts(pool: Pool, subject: SubjectRef, window: Window): Promise<any[]> { // Load marker_v1 facts for the group/window.
  const sql = `
    SELECT record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'marker_v1'
      AND (record_json::jsonb->'entity'->>'project_id') = $1
      AND (record_json::jsonb->'entity'->>'group_id') = $2
      AND (record_json::jsonb->'payload'->'time_range'->>'startTs')::bigint <= $4
      AND (record_json::jsonb->'payload'->'time_range'->>'endTs')::bigint >= $3
  `; // Overlap condition: marker time_range intersects report window.
  const rows = await pool.query(sql, [subject.projectId, subject.groupId, window.startTs, window.endTs]); // Run read-only query.
  return rows.rows.map((r) => parseRecordJson(r.record_json)).filter((x) => x); // Extract JSON payloads.
}

function computeMetricStats(rawFacts: any[]): MetricStats[] { // Compute per-metric descriptive statistics from raw_sample_v1 facts.
  const byMetric = new Map<string, { ts: number; v: number }[]>(); // Group samples by metric.
  for (const f of rawFacts) { // Iterate facts.
    const metric = f?.payload?.metric; // Extract metric id.
    const ts = Number(f?.payload?.ts_ms); // Extract timestamp.
    const v = Number(f?.payload?.value); // Extract value.
    if (typeof metric !== "string" || metric === "") continue; // Skip malformed metric.
    if (!Number.isFinite(ts) || !Number.isFinite(v)) continue; // Skip malformed numeric fields.
    if (!byMetric.has(metric)) byMetric.set(metric, []); // Initialize bucket.
    byMetric.get(metric)!.push({ ts, v }); // Append sample.
  }

  const out: MetricStats[] = []; // Collect computed stats.
  for (const [metric, arr] of [...byMetric.entries()].sort(([a], [b]) => a.localeCompare(b))) { // Deterministic metric order.
    arr.sort((a, b) => a.ts - b.ts); // Sort samples by time.
    const first = arr[0]; // First sample.
    const last = arr[arr.length - 1]; // Last sample.
    let min = first.v; // Initialize min.
    let max = first.v; // Initialize max.
    for (const s of arr) { // Scan values.
      if (s.v < min) min = s.v; // Update min.
      if (s.v > max) max = s.v; // Update max.
    }
    out.push({
      metric, // Metric id.
      count: arr.length, // Sample count.
      first_ts_ms: first.ts, // Earliest timestamp.
      last_ts_ms: last.ts, // Latest timestamp.
      first_value: first.v, // Value at earliest timestamp.
      last_value: last.v, // Value at latest timestamp.
      min_value: min, // Minimum observed.
      max_value: max, // Maximum observed.
      delta_value: last.v - first.v // Descriptive change.
    }); // Add metric stats.
  }
  return out; // Return stats.
}

function buildEvidenceRefsFromInputs(metricStats: MetricStats[], markers: any[]): EvidenceRef[] { // Build a neutral evidence reference list for the report.
  const out: EvidenceRef[] = []; // Initialize output list.

  for (const s of metricStats) { // Reference each metric as an evidence summary key.
    out.push({ kind: "metric_summary", ref_id: s.metric }); // Use metric id as ref_id.
  }

  for (const m of markers) { // Reference each marker by marker_id when available (pointer only).
    const markerId = m?.marker_id ?? m?.payload?.marker_id ?? null; // Try common field locations.
    if (typeof markerId === "string" && markerId !== "") out.push({ kind: "marker_id", ref_id: markerId }); // Add marker reference.
  }

  out.sort((a, b) => (a.kind === b.kind ? a.ref_id.localeCompare(b.ref_id) : a.kind.localeCompare(b.kind))); // Deterministic ordering.
  return out; // Return list.
}

function buildReportIds(subject: SubjectRef, window: Window, metricStats: MetricStats[], markers: any[]): { report_id: string; determinism_hash: string } { // Compute deterministic report id/hash (shared across endpoints).
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Deterministic marker kinds.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Evidence refs computed from inputs (Option B).

  const reportCore = { // Core structure used for determinism hash.
    type: "agronomy_report_v0", // Contract type marker.
    schema_version: "0", // Contract version.
    subjectRef: subject, // Report scope.
    window, // Report time window.
    evidence: { // Evidence summary block.
      metric_stats: metricStats, // Descriptive stats per metric.
      marker_kinds: markerKinds, // Marker kinds present (descriptive).
      marker_count: markers.length, // Number of marker facts intersecting the window.
      evidence_refs // Pointer list for reproducible evidence referencing.
    }
  };

  const determinism_hash = sha256Hex(stableStringify(reportCore)); // Deterministic hash computed from stable JSON.
  const report_id = `ar_${determinism_hash.slice(0, 24)}`; // Deterministic id derived from hash prefix.
  return { report_id, determinism_hash }; // Return ids.
}

function buildReport(subject: SubjectRef, window: Window, metricStats: MetricStats[], markers: any[]): any { // Construct the agronomy report payload (read-only; no prescriptions).
  const markerKinds = [...new Set(markers.map((m) => String(m?.payload?.kind ?? "UNKNOWN")))].sort(); // Deterministic marker kinds.
  const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Evidence refs computed from inputs.

  const reportCore = {
    type: "agronomy_report_v0", // Contract type marker.
    schema_version: "0", // Contract version.
    subjectRef: subject, // Report scope.
    window, // Report time window.
    evidence: {
      metric_stats: metricStats, // Descriptive stats per metric.
      marker_kinds: markerKinds, // Marker kinds present (descriptive).
      marker_count: markers.length, // Number of marker facts intersecting the window.
      evidence_refs // Included for convenience; endpoint /evidence_refs is the stable protocol surface.
    }
  };

  const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Shared id/hash.
  return { ...reportCore, report_id, determinism_hash }; // Return full report.
}

export function buildAgronomyV0Routes(pool: Pool): FastifyPluginAsync { // Create Fastify plugin for agronomy v0 endpoints.
  const plugin: FastifyPluginAsync = async (app: FastifyInstance) => { // Plugin registers routes on the app.

    app.get("/api/agronomy/v0/report", async (req, reply) => { // Read-only report endpoint.
      try {
        const q: any = (req as any).query ?? {}; // Extract query params.
        const subject: SubjectRef = {
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = {
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute descriptive stats.
        const report = buildReport(subject, window, metricStats, markers); // Build deterministic report payload.

        return reply.send(report); // Return JSON report.
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return a simple input error payload.
      }
    });

    app.get("/api/agronomy/v0/summary", async (req, reply) => { // Read-only summary endpoint.
      try {
        const q: any = (req as any).query ?? {}; // Extract query params.
        const subject: SubjectRef = {
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = {
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute descriptive stats.
        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Shared id/hash.

        return reply.send({
          type: "agronomy_report_summary_v0", // Frozen summary type.
          schema_version: "0", // Frozen summary version.
          report_id, // Must match report.
          determinism_hash, // Must match report.
          subjectRef: subject, // Echo scope.
          window, // Echo window.
          metric_count: metricStats.length, // Count of metrics found.
          marker_count: markers.length // Count of markers in window.
        });
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return a simple input error payload.
      }
    });

    app.get("/api/agronomy/v0/evidence_refs", async (req, reply) => { // Frozen protocol surface: pointer list only.
      try {
        const q: any = (req as any).query ?? {}; // Extract query params.
        const subject: SubjectRef = {
          projectId: mustString(q.projectId, "projectId"), // Validate project id.
          groupId: mustString(q.groupId, "groupId") // Validate group id.
        };
        const window: Window = {
          startTs: mustInt(q.startTs, "startTs"), // Validate start timestamp.
          endTs: mustInt(q.endTs, "endTs") // Validate end timestamp.
        };
        if (window.endTs < window.startTs) throw new Error("window_invalid"); // Enforce monotonic window.

        // Option B: compute evidence_refs from the evidence set, without freezing report presentation layout.
        const rawFacts = await fetchRawSampleFacts(pool, subject, window); // Load raw sample facts.
        const markers = await fetchMarkerFacts(pool, subject, window); // Load marker facts.
        const metricStats = computeMetricStats(rawFacts); // Compute descriptive stats.
        const evidence_refs = buildEvidenceRefsFromInputs(metricStats, markers); // Pointer list only.
        const { report_id, determinism_hash } = buildReportIds(subject, window, metricStats, markers); // Shared id/hash.

        return reply.send({
          type: "agronomy_evidence_refs_v0", // Frozen evidence refs type.
          schema_version: "0", // Frozen evidence refs version.
          report_id, // Must match report.
          determinism_hash, // Must match report.
          evidence_refs // Frozen v0: array of {kind, ref_id}.
        });
      } catch (e: any) {
        return reply.code(400).send({ ok: false, error: String(e?.message ?? e) }); // Return a simple input error payload.
      }
    });

  };
  return plugin; // Return plugin.
}

export function registerAgronomyV0Routes(app: FastifyInstance, pool: Pool) { // Public registration helper matching existing server.ts patterns.
  app.register(buildAgronomyV0Routes(pool)); // Mount the plugin bound to the shared PG pool for read-only queries.
}
