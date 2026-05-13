import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export type FieldObservabilityProfileV1 = {
  field_id: string;
  status: "UNOBSERVED" | "PARTIALLY_OBSERVED" | "OBSERVED";
  device_coverage: {
    soil_probe: boolean;
    weather: boolean;
    remote_sensing: boolean;
    machinery: boolean;
  };
  data_window: {
    start_at: string | null;
    end_at: string | null;
    duration_hours: number | null;
  };
  confidence: number;
  missing_inputs: string[];
};

function msToIso(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

function durationHours(startMs: number | null, endMs: number | null): number | null {
  if (startMs == null || endMs == null || endMs < startMs) return null;
  return Number(((endMs - startMs) / 3_600_000).toFixed(2));
}

export async function resolveFieldObservabilityProfileV1(pool: Pool, tenant: TenantTriple, field_id: string): Promise<FieldObservabilityProfileV1> {
  const deviceQ = await pool.query(
    `SELECT b.device_id, COALESCE(s.last_telemetry_ts_ms, s.last_heartbeat_ts_ms) AS last_ts
       FROM device_binding_index_v1 b
       LEFT JOIN device_status_index_v1 s ON s.tenant_id = b.tenant_id AND s.device_id = b.device_id
      WHERE b.tenant_id = $1 AND b.field_id = $2`,
    [tenant.tenant_id, field_id],
  ).catch(() => ({ rows: [] as any[] }));

  const obsQ = await pool.query(
    `SELECT MIN(observed_at_ts_ms)::bigint AS start_ts, MAX(observed_at_ts_ms)::bigint AS end_ts, COUNT(*)::int AS n
       FROM device_observation_index_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id],
  ).catch(() => ({ rows: [] as any[] }));

  const devices = deviceQ.rows ?? [];
  const obs = obsQ.rows?.[0] ?? {};
  const startMs = Number.isFinite(Number(obs.start_ts)) ? Number(obs.start_ts) : null;
  const endMs = Number.isFinite(Number(obs.end_ts)) ? Number(obs.end_ts) : null;
  const observationCount = Number(obs.n ?? 0);
  const hasDevice = devices.length > 0;
  const hasRecentTelemetry = devices.some((row: any) => Number.isFinite(Number(row.last_ts)) && Number(row.last_ts) > Date.now() - 24 * 60 * 60 * 1000);
  const soil_probe = hasDevice || observationCount > 0;
  const coverage = { soil_probe, weather: false, remote_sensing: false, machinery: false };
  const coveredCount = Object.values(coverage).filter(Boolean).length;
  const status: FieldObservabilityProfileV1["status"] = coveredCount >= 2 || (soil_probe && hasRecentTelemetry) ? "OBSERVED" : coveredCount > 0 ? "PARTIALLY_OBSERVED" : "UNOBSERVED";
  const missing_inputs = Object.entries(coverage).filter(([, ok]) => !ok).map(([key]) => key);
  const confidence = status === "OBSERVED" ? 0.8 : status === "PARTIALLY_OBSERVED" ? 0.45 : 0.1;

  return {
    field_id,
    status,
    device_coverage: coverage,
    data_window: { start_at: msToIso(startMs), end_at: msToIso(endMs), duration_hours: durationHours(startMs, endMs) },
    confidence,
    missing_inputs,
  };
}
