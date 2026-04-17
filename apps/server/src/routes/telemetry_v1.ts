// ⚠️ DEPRECATED: replaced by operation_state_v1 / program_v1
// DO NOT use in new flows
// GEOX/apps/server/src/routes/telemetry_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for query execution.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js"; // Reuse Sprint 19 token/scope auth for tenant isolation (Sprint A1).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js"; // Auth context for tenant_id filtering.

function isNonEmptyString(v: any): v is string { // Helper: validate non-empty string query parameters.
  return typeof v === "string" && v.trim().length > 0; // Non-empty trimmed string.
} // End helper.

function parseFiniteInt(v: any): number | null { // Helper: parse integer from query string.
  if (!isNonEmptyString(v)) return null; // Missing => null.
  const n = Number(v); // Convert to number.
  if (!Number.isFinite(n)) return null; // Reject NaN/Infinity.
  if (!Number.isInteger(n)) return null; // Require integer.
  return n; // Return parsed int.
} // End helper.

function badRequest(reply: any, error: string) { // Helper: send 400 with normalized payload.
  return reply.status(400).send({ ok: false, error }); // Standard error envelope.
} // End helper.

function parseMetricList(raw: any): string[] { // Parse comma-separated or repeated metrics query.
  if (Array.isArray(raw)) return raw.flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean); // Support repeated query params.
  if (!isNonEmptyString(raw)) return []; // Missing => empty list.
  return String(raw).split(",").map((x) => x.trim()).filter(Boolean); // Split comma-separated list.
} // End helper.

function clampLimit(raw: any, fallback: number, max: number): number { // Clamp query limits defensively.
  const n = parseFiniteInt(raw); // Parse integer.
  if (n == null) return fallback; // Use fallback when missing.
  return Math.max(1, Math.min(n, max)); // Clamp to safe range.
} // End helper.

function metricKey(metric: string): string { // Normalize metric keys for response maps.
  return String(metric).trim(); // Return trimmed metric.
} // End helper.

async function loadRawTelemetryFromFacts(pool: Pool, tenant_id: string, device_id: string, startMs: number, endMs: number, metrics: string[]): Promise<any[]> { // Fallback reader from facts SSOT.
  const values: any[] = [tenant_id, device_id, new Date(startMs).toISOString(), new Date(endMs).toISOString()]; // Bind base params.
  let metricFilterSql = ""; // Optional metric predicate.
  if (metrics.length > 0) { // Apply metric filter only when caller asks for it.
    values.push(metrics); // Bind metrics array.
    metricFilterSql = ` AND (record_json::jsonb #>> '{payload,metric}') = ANY($5::text[])`; // Filter requested metrics.
  } // End filter branch.

  const sql = `
    SELECT
      fact_id,
      ((record_json::jsonb #>> '{payload,metric}')) AS metric,
      ((record_json::jsonb #>> '{payload,ts_ms}'))::bigint AS ts_ms,
      (record_json::jsonb #>> '{payload,value}') AS raw_value_text
    FROM facts
    WHERE (record_json::jsonb ->> 'type') = 'raw_telemetry_v1'
      AND (record_json::jsonb #>> '{entity,tenant_id}') = $1
      AND (record_json::jsonb #>> '{entity,device_id}') = $2
      AND occurred_at >= $3::timestamptz
      AND occurred_at <= $4::timestamptz
      ${metricFilterSql}
    ORDER BY ts_ms ASC
  `; // Query SSOT facts directly.

  const r = await pool.query(sql, values); // Execute fallback query.
  return (r.rows ?? []).map((row: any) => { // Normalize fallback row shape.
    const rawValueText = row.raw_value_text == null ? null : String(row.raw_value_text); // Preserve original string value.
    const maybeNum = rawValueText != null && rawValueText !== "" && Number.isFinite(Number(rawValueText)) ? Number(rawValueText) : null; // Recover numeric values when possible.
    return { // Return normalized telemetry point.
      metric: String(row.metric), // Metric name.
      ts_ms: Number(row.ts_ms), // Event timestamp ms.
      value_num: maybeNum, // Numeric value when parseable.
      value_text: rawValueText, // Text representation.
      fact_id: String(row.fact_id), // Ledger fact id.
    }; // End normalized point.
  }); // End mapping.
} // End helper.

async function loadTelemetryPoints(pool: Pool, tenant_id: string, device_id: string, startMs: number, endMs: number, metrics: string[], limit: number): Promise<any[]> { // Unified telemetry point loader.
  const values: any[] = [tenant_id, device_id, new Date(startMs).toISOString(), new Date(endMs).toISOString()]; // Base params for projection query.
  let metricFilterSql = ""; // Optional projection metric filter.
  if (metrics.length > 0) { // Add filter when metrics were requested.
    values.push(metrics); // Bind metric array.
    metricFilterSql = ` AND metric = ANY($5::text[])`; // Projection predicate.
  } // End filter branch.

  const sql = `
    SELECT metric, EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms, value_num, value_text, fact_id
    FROM telemetry_index_v1
    WHERE tenant_id = $1
      AND device_id = $2
      AND ts >= $3::timestamptz
      AND ts <= $4::timestamptz
      ${metricFilterSql}
    ORDER BY ts ASC
    LIMIT ${limit}
  `; // Projection query for normal path.

  const projectionRows = (await pool.query(sql, values)).rows ?? []; // Query projection first.
  if (projectionRows.length > 0) return projectionRows.map((row: any) => ({ // Return projection rows when present.
    metric: String(row.metric), // Metric name.
    ts_ms: Number(row.ts_ms), // Timestamp ms.
    value_num: row.value_num == null ? null : Number(row.value_num), // Numeric value.
    value_text: row.value_text == null ? null : String(row.value_text), // Text value.
    fact_id: String(row.fact_id), // Ledger fact id.
  })); // End mapping.

  const factRows = await loadRawTelemetryFromFacts(pool, tenant_id, device_id, startMs, endMs, metrics); // Fallback to facts when projection is empty.
  return factRows.slice(0, limit); // Respect limit on fallback path too.
} // End helper.

async function ensureDeviceVisible(pool: Pool, tenant_id: string, device_id: string): Promise<boolean> { // Non-enumerable device existence gate.
  const q = await pool.query(`SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenant_id, device_id]); // Query device projection.
  return (q.rows ?? []).length > 0; // True when tenant owns the device.
} // End helper.

/**
 * Sprint A1/D1: Telemetry query (read-only)
 *
 * Existing route:
 * - GET /api/telemetry/v1/query
 *
 * New D1 routes:
 * - GET /api/v1/telemetry/latest
 * - GET /api/v1/telemetry/series
 * - GET /api/v1/telemetry/metrics
 */
export function registerTelemetryV1Routes(app: FastifyInstance, pool: Pool) { // Register telemetry v1 routes.
  app.get("/api/telemetry/v1/query", async (req, reply) => { // Query telemetry projection by tenant+device+time.
    if ((req.query as any)?.__internal__ !== "true") {
      return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
    }
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read"); // Enforce scope and obtain tenant context.
    if (!auth) return; // Authorization helper already replied (401/403/404 semantics).

    const q: any = (req as any).query ?? {}; // Read query params from request.
    const device_id: string | null = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id"); // device_id is mandatory.

    const metric: string | null = isNonEmptyString(q.metric) ? String(q.metric).trim() : null; // Optional metric filter.
    const from_ts_ms = parseFiniteInt(q.from_ts_ms); // Optional lower bound in epoch ms.
    const to_ts_ms = parseFiniteInt(q.to_ts_ms); // Optional upper bound in epoch ms.
    const nowMs = Date.now(); // Current time ms.
    const startMs = from_ts_ms ?? (nowMs - 24 * 60 * 60 * 1000); // Default start = now - 24h.
    const endMs = to_ts_ms ?? nowMs; // Default end = now.
    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms"); // Validate bounds ordering.

    const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metric ? [metric] : [], clampLimit(q.limit, 5000, 20000)); // Load unified points.
    return reply.send({ // Send query response.
      ok: true, // Success flag.
      tenant_id: auth.tenant_id, // Echo tenant for caller debugging (non-sensitive).
      device_id, // Echo device_id.
      metric: metric ?? null, // Echo metric if provided.
      range: { startTsMs: startMs, endTsMs: endMs }, // Echo resolved range.
      count: points.length, // Number of returned points.
      points, // Unified points array.
    }); // End response.
  }); // End route.

  app.get("/api/v1/telemetry/latest", async (req, reply) => { // Return latest point per metric for one device.
    if ((req.query as any)?.__internal__ !== "true") {
      return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
    }
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read"); // Require telemetry.read.
    if (!auth) return; // Auth helper responded.

    const q: any = (req as any).query ?? {}; // Parse query params.
    const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id"); // Validate device id.
    if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id))) return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Hide cross-tenant devices.

    const metrics = parseMetricList(q.metrics); // Optional metric subset.
    const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 7 * 24 * 60 * 60 * 1000); // Default last 7 days to find latest points.
    const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms"); // Validate range.

    const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, 20000); // Load candidate points.
    const latest = new Map<string, any>(); // Keep latest point per metric.
    for (const point of points) { // Walk time-ordered points.
      latest.set(metricKey(point.metric), point); // Later points overwrite earlier points.
    } // End loop.

    return reply.send({ // Return latest map plus list for frontend convenience.
      ok: true, // Success flag.
      tenant_id: auth.tenant_id, // Tenant id.
      device_id, // Device id.
      count: latest.size, // Number of metrics returned.
      items: Array.from(latest.values()).sort((a, b) => String(a.metric).localeCompare(String(b.metric))), // Stable array for cards.
    }); // End response.
  }); // End latest route.

  app.get("/api/v1/telemetry/series", async (req, reply) => { // Return point series for one device.
    if ((req.query as any)?.__internal__ !== "true") {
      return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
    }
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read"); // Require telemetry.read.
    if (!auth) return; // Auth helper responded.

    const q: any = (req as any).query ?? {}; // Parse query params.
    const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id"); // Validate device id.
    if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id))) return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Hide cross-tenant devices.

    const metrics = parseMetricList(q.metrics); // Optional metrics list.
    const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 24 * 60 * 60 * 1000); // Default last 24h.
    const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms"); // Validate range.

    const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, clampLimit(q.limit, 5000, 20000)); // Load points.
    const series: Record<string, any[]> = {}; // Group by metric for frontend.
    for (const point of points) { // Group points.
      const key = metricKey(point.metric); // Normalize metric key.
      if (!Array.isArray(series[key])) series[key] = []; // Initialize list.
      series[key].push({ ts_ms: point.ts_ms, value_num: point.value_num, value_text: point.value_text, fact_id: point.fact_id }); // Append point.
    } // End grouping.

    return reply.send({ // Return grouped series.
      ok: true, // Success flag.
      tenant_id: auth.tenant_id, // Tenant id.
      device_id, // Device id.
      range: { startTsMs: startMs, endTsMs: endMs }, // Range.
      metrics: Object.keys(series), // Included metric names.
      series, // Grouped series map.
      count: points.length, // Total point count.
    }); // End response.
  }); // End series route.

  app.get("/api/v1/telemetry/metrics", async (req, reply) => { // Return metric summary cards for one device.
    if ((req.query as any)?.__internal__ !== "true") {
      return reply.code(410).send({ ok: false, error: "DEPRECATED_API" });
    }
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read"); // Require telemetry.read.
    if (!auth) return; // Auth helper responded.

    const q: any = (req as any).query ?? {}; // Parse query params.
    const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id"); // Validate device id.
    if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id))) return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Hide cross-tenant devices.

    const metrics = parseMetricList(q.metrics); // Optional metric subset.
    const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 24 * 60 * 60 * 1000); // Default last 24h.
    const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms"); // Validate range.

    const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, 20000); // Load points.
    const summary = new Map<string, any>(); // Aggregate per metric.
    for (const point of points) { // Aggregate points.
      const key = metricKey(point.metric); // Normalize metric key.
      const prev = summary.get(key) ?? { metric: key, count: 0, latest_ts_ms: null, latest_value_num: null, latest_value_text: null, min_value_num: null, max_value_num: null, avg_value_num: null, _sum: 0 }; // Seed bucket.
      prev.count += 1; // Increase count.
      prev.latest_ts_ms = point.ts_ms; // Points are time-ordered, so the last seen point is latest.
      prev.latest_value_num = point.value_num; // Keep latest numeric value.
      prev.latest_value_text = point.value_text; // Keep latest text value.
      if (typeof point.value_num === "number" && Number.isFinite(point.value_num)) { // Aggregate numeric fields only.
        prev.min_value_num = prev.min_value_num == null ? point.value_num : Math.min(prev.min_value_num, point.value_num); // Update min.
        prev.max_value_num = prev.max_value_num == null ? point.value_num : Math.max(prev.max_value_num, point.value_num); // Update max.
        prev._sum += point.value_num; // Update sum.
      } // End numeric branch.
      summary.set(key, prev); // Save bucket.
    } // End aggregation loop.

    const items = Array.from(summary.values()).map((bucket: any) => ({ // Finalize response buckets.
      metric: bucket.metric, // Metric name.
      count: bucket.count, // Point count.
      latest_ts_ms: bucket.latest_ts_ms, // Latest point ts.
      latest_value_num: bucket.latest_value_num, // Latest numeric value.
      latest_value_text: bucket.latest_value_text, // Latest text value.
      min_value_num: bucket.min_value_num, // Minimum numeric value.
      max_value_num: bucket.max_value_num, // Maximum numeric value.
      avg_value_num: bucket.min_value_num == null ? null : Number((bucket._sum / bucket.count).toFixed(4)), // Simple average for MVP.
    })); // End finalize.

    return reply.send({ ok: true, tenant_id: auth.tenant_id, device_id, range: { startTsMs: startMs, endTsMs: endMs }, count: items.length, items }); // Return metric summary.
  }); // End metrics route.
} // End registration.
