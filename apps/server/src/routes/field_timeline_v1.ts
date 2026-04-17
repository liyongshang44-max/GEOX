import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type TrajectoryPoint = { lat: number; lon: number; ts_ms: number; device_id: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseJsonOrNull(v: any): any | null {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function normalizeGeoPoint(raw: any): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const latCandidates = [raw.lat, raw.latitude, raw?.location?.lat, raw?.location?.latitude];
  const lonCandidates = [raw.lon, raw.lng, raw.longitude, raw?.location?.lon, raw?.location?.lng, raw?.location?.longitude];
  let lat: number | null = null;
  let lon: number | null = null;
  for (const v of latCandidates) { const n = Number(v); if (Number.isFinite(n)) { lat = n; break; } }
  for (const v of lonCandidates) { const n = Number(v); if (Number.isFinite(n)) { lon = n; break; } }
  if (lat == null || lon == null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id)
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function registerFieldTimelineV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/fields/:field_id/timeline", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    const sinceMs = Number((req as any).query?.since_ts_ms ?? (Date.now() - 7 * 24 * 3600 * 1000));
    const startMs = Number.isFinite(sinceMs) ? sinceMs : (Date.now() - 7 * 24 * 3600 * 1000);

    const ops = (await projectOperationStateV1(pool, tenant))
      .filter((x) => String(x.field_id ?? "") === field_id)
      .map((x) => ({
        operation_id: x.operation_id,
        operation_plan_id: x.operation_plan_id,
        recommendation_id: x.recommendation_id,
        approval_request_id: x.approval_request_id,
        task_id: x.task_id,
        device_id: x.device_id,
        final_status: x.final_status,
        last_event_ts: x.last_event_ts,
        timeline: x.timeline
      }));

    const alertQ = await pool.query(
      `SELECT event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms
         FROM alert_event_index_v1
        WHERE tenant_id = $1
          AND (
            (object_type = 'FIELD' AND object_id = $2)
            OR (object_type = 'DEVICE' AND object_id IN (
              SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2
            ))
          )
          AND raised_ts_ms >= $3
        ORDER BY raised_ts_ms DESC
        LIMIT 500`,
      [tenant.tenant_id, field_id, startMs]
    );

    const trajQ = await pool.query(
      `SELECT (record_json::jsonb #>> '{entity,device_id}') AS device_id,
              COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
              (record_json::jsonb #> '{payload,geo}') AS geo_json
         FROM facts
        WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,device_id}') IN (
            SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2
          )
          AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
          AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
          AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) >= $3
        ORDER BY ts_ms ASC
        LIMIT 5000`,
      [tenant.tenant_id, field_id, startMs]
    );

    const trajectories: TrajectoryPoint[] = [];
    for (const row of trajQ.rows ?? []) {
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      const ts_ms = Number(row.ts_ms ?? 0);
      const device_id = String(row.device_id ?? "").trim();
      if (!geo || !isFiniteNumber(ts_ms) || ts_ms <= 0 || !device_id) continue;
      trajectories.push({ device_id, lat: geo.lat, lon: geo.lon, ts_ms });
    }

    return reply.send({
      ok: true,
      field_id,
      operations: ops,
      alerts: alertQ.rows ?? [],
      trajectories
    });
  });
}
