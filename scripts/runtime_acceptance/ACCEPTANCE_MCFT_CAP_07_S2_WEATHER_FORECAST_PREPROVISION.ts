// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_WEATHER_FORECAST_PREPROVISION.ts
// Purpose: prove the real weather forecast read validates and skips historical migration DDL/DML under the Runtime credential.
// Boundary: isolated PostgreSQL readback only; no weather ingestion, canonical fact write, route call, recommendation, or forecast fabrication.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../../apps/server/src/infra/database.js";
import { getLatestWeatherForecastIndexV1 } from "../../apps/server/src/projections/weather_forecast_v1.js";

const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_07_S2_WEATHER_FORECAST_PREPROVISION_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const FORECAST_ID = "wf_s2_preprovision_exact_001";
const assertions: Array<{ name: string; passed: boolean; details?: unknown }> = [];

function check(name: string, condition: unknown, details?: unknown): void {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  assert.equal(passed, true, name);
}

async function prepareWeatherForecast(admin: Pool): Promise<void> {
  await admin.query(`
    DROP TABLE IF EXISTS public.weather_forecast_index_v1 CASCADE;
    DROP FUNCTION IF EXISTS public.s2_reject_weather_forecast_runtime_update_v1() CASCADE;
    CREATE TABLE public.weather_forecast_index_v1 (
      forecast_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      provider text NOT NULL,
      source_type text NOT NULL,
      source_id text NOT NULL,
      latitude double precision,
      longitude double precision,
      generated_at timestamptz NOT NULL,
      issue_time timestamptz NOT NULL,
      forecast_version text NOT NULL,
      provider_run_id text,
      external_forecast_id text,
      version_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      valid_from timestamptz NOT NULL,
      valid_to timestamptz NOT NULL,
      horizon_hours integer NOT NULL,
      rainfall_forecast_mm_72h double precision,
      temperature_max_c_72h double precision,
      et0_mm_72h double precision,
      hourly_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      raw_payload_json jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_weather_forecast_index_v1_scope_latest
      ON public.weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, generated_at DESC);
    CREATE INDEX idx_weather_forecast_index_v1_valid_window
      ON public.weather_forecast_index_v1 (field_id, valid_from, valid_to);
    CREATE INDEX idx_weather_forecast_index_v1_usable_lookup
      ON public.weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, valid_from, valid_to, generated_at DESC);
    INSERT INTO public.weather_forecast_index_v1 (
      forecast_id, tenant_id, project_id, group_id, field_id, provider, source_type, source_id,
      generated_at, issue_time, forecast_version, version_json, valid_from, valid_to, horizon_hours,
      rainfall_forecast_mm_72h, temperature_max_c_72h, et0_mm_72h, hourly_json, quality_json,
      source_fact_id, created_at, updated_at
    ) VALUES (
      '${FORECAST_ID}', 'tenantA', 'projectA', 'groupA', 'field_c8_demo', 'S2_PROVIDER',
      'WEATHER_PROVIDER_API', 's2-source', '2024-03-09T16:00:00.000Z',
      '2024-03-09T16:00:00.000Z', 's2-v1',
      '{"forecast_version":"s2-v1","issue_time":"2024-03-09T16:00:00.000Z"}'::jsonb,
      '2024-03-09T16:00:00.000Z', '2024-03-12T16:00:00.000Z', 72,
      2.0, 31.0, 3.9, '[]'::jsonb,
      '{"stale":false,"missing_fields":[],"provider_status":"OK"}'::jsonb,
      'weather-fact-s2', '2024-03-09T16:00:00.000Z', '2024-03-09T16:00:00.000Z'
    );
    CREATE FUNCTION public.s2_reject_weather_forecast_runtime_update_v1()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'S2_RUNTIME_WEATHER_UPDATE_FORBIDDEN';
    END
    $$;
    CREATE TRIGGER s2_reject_weather_forecast_runtime_update_v1
      BEFORE UPDATE ON public.weather_forecast_index_v1
      FOR EACH ROW EXECUTE FUNCTION public.s2_reject_weather_forecast_runtime_update_v1();
  `);
}

async function main(): Promise<void> {
  try {
    check("database_urls_present", Boolean(ADMIN_URL && RUNTIME_URL));
    check("database_identities_distinct", ADMIN_URL !== RUNTIME_URL);
    const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await prepareWeatherForecast(admin);
    await admin.end();

    const runtime = createDatabasePool(RUNTIME_URL);
    const forecast = await getLatestWeatherForecastIndexV1(
      runtime,
      { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
      "field_c8_demo",
    );
    check("weather_forecast_readback_present", forecast != null, forecast);
    check("weather_forecast_id_exact", forecast?.forecast_id === FORECAST_ID, forecast);
    check("weather_summary_inputs_exact", forecast?.rainfall_forecast_mm_72h === 2 && forecast?.temperature_max_c_72h === 31);
    check("weather_source_quality_exact", forecast?.quality?.provider_status === "OK" && forecast?.quality?.stale === false);
    const row = await runtime.query(
      `SELECT issue_time, forecast_version, version_json, updated_at
         FROM public.weather_forecast_index_v1
        WHERE forecast_id=$1`,
      [FORECAST_ID],
    );
    check("weather_row_unchanged", row.rows.length === 1 && row.rows[0].forecast_version === "s2-v1");
    const privilege = await runtime.query("SELECT pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS can_create");
    check("runtime_schema_create_forbidden", privilege.rows[0]?.can_create === false);
    await runtime.end();

    const result = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_WEATHER_FORECAST_PREPROVISION",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      weather_forecast_id: forecast?.forecast_id ?? null,
      runtime_ddl_performed: false,
      runtime_migration_dml_performed: false,
      canonical_write_authority_delta: "ZERO",
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      acceptance: "MCFT_CAP_07_S2_WEATHER_FORECAST_PREPROVISION",
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
