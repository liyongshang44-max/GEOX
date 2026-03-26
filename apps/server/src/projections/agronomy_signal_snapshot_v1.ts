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

export async function updateAgronomySnapshot(db: DbConn, tenant_id: string, device_id: string): Promise<AgronomySignalSnapshotV1> {
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
  const now = Date.now();
  const observed = intOrNull(row.observed_ts_ms);

  const upsert = await db.query(
    `INSERT INTO agronomy_signal_snapshot_v1 (
       tenant_id, project_id, group_id, field_id, season_id, device_id,
       observed_ts_ms, soil_moisture_pct, canopy_temp_c, battery_percent, updated_ts_ms
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (tenant_id, device_id)
     DO UPDATE SET
       project_id = EXCLUDED.project_id,
       group_id = EXCLUDED.group_id,
       field_id = EXCLUDED.field_id,
       season_id = EXCLUDED.season_id,
       observed_ts_ms = EXCLUDED.observed_ts_ms,
       soil_moisture_pct = EXCLUDED.soil_moisture_pct,
       canopy_temp_c = EXCLUDED.canopy_temp_c,
       battery_percent = EXCLUDED.battery_percent,
       updated_ts_ms = EXCLUDED.updated_ts_ms
     RETURNING *`,
    [
      tenant_id,
      "unknown_project",
      "unknown_group",
      String(row.field_id ?? "unbound"),
      row.season_id ? String(row.season_id) : null,
      device_id,
      observed,
      numOrNull(row.soil_moisture_pct),
      numOrNull(row.canopy_temp_c),
      intOrNull(row.battery_percent),
      now
    ]
  );

  const snapshot = AgronomySignalSnapshotV1Schema.parse(upsert.rows[0]);
  return snapshot;
}

export async function getAgronomySnapshot(db: DbConn, tenant_id: string, device_id: string): Promise<AgronomySignalSnapshotV1 | null> {
  const res = await db.query(
    `SELECT * FROM agronomy_signal_snapshot_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [tenant_id, device_id]
  );
  if (!res.rows?.length) return null;
  return AgronomySignalSnapshotV1Schema.parse(res.rows[0]);
}
