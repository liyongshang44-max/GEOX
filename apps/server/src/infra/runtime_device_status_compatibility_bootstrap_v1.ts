// apps/server/src/infra/runtime_device_status_compatibility_bootstrap_v1.ts
// Purpose: align the legacy device-status projection before Runtime report reads without fabricating device status.
// Boundary: external one-shot additive schema compatibility only; status remains nullable and no device rows are synthesized.

import { Pool, type PoolClient } from "pg";

export const RUNTIME_DEVICE_STATUS_RELATION_V1 = "public.device_status_index_v1" as const;
export const RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1 = [
  "tenant_id",
  "project_id",
  "group_id",
  "device_id",
  "field_id",
  "last_telemetry_ts_ms",
  "last_heartbeat_ts_ms",
  "last_seen_ts_ms",
  "battery_percent",
  "rssi_dbm",
  "fw_ver",
  "status",
  "updated_ts_ms",
  "note",
] as const;

export async function ensureRuntimeDeviceStatusCompatibilityV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.device_status_index_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT,
      group_id TEXT,
      device_id TEXT NOT NULL,
      field_id TEXT,
      last_telemetry_ts_ms BIGINT,
      last_heartbeat_ts_ms BIGINT,
      last_seen_ts_ms BIGINT,
      battery_percent INTEGER,
      rssi_dbm INTEGER,
      fw_ver TEXT,
      status TEXT,
      updated_ts_ms BIGINT,
      note TEXT,
      PRIMARY KEY (tenant_id, device_id)
    );
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS project_id TEXT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS group_id TEXT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS last_telemetry_ts_ms BIGINT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS last_heartbeat_ts_ms BIGINT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS last_seen_ts_ms BIGINT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS battery_percent INTEGER;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS rssi_dbm INTEGER;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS fw_ver TEXT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS updated_ts_ms BIGINT;
    ALTER TABLE public.device_status_index_v1 ADD COLUMN IF NOT EXISTS note TEXT;
    CREATE INDEX IF NOT EXISTS device_status_index_v1_scope_device_idx
      ON public.device_status_index_v1 (tenant_id, project_id, group_id, device_id);
  `);
  await assertRuntimeDeviceStatusCompatibilityV1(pool);
}

export async function assertRuntimeDeviceStatusCompatibilityV1(
  client: Pick<PoolClient, "query"> | Pick<Pool, "query">,
): Promise<void> {
  const result = await client.query<{
    relation_exists: boolean;
    observed_column_count: number;
    status_not_null: boolean | null;
  }>(
    `SELECT pg_catalog.to_regclass($1) IS NOT NULL AS relation_exists,
            (SELECT pg_catalog.count(*)::int
               FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = pg_catalog.to_regclass($1)
                AND attribute.attname = ANY($2::text[])
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped) AS observed_column_count,
            (SELECT attribute.attnotnull
               FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = pg_catalog.to_regclass($1)
                AND attribute.attname = 'status'
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped) AS status_not_null`,
    [RUNTIME_DEVICE_STATUS_RELATION_V1, RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1],
  );
  const row = result.rows[0];
  if (!row?.relation_exists) {
    throw new Error("RUNTIME_DEVICE_STATUS_COMPATIBILITY_NOT_ESTABLISHED:RELATION");
  }
  if (Number(row.observed_column_count ?? 0) !== RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1.length) {
    throw new Error("RUNTIME_DEVICE_STATUS_COMPATIBILITY_NOT_ESTABLISHED:COLUMNS");
  }
  if (row.status_not_null === true) {
    throw new Error("RUNTIME_DEVICE_STATUS_COMPATIBILITY_INVALID:STATUS_MUST_REMAIN_NULLABLE");
  }
}

export async function runRuntimeDeviceStatusCompatibilityBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  if (!adminDatabaseUrl) throw new Error("RUNTIME_DEVICE_STATUS_ADMIN_DATABASE_URL_REQUIRED");
  if (String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim() === adminDatabaseUrl) {
    throw new Error("RUNTIME_DEVICE_STATUS_RUNTIME_CREDENTIAL_FORBIDDEN");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    await ensureRuntimeDeviceStatusCompatibilityV1(pool);
    console.log(JSON.stringify({
      status: "PASS",
      relation: RUNTIME_DEVICE_STATUS_RELATION_V1,
      required_column_count: RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1.length,
      status_value_synthesized: false,
    }));
  } finally {
    await pool.end();
  }
}
