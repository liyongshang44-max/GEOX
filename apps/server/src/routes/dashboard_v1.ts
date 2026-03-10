import type { FastifyInstance } from "fastify"; // Fastify route host typing.
import type { Pool } from "pg"; // Postgres pool typing.
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Reuse AO-ACT bearer auth helper.

type DashboardTrendPoint = { ts_ms: number; avg_value_num: number | null; sample_count: number; }; // Bucketed trend point.
type DashboardTrendSeries = { metric: string; points: DashboardTrendPoint[]; }; // Metric trend series.
type DashboardAlertItem = { event_id: string; rule_id: string; object_type: string; object_id: string; metric: string; status: string; raised_ts_ms: number; }; // Compact alert row.
type DashboardReceiptItem = { fact_id: string; act_task_id: string | null; device_id: string | null; status: string | null; occurred_at: string; occurred_ts_ms: number; }; // Compact receipt row.

function badRequest(reply: any, error: string) { return reply.status(400).send({ ok: false, error }); } // Stable 400 helper.
function parseWindowStart(q: any): number { const raw = Number(q?.from_ts_ms ?? Date.now() - 24 * 60 * 60 * 1000); return Number.isFinite(raw) ? raw : Date.now() - 24 * 60 * 60 * 1000; } // Parse dashboard window start.
function parseWindowEnd(q: any): number { const raw = Number(q?.to_ts_ms ?? Date.now() + 60 * 1000); return Number.isFinite(raw) ? raw : Date.now() + 60 * 1000; } // Parse dashboard window end.
function parseJsonMaybe(v: any): any { if (v && typeof v === "object") return v; if (typeof v !== "string") return null; try { return JSON.parse(v); } catch { return null; } } // Parse json/jsonb/string payloads.

function bucketTelemetryRows(rows: any[], fromTsMs: number, toTsMs: number): DashboardTrendSeries[] { // Convert raw telemetry rows into fixed buckets.
  const metrics = ["soil_moisture", "soil_temp"]; // Blueprint default metrics.
  const spanMs = Math.max(60 * 60 * 1000, toTsMs - fromTsMs); // Guarantee positive span.
  const bucketMs = Math.max(60 * 60 * 1000, Math.floor(spanMs / 12)); // Roughly 12 buckets.
  const byMetric = new Map<string, Map<number, { sum: number; count: number }>>(); // Per-metric bucket accumulator.
  for (const metric of metrics) byMetric.set(metric, new Map<number, { sum: number; count: number }>()); // Seed metrics.
  for (const row of rows ?? []) { // Walk numeric telemetry rows.
    const metric = String(row.metric ?? "").trim(); // Normalize metric.
    if (!byMetric.has(metric)) continue; // Ignore unrelated metrics.
    const tsMs = Number(row.ts_ms ?? 0); // Normalize timestamp.
    const valueNum = Number(row.value_num); // Normalize numeric value.
    if (!Number.isFinite(tsMs) || !Number.isFinite(valueNum)) continue; // Skip malformed samples.
    const bucketStart = fromTsMs + Math.floor((tsMs - fromTsMs) / bucketMs) * bucketMs; // Snap into bucket.
    const metricBuckets = byMetric.get(metric)!; // Read metric bucket map.
    const current = metricBuckets.get(bucketStart) ?? { sum: 0, count: 0 }; // Load aggregate or seed.
    current.sum += valueNum; // Add sample value.
    current.count += 1; // Increase sample count.
    metricBuckets.set(bucketStart, current); // Persist aggregate.
  }
  return metrics.map((metric) => { // Emit ordered series.
    const metricBuckets = byMetric.get(metric) ?? new Map<number, { sum: number; count: number }>(); // Read map.
    const points: DashboardTrendPoint[] = []; // Output points.
    for (let cursor = fromTsMs; cursor <= toTsMs; cursor += bucketMs) { // Fill stable buckets.
      const bucket = metricBuckets.get(cursor); // Check aggregated bucket.
      points.push({ ts_ms: cursor, avg_value_num: bucket && bucket.count > 0 ? Number((bucket.sum / bucket.count).toFixed(2)) : null, sample_count: bucket?.count ?? 0 }); // Append point.
    }
    return { metric, points }; // Emit series.
  });
}

export function registerDashboardV1Routes(app: FastifyInstance, pool: Pool): void { // Register dashboard summary routes.
  app.get("/api/v1/dashboard/overview", async (req, reply) => { // Provide commercial dashboard overview payload.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Shared read scope for admin/operator ops views.
    if (!auth) return; // Auth helper already responded.

    const q: any = (req as any).query ?? {}; // Read query object.
    const from_ts_ms = parseWindowStart(q); // Parse dashboard window start.
    const to_ts_ms = parseWindowEnd(q); // Parse dashboard window end.
    if (to_ts_ms <= from_ts_ms) return badRequest(reply, "INVALID_TIME_WINDOW"); // Reject inverted windows.

    const tenant_id = String(auth.tenant_id ?? ""); // Tenant isolation key.
    const project_id = String(auth.project_id ?? ""); // Project isolation key.
    const group_id = String(auth.group_id ?? ""); // Group isolation key.
    const onlineCutoffMs = Date.now() - 15 * 60 * 1000; // Match existing ONLINE device definition.

    const [fieldCountQ, onlineDeviceCountQ, openAlertCountQ, trendRowsQ, latestAlertsQ, latestReceiptsQ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::bigint AS count FROM field_index_v1 WHERE tenant_id = $1`, [tenant_id]),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM device_status_index_v1 WHERE tenant_id = $1 AND last_heartbeat_ts_ms IS NOT NULL AND last_heartbeat_ts_ms >= $2`, [tenant_id, onlineCutoffMs]),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM alert_event_index_v1 WHERE tenant_id = $1 AND status IN ('OPEN','ACKED')`, [tenant_id]),
      pool.query(`SELECT metric, (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS ts_ms, value_num FROM telemetry_index_v1 WHERE tenant_id = $1 AND metric = ANY($2::text[]) AND value_num IS NOT NULL AND ts >= to_timestamp($3::double precision / 1000.0) AND ts <= to_timestamp($4::double precision / 1000.0) ORDER BY ts ASC LIMIT 5000`, [tenant_id, ["soil_moisture", "soil_temp"], from_ts_ms, to_ts_ms]),
      pool.query(`SELECT event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms FROM alert_event_index_v1 WHERE tenant_id = $1 ORDER BY raised_ts_ms DESC LIMIT 10`, [tenant_id]),
      pool.query(`SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3 ORDER BY occurred_at DESC, fact_id DESC LIMIT 10`, [tenant_id, project_id, group_id]),
    ]); // Parallelize independent reads.

    let running_task_count = 0; // Default queue count when runtime table is absent.
    try {
      const runningQ = await pool.query(`SELECT COUNT(*)::bigint AS count FROM dispatch_queue_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND state IN ('READY','LEASED','PUBLISHED','ACKED')`, [tenant_id, project_id, group_id]); // Query queue rows.
      running_task_count = Number(runningQ.rows?.[0]?.count ?? 0); // Normalize count.
    } catch {
      running_task_count = 0; // Fresh DB fallback.
    }

    const latest_alerts: DashboardAlertItem[] = (latestAlertsQ.rows ?? []).map((row: any) => ({ event_id: String(row.event_id), rule_id: String(row.rule_id), object_type: String(row.object_type), object_id: String(row.object_id), metric: String(row.metric), status: String(row.status), raised_ts_ms: Number(row.raised_ts_ms ?? 0) })); // Normalize alert rows.
    const latest_receipts: DashboardReceiptItem[] = (latestReceiptsQ.rows ?? []).map((row: any) => { const receipt = parseJsonMaybe(row.record_json) ?? row.record_json; const payload = receipt?.payload ?? {}; return { fact_id: String(row.fact_id), act_task_id: typeof payload.act_task_id === "string" ? payload.act_task_id : null, device_id: typeof payload?.meta?.device_id === "string" ? payload.meta.device_id : typeof payload?.executor_id?.id === "string" ? payload.executor_id.id : null, status: typeof payload.status === "string" ? payload.status : null, occurred_at: String(row.occurred_at), occurred_ts_ms: Date.parse(String(row.occurred_at)) }; }); // Normalize receipt rows.

    return reply.send({
      ok: true,
      window: { from_ts_ms, to_ts_ms },
      summary: {
        field_count: Number(fieldCountQ.rows?.[0]?.count ?? 0),
        online_device_count: Number(onlineDeviceCountQ.rows?.[0]?.count ?? 0),
        open_alert_count: Number(openAlertCountQ.rows?.[0]?.count ?? 0),
        running_task_count,
      },
      trend_series: bucketTelemetryRows(trendRowsQ.rows ?? [], from_ts_ms, to_ts_ms),
      latest_alerts,
      latest_receipts,
      quick_actions: [
        { key: "create_operation", label: "create_operation", to: "/operations" }, // ASCII-safe label; frontend localizes by key.
        { key: "export_evidence", label: "export_evidence", to: "/delivery/export-jobs" }, // ASCII-safe label; frontend localizes by key.
        { key: "ack_alerts", label: "ack_alerts", to: "/alerts" }, // ASCII-safe label; frontend localizes by key.
      ],
    }); // End response.
  }); // End route.
} // End registration.
