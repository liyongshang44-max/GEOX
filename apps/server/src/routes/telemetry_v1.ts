// ⚠️ DEPRECATED: replaced by operation_state_v1 / program_v1
// DO NOT use in new flows
// GEOX/apps/server/src/routes/telemetry_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for query execution.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js"; // Reuse Sprint 19 token/scope auth for tenant isolation (Sprint A1).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js"; // Auth context for tenant_id filtering.

const TELEMETRY_COMPAT_SUNSET_AT = "Wed, 31 Dec 2026 23:59:59 GMT"; // Unified telemetry compatibility sunset (RFC1123).

type TelemetryCompatibilityMeta = {
  successor_endpoint: string;
  compatibility_notice: string;
};

const TELEMETRY_COMPAT_META: Record<string, TelemetryCompatibilityMeta> = {
  "/api/telemetry/v1/query": {
    successor_endpoint: "/api/v1/operations",
    compatibility_notice: "compatibility only; do not use in new flows; for migration only",
  },
  "/api/v1/telemetry/latest": {
    successor_endpoint: "/api/v1/operations",
    compatibility_notice: "compatibility only; do not use in new flows; for migration only",
  },
  "/api/v1/telemetry/series": {
    successor_endpoint: "/api/v1/field-timeline",
    compatibility_notice: "compatibility only; do not use in new flows; for migration only",
  },
  "/api/v1/telemetry/metrics": {
    successor_endpoint: "/api/v1/reports",
    compatibility_notice: "compatibility only; do not use in new flows; for migration only",
  },
};

function telemetryCompatibilityMeta(routePath: keyof typeof TELEMETRY_COMPAT_META): TelemetryCompatibilityMeta {
  return TELEMETRY_COMPAT_META[routePath];
}

function applyTelemetryCompatibilityHeaders(reply: any, meta: TelemetryCompatibilityMeta): void {
  reply.header("X-Deprecated", "true");
  reply.header("Deprecation", "true");
  reply.header("Sunset", TELEMETRY_COMPAT_SUNSET_AT);
  reply.header("Link", `<${meta.successor_endpoint}>; rel="successor-version"`);
}

function attachTelemetryCompatibilityPayload<T extends Record<string, any>>(payload: T, meta: TelemetryCompatibilityMeta): T & {
  deprecated: true;
  successor_endpoint: string;
  compatibility_notice: string;
  deprecation_notice: string;
  sunset_at: string;
} {
  return {
    ...payload,
    deprecated: true,
    successor_endpoint: meta.successor_endpoint,
    compatibility_notice: meta.compatibility_notice,
    deprecation_notice: "telemetry compatibility endpoint is deprecated; migrate to successor read model",
    sunset_at: TELEMETRY_COMPAT_SUNSET_AT,
  };
}

function sendTelemetryCompatibilityResponse<T extends Record<string, any>>(reply: any, payload: T, routePath: keyof typeof TELEMETRY_COMPAT_META) {
  const meta = telemetryCompatibilityMeta(routePath);
  applyTelemetryCompatibilityHeaders(reply, meta);
  return reply.send(attachTelemetryCompatibilityPayload(payload, meta));
}

function applyTelemetryFailureCors(req: any, reply: any): void {
  const origin = typeof req?.headers?.origin === "string" && req.headers.origin.trim() ? req.headers.origin : "*";
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-contract-version, x-api-contract-required, x-tenant-id, x-project-id, x-group-id",
  );
  reply.header("Access-Control-Expose-Headers", "Content-Type, x-api-contract-version");
}

class TelemetryReadError extends Error {
  public code: string;
  public cause: unknown;

  constructor(code: string, cause: unknown) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

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

function badRequest(reply: any, error: string, routePath: keyof typeof TELEMETRY_COMPAT_META) { // Helper: send 400 with normalized payload.
  reply.status(400);
  return sendTelemetryCompatibilityResponse(reply, { ok: false, error }, routePath); // Standard error envelope + compatibility contract.
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

async function loadRawTelemetryFromFacts(pool: Pool, tenant_id: string, device_id: string, startMs: number, endMs: number, metrics: string[], logger?: any): Promise<any[]> { // Fallback reader from facts SSOT.
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

  try {
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
  } catch (error) {
    logger?.error?.({ err: error, tenant_id, device_id }, "telemetry.facts query failed");
    throw new TelemetryReadError("FACTS_QUERY_FAILED", error);
  }
} // End helper.

async function loadTelemetryPoints(pool: Pool, tenant_id: string, device_id: string, startMs: number, endMs: number, metrics: string[], limit: number, logger?: any): Promise<any[]> { // Unified telemetry point loader.
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

  let projectionRows: any[] = [];
  try {
    projectionRows = (await pool.query(sql, values)).rows ?? []; // Query projection first.
  } catch (error) {
    logger?.warn?.({ err: error, tenant_id, device_id }, "telemetry.projection query failed; fallback to facts");
  }
  if (projectionRows.length > 0) return projectionRows.map((row: any) => ({ // Return projection rows when present.
    metric: String(row.metric), // Metric name.
    ts_ms: Number(row.ts_ms), // Timestamp ms.
    value_num: row.value_num == null ? null : Number(row.value_num), // Numeric value.
    value_text: row.value_text == null ? null : String(row.value_text), // Text value.
    fact_id: String(row.fact_id), // Ledger fact id.
  })); // End mapping.

  const factRows = await loadRawTelemetryFromFacts(pool, tenant_id, device_id, startMs, endMs, metrics, logger); // Fallback to facts when projection is empty or failed.
  return factRows.slice(0, limit); // Respect limit on fallback path too.
} // End helper.

async function ensureDeviceVisible(pool: Pool, tenant_id: string, device_id: string, logger?: any): Promise<boolean> { // Non-enumerable device existence gate.
  try {
    const q = await pool.query(`SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenant_id, device_id]); // Query device projection.
    return (q.rows ?? []).length > 0; // True when tenant owns the device.
  } catch (error) {
    logger?.error?.({ err: error, tenant_id, device_id }, "telemetry.device visibility query failed");
    throw new TelemetryReadError("DEVICE_VISIBILITY_QUERY_FAILED", error);
  }
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

function text(v: unknown): string {
  return String(v ?? "").trim();
}

function finiteOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function registerTelemetryV1Routes(app: FastifyInstance, pool: Pool) { // Register telemetry v1 routes.

  app.post("/api/v1/device-observations/from-telemetry-facts", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.write");
    if (!auth) return;
    const body: any = (req as any).body ?? {};
    const tenant_id = text(body.tenant_id || auth.tenant_id);
    const project_id = text(body.project_id || auth.project_id);
    const group_id = text(body.group_id || auth.group_id);
    const operation_plan_id = text(body.operation_plan_id);
    if (!tenant_id || !project_id || !group_id) return reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    if (!operation_plan_id) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });
    if (tenant_id !== auth.tenant_id || project_id !== auth.project_id || group_id !== auth.group_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const opQ = await pool.query(
      `SELECT record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND COALESCE(record_json::jsonb#>>'{payload,tenant_id}', $1) = $1
          AND COALESCE(record_json::jsonb#>>'{payload,project_id}', $2) = $2
          AND COALESCE(record_json::jsonb#>>'{payload,group_id}', $3) = $3
          AND COALESCE(record_json::jsonb#>>'{payload,operation_plan_id}', record_json::jsonb#>>'{payload,operation_id}') = $4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant_id, project_id, group_id, operation_plan_id],
    );
    if (!opQ.rows?.[0]) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
    const operationPayload = (opQ.rows[0] as any).record_json?.payload ?? {};
    const operation_field_id = text(operationPayload.field_id);

    const q = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'telemetry_observation_v1'
          AND COALESCE(record_json::jsonb#>>'{payload,tenant_id}', $1) = $1
          AND COALESCE(record_json::jsonb#>>'{payload,project_id}', $2) = $2
          AND COALESCE(record_json::jsonb#>>'{payload,group_id}', $3) = $3
          AND COALESCE(record_json::jsonb#>>'{payload,operation_plan_id}', record_json::jsonb#>>'{payload,operation_id}') = $4
          AND ($5::text = '' OR COALESCE(record_json::jsonb#>>'{payload,field_id}', '') = $5)
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant_id, project_id, group_id, operation_plan_id, operation_field_id],
    );

    let telemetryCount = 0;
    let observationCount = 0;
    for (const row of q.rows ?? []) {
      const payload = (row as any).record_json?.payload ?? {};
      const device_id = text(payload.device_id);
      const field_id = text(payload.field_id);
      const metric = text(payload.metric);
      const observed_at_ts_ms = finiteOrNull(payload.observed_at_ts_ms) ?? Date.parse(String((row as any).occurred_at));
      const observed_at = Number.isFinite(observed_at_ts_ms) ? new Date(observed_at_ts_ms).toISOString() : new Date(String((row as any).occurred_at)).toISOString();
      const value_num = finiteOrNull(payload.value_num);
      if (!device_id || !metric || !Number.isFinite(observed_at_ts_ms)) continue;
      await pool.query(
        `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
         VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7)
         ON CONFLICT (tenant_id, device_id, metric, ts) DO UPDATE SET
           value_num = EXCLUDED.value_num,
           value_text = EXCLUDED.value_text,
           fact_id = EXCLUDED.fact_id`,
        [tenant_id, device_id, metric, observed_at, value_num, value_num == null ? text(payload.value_text) || null : null, String((row as any).fact_id)],
      );
      telemetryCount += 1;
      if (field_id) {
        await pool.query(
          `INSERT INTO device_observation_index_v1
            (tenant_id, project_id, group_id, device_id, field_id, metric, observed_at, observed_at_ts_ms, value_num, value_text, unit, confidence, quality_flags_json, fact_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12,$13::jsonb,$14)
           ON CONFLICT (tenant_id, device_id, metric, observed_at_ts_ms) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             group_id = EXCLUDED.group_id,
             field_id = EXCLUDED.field_id,
             value_num = EXCLUDED.value_num,
             value_text = EXCLUDED.value_text,
             unit = EXCLUDED.unit,
             confidence = EXCLUDED.confidence,
             quality_flags_json = EXCLUDED.quality_flags_json,
             fact_id = EXCLUDED.fact_id`,
          [tenant_id, project_id, group_id, device_id, field_id, metric, observed_at, observed_at_ts_ms, value_num, value_num == null ? text(payload.value_text) || null : null, text(payload.unit) || null, finiteOrNull(payload.confidence) ?? 0.95, JSON.stringify(Array.isArray(payload.quality_flags) ? payload.quality_flags : []), String((row as any).fact_id)],
        );
        observationCount += 1;
      }
    }

    return reply.send({ ok: true, operation_plan_id: operation_plan_id || null, source_fact_type: "telemetry_observation_v1", derived: { telemetry_index_v1: telemetryCount, device_observation_index_v1: observationCount }, telemetry_count: telemetryCount, device_observation_count: observationCount });
  });

  app.get("/api/telemetry/v1/query", async (req, reply) => { // Compatibility-only telemetry query (migration only).
    const routePath = "/api/telemetry/v1/query" as const;
    if ((req.query as any)?.__internal__ !== "true") {
      reply.code(410);
      return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "DEPRECATED_API" }, routePath);
    }
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.write"); // Enforce scope and obtain tenant context.
    if (!auth) return; // Authorization helper already replied (401/403/404 semantics).

    const q: any = (req as any).query ?? {}; // Read query params from request.
    const device_id: string | null = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id", routePath); // device_id is mandatory.

    const metric: string | null = isNonEmptyString(q.metric) ? String(q.metric).trim() : null; // Optional metric filter.
    const from_ts_ms = parseFiniteInt(q.from_ts_ms); // Optional lower bound in epoch ms.
    const to_ts_ms = parseFiniteInt(q.to_ts_ms); // Optional upper bound in epoch ms.
    const nowMs = Date.now(); // Current time ms.
    const startMs = from_ts_ms ?? (nowMs - 24 * 60 * 60 * 1000); // Default start = now - 24h.
    const endMs = to_ts_ms ?? nowMs; // Default end = now.
    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms", routePath); // Validate bounds ordering.

    const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metric ? [metric] : [], clampLimit(q.limit, 5000, 20000), req.log); // Load unified points.
    return sendTelemetryCompatibilityResponse(reply, { // Send query response.
      ok: true, // Success flag.
      tenant_id: auth.tenant_id, // Echo tenant for caller debugging (non-sensitive).
      device_id, // Echo device_id.
      metric: metric ?? null, // Echo metric if provided.
      range: { startTsMs: startMs, endTsMs: endMs }, // Echo resolved range.
      count: points.length, // Number of returned points.
      points, // Unified points array.
    }, routePath); // End response.
  }); // End route.

  app.get("/api/v1/telemetry/latest", async (req, reply) => { // Compatibility-only latest telemetry view (migration only).
    const routePath = "/api/v1/telemetry/latest" as const;
    try {
      const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.write"); // Require telemetry.read.
      if (!auth) return; // Auth helper responded.

      const q: any = (req as any).query ?? {}; // Parse query params.
      const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
      if (!device_id) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "MISSING:device_id", routePath); // Validate device id.
      }
      if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id, req.log))) {
        applyTelemetryFailureCors(req, reply);
        reply.status(404);
        return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "NOT_FOUND" }, routePath);
      } // Hide cross-tenant devices.

      const metrics = parseMetricList(q.metrics); // Optional metric subset.
      const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 7 * 24 * 60 * 60 * 1000); // Default last 7 days to find latest points.
      const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
      if (startMs > endMs) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms", routePath); // Validate range.
      }

      const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, 20000, req.log); // Load candidate points.
      const latest = new Map<string, any>(); // Keep latest point per metric.
      for (const point of points) { // Walk time-ordered points.
        latest.set(metricKey(point.metric), point); // Later points overwrite earlier points.
      } // End loop.

      return sendTelemetryCompatibilityResponse(reply, { // Return latest map plus list for frontend convenience.
        ok: true, // Success flag.
        tenant_id: auth.tenant_id, // Tenant id.
        device_id, // Device id.
        count: latest.size, // Number of metrics returned.
        items: Array.from(latest.values()).sort((a, b) => String(a.metric).localeCompare(String(b.metric))), // Stable array for cards.
      }, routePath); // End response.
    } catch (error) {
      req.log.error({ err: error }, "telemetry.latest failed");
      applyTelemetryFailureCors(req, reply);
      reply.status(500);
      return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "INTERNAL_ERROR" }, routePath);
    }
  }); // End latest route.

  app.get("/api/v1/telemetry/series", async (req, reply) => { // Compatibility-only telemetry series (migration only).
    const routePath = "/api/v1/telemetry/series" as const;
    try {
      const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.write"); // Require telemetry.read.
      if (!auth) return; // Auth helper responded.

      const q: any = (req as any).query ?? {}; // Parse query params.
      const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
      if (!device_id) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "MISSING:device_id", routePath); // Validate device id.
      }
      if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id, req.log))) {
        applyTelemetryFailureCors(req, reply);
        reply.status(404);
        return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "NOT_FOUND" }, routePath);
      } // Hide cross-tenant devices.

      const metrics = parseMetricList(q.metrics); // Optional metrics list.
      const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 24 * 60 * 60 * 1000); // Default last 24h.
      const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
      if (startMs > endMs) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms", routePath); // Validate range.
      }

      const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, clampLimit(q.limit, 5000, 20000), req.log); // Load points.
      const series: Record<string, any[]> = {}; // Group by metric for frontend.
      for (const point of points) { // Group points.
        const key = metricKey(point.metric); // Normalize metric key.
        if (!Array.isArray(series[key])) series[key] = []; // Initialize list.
        series[key].push({ ts_ms: point.ts_ms, value_num: point.value_num, value_text: point.value_text, fact_id: point.fact_id }); // Append point.
      } // End grouping.

      return sendTelemetryCompatibilityResponse(reply, { // Return grouped series.
        ok: true, // Success flag.
        tenant_id: auth.tenant_id, // Tenant id.
        device_id, // Device id.
        range: { startTsMs: startMs, endTsMs: endMs }, // Range.
        metrics: Object.keys(series), // Included metric names.
        series, // Grouped series map.
        count: points.length, // Total point count.
      }, routePath); // End response.
    } catch (error) {
      req.log.error({ err: error }, "telemetry.series failed");
      applyTelemetryFailureCors(req, reply);
      reply.status(500);
      return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "INTERNAL_ERROR" }, routePath);
    }
  }); // End series route.

  app.get("/api/v1/telemetry/metrics", async (req, reply) => { // Compatibility-only telemetry metrics summary (migration only).
    const routePath = "/api/v1/telemetry/metrics" as const;
    try {
      const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.write"); // Require telemetry.read.
      if (!auth) return; // Auth helper responded.

      const q: any = (req as any).query ?? {}; // Parse query params.
      const device_id = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
      if (!device_id) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "MISSING:device_id", routePath); // Validate device id.
      }
      if (!(await ensureDeviceVisible(pool, auth.tenant_id, device_id, req.log))) {
        applyTelemetryFailureCors(req, reply);
        reply.status(404);
        return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "NOT_FOUND" }, routePath);
      } // Hide cross-tenant devices.

      const metrics = parseMetricList(q.metrics); // Optional metric subset.
      const startMs = parseFiniteInt(q.from_ts_ms) ?? (Date.now() - 24 * 60 * 60 * 1000); // Default last 24h.
      const endMs = parseFiniteInt(q.to_ts_ms) ?? Date.now(); // Default end now.
      if (startMs > endMs) {
        applyTelemetryFailureCors(req, reply);
        return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms", routePath); // Validate range.
      }

      const points = await loadTelemetryPoints(pool, auth.tenant_id, device_id, startMs, endMs, metrics, 20000, req.log); // Load points.
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

      return sendTelemetryCompatibilityResponse(reply, { ok: true, tenant_id: auth.tenant_id, device_id, range: { startTsMs: startMs, endTsMs: endMs }, count: items.length, items }, routePath); // Return metric summary.
    } catch (error) {
      req.log.error({ err: error }, "telemetry.metrics failed");
      applyTelemetryFailureCors(req, reply);
      reply.status(500);
      return sendTelemetryCompatibilityResponse(reply, { ok: false, error: "INTERNAL_ERROR" }, routePath);
    }
  }); // End metrics route.
} // End registration.
