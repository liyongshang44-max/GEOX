// GEOX/apps/server/src/routes/telemetry_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify app instance for route registration.
import type { Pool } from "pg"; // Postgres connection pool for query execution.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Reuse Sprint 19 token/scope auth for tenant isolation (Sprint A1).
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context for tenant_id filtering.

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

/**
 * Sprint A1: Telemetry query (read-only)
 *
 * GET /api/telemetry/v1/query?device_id=...&metric=...&from_ts_ms=...&to_ts_ms=...&limit=...
 *
 * Guarantees:
 * - Read-only.
 * - Tenant-isolated via bearer token (reuse ao_act_tokens_v0 SSOT).
 * - Does NOT require device registration (A2 will add device lifecycle + credentials).
 */
export function registerTelemetryV1Routes(app: FastifyInstance, pool: Pool) { // Register telemetry v1 routes.
  app.get("/api/telemetry/v1/query", async (req, reply) => { // Query telemetry projection by tenant+device+time.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "telemetry.read"); // Enforce scope and obtain tenant context.
    if (!auth) return; // Authorization helper already replied (401/403/404 semantics).

    const q: any = (req as any).query ?? {}; // Read query params from request.

    const device_id: string | null = isNonEmptyString(q.device_id) ? String(q.device_id).trim() : null; // Required device id.
    if (!device_id) return badRequest(reply, "MISSING:device_id"); // device_id is mandatory.

    const metric: string | null = isNonEmptyString(q.metric) ? String(q.metric).trim() : null; // Optional metric filter.

    const from_ts_ms = parseFiniteInt(q.from_ts_ms); // Optional lower bound in epoch ms.
    const to_ts_ms = parseFiniteInt(q.to_ts_ms); // Optional upper bound in epoch ms.

    // Default range: last 24h if caller does not provide bounds.
    const nowMs = Date.now(); // Current time ms.
    const startMs = from_ts_ms ?? (nowMs - 24 * 60 * 60 * 1000); // Default start = now - 24h.
    const endMs = to_ts_ms ?? nowMs; // Default end = now.

    if (startMs > endMs) return badRequest(reply, "INVALID_RANGE:from_ts_ms_gt_to_ts_ms"); // Validate bounds ordering.

    const limitRaw = parseFiniteInt(q.limit); // Optional limit.
    const limit = Math.max(1, Math.min(limitRaw ?? 5000, 20000)); // Clamp limit to avoid abuse.

    const where: string[] = []; // SQL WHERE fragments.
    const values: any[] = []; // Param values.
    let i = 1; // 1-based param index.

    where.push(`tenant_id = $${i++}`); // Tenant isolation condition.
    values.push(auth.tenant_id); // Bind tenant_id from auth context.

    where.push(`device_id = $${i++}`); // Device filter.
    values.push(device_id); // Bind device id.

    where.push(`ts >= $${i++}::timestamptz`); // Lower bound.
    values.push(new Date(startMs).toISOString()); // Bind start ISO.

    where.push(`ts <= $${i++}::timestamptz`); // Upper bound.
    values.push(new Date(endMs).toISOString()); // Bind end ISO.

    if (metric) { // Optional metric filter.
      where.push(`metric = $${i++}`); // Add metric clause.
      values.push(metric); // Bind metric.
    }

    const sql = `
      SELECT tenant_id, device_id, metric, ts, value_num, value_text, fact_id
      FROM telemetry_index_v1
      WHERE ${where.join(" AND ")}
      ORDER BY ts ASC
      LIMIT ${limit}
    `; // Query projection in time order.

    const r = await pool.query(sql, values); // Execute query.
    const rows = r.rows ?? []; // Result rows.

    return reply.send({ // Send query response.
      ok: true, // Success flag.
      tenant_id: auth.tenant_id, // Echo tenant for caller debugging (non-sensitive).
      device_id, // Echo device_id.
      metric: metric ?? null, // Echo metric if provided.
      range: { startTsMs: startMs, endTsMs: endMs }, // Echo resolved range.
      count: rows.length, // Number of returned points.
      points: rows.map((row: any) => ({ // Map db rows to JSON-friendly format.
        metric: row.metric, // Metric string.
        ts_ms: new Date(row.ts).getTime(), // Timestamp ms.
        value_num: row.value_num === null ? null : Number(row.value_num), // Numeric value (if any).
        value_text: row.value_text === null ? null : String(row.value_text), // Text value (if any).
        fact_id: String(row.fact_id), // Ledger fact id for evidence linkage.
      })), // Points array.
    }); // End response.
  }); // End route.
} // End registration.
