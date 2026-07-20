// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_DEVICE_STATUS_COMPATIBILITY.ts
// Purpose: prove an older device-status projection is aligned externally and the report device query remains non-fabricating under the Runtime credential.
// Boundary: isolated PostgreSQL compatibility proof only; no canonical fact, device registration, telemetry ingestion, route call, or status synthesis.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../../apps/server/src/infra/database.js";
import {
  RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1,
  assertRuntimeDeviceStatusCompatibilityV1,
  ensureRuntimeDeviceStatusCompatibilityV1,
} from "../../apps/server/src/infra/runtime_device_status_compatibility_bootstrap_v1.js";

const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_07_S2_DEVICE_STATUS_COMPATIBILITY_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const assertions: Array<{ name: string; passed: boolean; details?: unknown }> = [];

function check(name: string, condition: unknown, details?: unknown): void {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  assert.equal(passed, true, name);
}

async function expectFailure(name: string, operation: () => Promise<unknown>, token: string): Promise<void> {
  let observed = "";
  try { await operation(); } catch (error) { observed = String(error instanceof Error ? error.message : error); }
  check(name, observed.includes(token), { observed, token });
}

async function prepareLegacySchema(admin: Pool): Promise<void> {
  await admin.query(`
    DROP TABLE IF EXISTS public.device_observation_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.device_capability CASCADE;
    DROP TABLE IF EXISTS public.device_status_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.device_binding_index_v1 CASCADE;
    DROP TABLE IF EXISTS public.device_index_v1 CASCADE;

    CREATE TABLE public.device_index_v1 (
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, device_id)
    );
    CREATE TABLE public.device_binding_index_v1 (
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      bound_ts_ms BIGINT,
      PRIMARY KEY (tenant_id, device_id, field_id)
    );
    CREATE TABLE public.device_capability (
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, device_id)
    );
    CREATE TABLE public.device_observation_index_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT,
      group_id TEXT,
      device_id TEXT NOT NULL,
      field_id TEXT,
      metric TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      observed_at_ts_ms BIGINT NOT NULL,
      value_num DOUBLE PRECISION,
      value_text TEXT,
      unit TEXT,
      confidence DOUBLE PRECISION,
      quality_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      fact_id TEXT NOT NULL,
      PRIMARY KEY (tenant_id, device_id, metric, observed_at_ts_ms)
    );

    CREATE TABLE public.device_status_index_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT,
      group_id TEXT,
      device_id TEXT NOT NULL,
      last_telemetry_ts_ms BIGINT,
      last_heartbeat_ts_ms BIGINT,
      battery_percent INTEGER,
      rssi_dbm INTEGER,
      fw_ver TEXT,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, device_id)
    );

    INSERT INTO public.device_index_v1 VALUES
      ('tenantA','dev_soil_c8_001','C8 Soil Sensor',1710000000000),
      ('tenantA','dev_weather_station_c8_001','C8 Weather Station',1710000000000);
    INSERT INTO public.device_binding_index_v1 VALUES
      ('tenantA','dev_soil_c8_001','field_c8_demo',1710000000000),
      ('tenantA','dev_weather_station_c8_001','field_c8_demo',1710000000001);
    INSERT INTO public.device_capability VALUES
      ('tenantA','dev_soil_c8_001','["soil_moisture_sensor"]'::jsonb,1710000000000),
      ('tenantA','dev_weather_station_c8_001','["weather_station","rain_sensor"]'::jsonb,1710000000000);
    INSERT INTO public.device_status_index_v1 VALUES
      ('tenantA','projectA','groupA','dev_soil_c8_001',1710000000000,1710000000000,90,-55,'1.0.0',1710000000000),
      ('tenantA','projectA','groupA','dev_weather_station_c8_001',1710000000000,1710000000000,88,-52,'1.0.0',1710000000000);
    INSERT INTO public.device_observation_index_v1 VALUES
      ('tenantA','projectA','groupA','dev_soil_c8_001','field_c8_demo','soil_moisture_percent','2024-03-09T16:00:00.000Z',1710000000000,18.4,NULL,'%',1.0,'[]'::jsonb,'soil-fact'),
      ('tenantA','projectA','groupA','dev_weather_station_c8_001','field_c8_demo','forecast_rain_72h_mm','2024-03-09T16:00:00.000Z',1710000000000,2.0,NULL,'mm',1.0,'[]'::jsonb,'weather-fact');
  `);
}

async function replayLegacyDeviceStatusEnsure(runtime: Pool): Promise<void> {
  await runtime.query(`
    CREATE TABLE IF NOT EXISTS device_status_index_v1 (
      tenant_id TEXT NOT NULL,
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
    )
  `);
  for (const statement of [
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS field_id TEXT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_telemetry_ts_ms BIGINT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_heartbeat_ts_ms BIGINT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS last_seen_ts_ms BIGINT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS battery_percent INTEGER",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS rssi_dbm INTEGER",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS fw_ver TEXT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS status TEXT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS updated_ts_ms BIGINT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS note TEXT",
    "ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS tenant_id TEXT",
  ]) await runtime.query(statement);
}

async function queryReportDevices(runtime: Pool): Promise<any[]> {
  const result = await runtime.query(`
    SELECT b.device_id,
           COALESCE(d.display_name, b.device_id) AS display_name,
           c.capabilities::jsonb AS capabilities,
           o.metric,
           o.value_num,
           o.unit,
           COALESCE(
             NULLIF(UPPER(BTRIM(s.status)), ''),
             CASE
               WHEN GREATEST(COALESCE(s.last_heartbeat_ts_ms, 0), COALESCE(s.last_telemetry_ts_ms, 0)) > 0 THEN 'ONLINE'
               ELSE 'UNKNOWN'
             END
           ) AS online_status,
           s.status AS stored_status,
           s.last_heartbeat_ts_ms,
           s.last_telemetry_ts_ms
      FROM device_binding_index_v1 b
      LEFT JOIN device_index_v1 d ON d.tenant_id = b.tenant_id AND d.device_id = b.device_id
      LEFT JOIN device_status_index_v1 s ON s.tenant_id = b.tenant_id AND s.project_id = $2 AND s.group_id = $3 AND s.device_id = b.device_id
      LEFT JOIN device_capability c ON c.tenant_id = b.tenant_id AND c.device_id = b.device_id
      LEFT JOIN LATERAL (
        SELECT metric, value_num, unit
          FROM device_observation_index_v1
         WHERE tenant_id = b.tenant_id
           AND project_id = $2
           AND group_id = $3
           AND field_id = b.field_id
           AND device_id = b.device_id
         ORDER BY observed_at_ts_ms DESC
         LIMIT 1
      ) o ON true
     WHERE b.tenant_id = $1 AND b.field_id = $4
     ORDER BY b.bound_ts_ms DESC NULLS LAST, b.device_id ASC
     LIMIT 20
  `, ["tenantA", "projectA", "groupA", "field_c8_demo"]);
  return result.rows;
}

async function main(): Promise<void> {
  try {
    check("database_urls_present", Boolean(ADMIN_URL && RUNTIME_URL));
    check("database_identities_distinct", ADMIN_URL !== RUNTIME_URL);
    const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await prepareLegacySchema(admin);
    await ensureRuntimeDeviceStatusCompatibilityV1(admin);
    const synthesized = await admin.query("SELECT count(*)::int AS count FROM public.device_status_index_v1 WHERE status IS NOT NULL");
    check("status_not_synthesized", Number(synthesized.rows[0]?.count ?? -1) === 0);
    await admin.end();

    const runtime = createDatabasePool(RUNTIME_URL);
    await assertRuntimeDeviceStatusCompatibilityV1(runtime);
    await replayLegacyDeviceStatusEnsure(runtime);
    const rows = await queryReportDevices(runtime);
    check("report_device_count_exact", rows.length === 2, rows);
    check("report_device_ids_exact", new Set(rows.map((row) => row.device_id)).size === 2);
    check("stored_status_remains_null", rows.every((row) => row.stored_status == null));
    check("online_status_derived_from_evidence", rows.every((row) => row.online_status === "ONLINE"));
    await expectFailure(
      "unregistered_device_status_column_forbidden",
      () => runtime.query("ALTER TABLE device_status_index_v1 ADD COLUMN IF NOT EXISTS fabricated_status TEXT"),
      "RUNTIME_SCHEMA_COLUMN_PREPROVISION_REQUIRED",
    );
    const privilege = await runtime.query("SELECT pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS can_create");
    check("runtime_schema_create_forbidden", privilege.rows[0]?.can_create === false);
    await runtime.end();

    const result = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_DEVICE_STATUS_COMPATIBILITY",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      required_column_count: RUNTIME_DEVICE_STATUS_REQUIRED_COLUMNS_V1.length,
      report_device_count: rows.length,
      status_value_synthesized: false,
      runtime_ddl_performed: false,
      canonical_write_authority_delta: "ZERO",
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      acceptance: "MCFT_CAP_07_S2_DEVICE_STATUS_COMPATIBILITY",
      error: String(error instanceof Error ? error.stack || error.message : error),
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

void main();
