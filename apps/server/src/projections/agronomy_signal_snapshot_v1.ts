import type { Pool, PoolClient } from "pg";
import { AgronomySignalSnapshotV1Schema, type AgronomySignalSnapshotV1 } from "@geox/contracts";

type DbConn = Pool | PoolClient;

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeSnapshotRow(row: any): any {
  return {
    tenant_id: String(row?.tenant_id ?? ""),
    device_id: String(row?.device_id ?? ""),
    field_id: String(row?.field_id ?? ""),
    season_id: row?.season_id == null ? null : String(row.season_id),
    observed_ts_ms: row?.observed_ts_ms == null ? null : Number(row.observed_ts_ms),
    updated_ts_ms: Number(row?.updated_ts_ms),
    soil_moisture_pct: row?.soil_moisture_pct == null ? null : Number(row.soil_moisture_pct),
    canopy_temp_c: row?.canopy_temp_c == null ? null : Number(row.canopy_temp_c),
    battery_percent: row?.battery_percent == null ? null : Number(row.battery_percent)
  };
}


export async function updateAgronomySnapshot(db: DbConn, tenant_id: string, device_id: string): Promise<AgronomySignalSnapshotV1> {
  const telemetryRows = await db.query(
    `SELECT metric, EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms, value_num
       FROM telemetry_index_v1
      WHERE tenant_id = $1
        AND device_id = $2
        AND metric IN ('soil_moisture', 'canopy_temp')
      ORDER BY ts DESC
      LIMIT 10`,
    [tenant_id, device_id]
  );

  // eslint-disable-next-line no-console
  console.log("[snapshot telemetry rows]", {
    tenant_id,
    device_id,
    rows: telemetryRows.rows
  });

  const latest = await db.query(
    `WITH latest_soil AS (
       SELECT value_num, EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
       FROM telemetry_index_v1
       WHERE tenant_id = $1 AND device_id = $2 AND metric = 'soil_moisture'
       ORDER BY ts DESC
       LIMIT 1
     ), latest_canopy AS (
       SELECT value_num, EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
       FROM telemetry_index_v1
       WHERE tenant_id = $1 AND device_id = $2 AND metric = 'canopy_temp'
       ORDER BY ts DESC
       LIMIT 1
     ), binding AS (
       SELECT field_id
       FROM device_binding_index_v1
       WHERE tenant_id = $1 AND device_id = $2
       ORDER BY COALESCE(bound_ts_ms, 0) DESC
       LIMIT 1
     )
     SELECT
       COALESCE((SELECT field_id FROM binding), 'unbound') AS field_id,
       NULL::text AS season_id,
       COALESCE((SELECT value_num FROM latest_soil), NULL) AS soil_moisture_pct,
       COALESCE((SELECT value_num FROM latest_canopy), NULL) AS canopy_temp_c,
       GREATEST(
         COALESCE((SELECT ts_ms FROM latest_soil), 0),
         COALESCE((SELECT ts_ms FROM latest_canopy), 0)
       )::bigint AS observed_ts_ms,
       (SELECT battery_percent FROM device_status_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1) AS battery_percent`,
    [tenant_id, device_id]
  );

  const row: any = latest.rows?.[0] ?? {};
  const payload = {
    tenant_id,
    device_id,
    field_id: String(row.field_id ?? "unbound"),
    season_id: row.season_id ? String(row.season_id) : null,
    observed_ts_ms: intOrNull(row.observed_ts_ms),
    soil_moisture_pct: numOrNull(row.soil_moisture_pct),
    canopy_temp_c: numOrNull(row.canopy_temp_c),
    battery_percent: intOrNull(row.battery_percent),
    updated_ts_ms: Date.now()
  };

  // eslint-disable-next-line no-console
  console.log("[snapshot upsert payload]", payload);

  const upsert = await db.query(
    `INSERT INTO agronomy_signal_snapshot_v1 (
       tenant_id, device_id, field_id, season_id,
       observed_ts_ms, soil_moisture_pct, canopy_temp_c, battery_percent, updated_ts_ms
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_id, device_id)
     DO UPDATE SET
       field_id = EXCLUDED.field_id,
       season_id = EXCLUDED.season_id,
       observed_ts_ms = EXCLUDED.observed_ts_ms,
       soil_moisture_pct = EXCLUDED.soil_moisture_pct,
       canopy_temp_c = EXCLUDED.canopy_temp_c,
       battery_percent = EXCLUDED.battery_percent,
       updated_ts_ms = EXCLUDED.updated_ts_ms
     RETURNING *`,
    [
      payload.tenant_id,
      payload.device_id,
      payload.field_id,
      payload.season_id,
      payload.observed_ts_ms,
      payload.soil_moisture_pct,
      payload.canopy_temp_c,
      payload.battery_percent,
      payload.updated_ts_ms
    ]
  );

  const snapshot = AgronomySignalSnapshotV1Schema.parse(normalizeSnapshotRow(upsert.rows[0]));
  return snapshot;
}

export async function getAgronomySnapshot(db: DbConn, tenant_id: string, device_id: string): Promise<AgronomySignalSnapshotV1 | null> {
  const res = await db.query(
    `SELECT * FROM agronomy_signal_snapshot_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [tenant_id, device_id]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0];
  // eslint-disable-next-line no-console
  console.log("[snapshot raw row]", row);
  const snapshot = normalizeSnapshotRow(row);
  // eslint-disable-next-line no-console
  console.log("[snapshot mapped]", snapshot);
  return AgronomySignalSnapshotV1Schema.parse(snapshot);
}
