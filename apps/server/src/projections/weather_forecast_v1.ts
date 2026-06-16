// apps/server/src/projections/weather_forecast_v1.ts
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";

export type WeatherForecastFactV1 = {
  type: "weather_forecast_fact_v1";
  payload: {
    forecast_id: string;
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    provider: string;
    source_type: "WEATHER_PROVIDER_API" | "WEATHER_STATION" | "MANUAL_OBSERVATION" | "MOCK";
    source_id: string;
    latitude: number | null;
    longitude: number | null;
    generated_at: string;
    issue_time: string;
    forecast_version: string;
    provider_run_id: string | null;
    external_forecast_id: string | null;
    version: Record<string, unknown>;
    valid_from: string;
    valid_to: string;
    horizon_hours: number;
    rainfall_forecast_mm_72h: number | null;
    temperature_max_c_72h: number | null;
    et0_mm_72h: number | null;
    hourly: unknown[];
    quality: {
      stale: boolean;
      missing_fields: string[];
      provider_status: "OK" | "PARTIAL" | "FAILED";
    };
    raw_payload?: unknown;
  };
};

export type WeatherForecastIndexV1 = WeatherForecastFactV1["payload"] & {
  source_fact_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function finiteNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function stableForecastId(input: WeatherForecastFactV1["payload"]): string {
  const raw = [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.field_id,
    input.provider,
    input.source_type,
    input.source_id,
    input.issue_time,
    input.forecast_version,
    input.provider_run_id ?? "",
    input.external_forecast_id ?? "",
    input.generated_at,
    input.valid_from,
    input.valid_to,
  ].join("|");

  return "wf_" + createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function rowToWeatherForecastIndexV1(row: any): WeatherForecastIndexV1 {
  return {
    forecast_id: row.forecast_id,
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
    provider: row.provider,
    source_type: row.source_type,
    source_id: row.source_id,
    latitude: finiteNumberOrNull(row.latitude),
    longitude: finiteNumberOrNull(row.longitude),
    generated_at: new Date(row.generated_at).toISOString(),
    issue_time: row.issue_time ? new Date(row.issue_time).toISOString() : new Date(row.generated_at).toISOString(),
    forecast_version: row.forecast_version ?? row.forecast_id,
    provider_run_id: row.provider_run_id ?? null,
    external_forecast_id: row.external_forecast_id ?? null,
    version: row.version_json ?? {},
    valid_from: new Date(row.valid_from).toISOString(),
    valid_to: new Date(row.valid_to).toISOString(),
    horizon_hours: Number(row.horizon_hours),
    rainfall_forecast_mm_72h: finiteNumberOrNull(row.rainfall_forecast_mm_72h),
    temperature_max_c_72h: finiteNumberOrNull(row.temperature_max_c_72h),
    et0_mm_72h: finiteNumberOrNull(row.et0_mm_72h),
    hourly: Array.isArray(row.hourly_json) ? row.hourly_json : [],
    quality: row.quality_json ?? { stale: false, missing_fields: [], provider_status: "OK" },
    raw_payload: row.raw_payload_json ?? null,
    source_fact_id: row.source_fact_id ?? null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export async function ensureWeatherForecastIndexV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weather_forecast_index_v1 (
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
      issue_time timestamptz NOT NULL DEFAULT now(),
      forecast_version text NOT NULL DEFAULT 'v1',
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
    )
  `);

  await pool.query(`
    ALTER TABLE weather_forecast_index_v1
      ADD COLUMN IF NOT EXISTS issue_time timestamptz,
      ADD COLUMN IF NOT EXISTS forecast_version text,
      ADD COLUMN IF NOT EXISTS provider_run_id text,
      ADD COLUMN IF NOT EXISTS external_forecast_id text,
      ADD COLUMN IF NOT EXISTS version_json jsonb NOT NULL DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    UPDATE weather_forecast_index_v1
       SET issue_time = COALESCE(issue_time, generated_at),
           forecast_version = COALESCE(forecast_version, forecast_id),
           version_json = CASE
             WHEN version_json IS NULL OR version_json = '{}'::jsonb THEN
               jsonb_build_object(
                 'forecast_version', COALESCE(forecast_version, forecast_id),
                 'issue_time', COALESCE(issue_time, generated_at),
                 'provider_run_id', provider_run_id,
                 'external_forecast_id', external_forecast_id
               )
             ELSE version_json
           END
     WHERE issue_time IS NULL
        OR forecast_version IS NULL
        OR version_json IS NULL
        OR version_json = '{}'::jsonb
  `);

  await pool.query(`
    ALTER TABLE weather_forecast_index_v1
      ALTER COLUMN issue_time SET NOT NULL,
      ALTER COLUMN forecast_version SET NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_scope_latest
      ON weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, generated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_valid_window
      ON weather_forecast_index_v1 (field_id, valid_from, valid_to)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_usable_lookup
      ON weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, valid_from, valid_to, generated_at DESC)
  `);
}

export function normalizeWeatherForecastFactV1(input: Partial<WeatherForecastFactV1["payload"]>): WeatherForecastFactV1["payload"] {
  const nowIso = new Date().toISOString();

  const generatedAt = textOrNull(input.generated_at) ?? nowIso;
  const issueTime = textOrNull(input.issue_time) ?? generatedAt;
  const horizonHours = Number.isFinite(Number(input.horizon_hours)) ? Number(input.horizon_hours) : 72;
  const validFrom = textOrNull(input.valid_from) ?? generatedAt;
  const validTo = textOrNull(input.valid_to) ?? new Date(Date.parse(validFrom) + horizonHours * 60 * 60 * 1000).toISOString();

  const provider = textOrNull(input.provider) ?? "MOCK";
  const sourceType = (textOrNull(input.source_type) as WeatherForecastFactV1["payload"]["source_type"]) ?? "MOCK";
  const sourceId = textOrNull(input.source_id) ?? "weather_forecast_seed";
  const providerRunId = textOrNull(input.provider_run_id);
  const externalForecastId = textOrNull(input.external_forecast_id);
  const forecastVersion = textOrNull(input.forecast_version) ?? [provider, sourceId, issueTime].join(":");

  const version = {
    ...recordOrEmpty(input.version),
    forecast_version: forecastVersion,
    issue_time: issueTime,
    provider_run_id: providerRunId,
    external_forecast_id: externalForecastId,
  };

  const payload: WeatherForecastFactV1["payload"] = {
    forecast_id: textOrNull(input.forecast_id) ?? "",
    tenant_id: textOrNull(input.tenant_id) ?? "tenantA",
    project_id: textOrNull(input.project_id) ?? "projectA",
    group_id: textOrNull(input.group_id) ?? "groupA",
    field_id: textOrNull(input.field_id) ?? "",
    provider,
    source_type: sourceType,
    source_id: sourceId,
    latitude: finiteNumberOrNull(input.latitude),
    longitude: finiteNumberOrNull(input.longitude),
    generated_at: generatedAt,
    issue_time: issueTime,
    forecast_version: forecastVersion,
    provider_run_id: providerRunId,
    external_forecast_id: externalForecastId,
    version,
    valid_from: validFrom,
    valid_to: validTo,
    horizon_hours: horizonHours,
    rainfall_forecast_mm_72h: finiteNumberOrNull(input.rainfall_forecast_mm_72h),
    temperature_max_c_72h: finiteNumberOrNull(input.temperature_max_c_72h),
    et0_mm_72h: finiteNumberOrNull(input.et0_mm_72h),
    hourly: Array.isArray(input.hourly) ? input.hourly : [],
    quality: {
      stale: Boolean(input.quality?.stale),
      missing_fields: Array.isArray(input.quality?.missing_fields) ? input.quality.missing_fields.map(String) : [],
      provider_status: (textOrNull(input.quality?.provider_status) as WeatherForecastFactV1["payload"]["quality"]["provider_status"]) ?? "OK",
    },
    raw_payload: input.raw_payload,
  };

  payload.forecast_id = payload.forecast_id || stableForecastId(payload);
  return payload;
}

export async function appendWeatherForecastFactV1(pool: Pool, payloadInput: Partial<WeatherForecastFactV1["payload"]>): Promise<{ fact_id: string; payload: WeatherForecastFactV1["payload"] }> {
  const payload = normalizeWeatherForecastFactV1(payloadInput);
  const factId = "weather_forecast_fact_" + randomUUID();
  const record = {
    type: "weather_forecast_fact_v1",
    payload,
  };

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (fact_id) DO NOTHING`,
    [factId, payload.generated_at, "weather_forecast_v1", JSON.stringify(record)],
  );

  return { fact_id: factId, payload };
}

export async function upsertWeatherForecastIndexV1(pool: Pool, payloadInput: Partial<WeatherForecastFactV1["payload"]>, sourceFactId: string | null): Promise<WeatherForecastIndexV1> {
  await ensureWeatherForecastIndexV1(pool);
  const payload = normalizeWeatherForecastFactV1(payloadInput);

  await pool.query(
    `INSERT INTO weather_forecast_index_v1 (
      forecast_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      provider,
      source_type,
      source_id,
      latitude,
      longitude,
      generated_at,
      issue_time,
      forecast_version,
      provider_run_id,
      external_forecast_id,
      version_json,
      valid_from,
      valid_to,
      horizon_hours,
      rainfall_forecast_mm_72h,
      temperature_max_c_72h,
      et0_mm_72h,
      hourly_json,
      quality_json,
      raw_payload_json,
      source_fact_id,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25::jsonb,$26,now())
    ON CONFLICT (forecast_id) DO UPDATE SET
      provider = EXCLUDED.provider,
      source_type = EXCLUDED.source_type,
      source_id = EXCLUDED.source_id,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      generated_at = EXCLUDED.generated_at,
      issue_time = EXCLUDED.issue_time,
      forecast_version = EXCLUDED.forecast_version,
      provider_run_id = EXCLUDED.provider_run_id,
      external_forecast_id = EXCLUDED.external_forecast_id,
      version_json = EXCLUDED.version_json,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      horizon_hours = EXCLUDED.horizon_hours,
      rainfall_forecast_mm_72h = EXCLUDED.rainfall_forecast_mm_72h,
      temperature_max_c_72h = EXCLUDED.temperature_max_c_72h,
      et0_mm_72h = EXCLUDED.et0_mm_72h,
      hourly_json = EXCLUDED.hourly_json,
      quality_json = EXCLUDED.quality_json,
      raw_payload_json = EXCLUDED.raw_payload_json,
      source_fact_id = EXCLUDED.source_fact_id,
      updated_at = now()`,
    [
      payload.forecast_id,
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.provider,
      payload.source_type,
      payload.source_id,
      payload.latitude,
      payload.longitude,
      payload.generated_at,
      payload.issue_time,
      payload.forecast_version,
      payload.provider_run_id,
      payload.external_forecast_id,
      JSON.stringify(payload.version),
      payload.valid_from,
      payload.valid_to,
      payload.horizon_hours,
      payload.rainfall_forecast_mm_72h,
      payload.temperature_max_c_72h,
      payload.et0_mm_72h,
      JSON.stringify(payload.hourly),
      JSON.stringify(payload.quality),
      JSON.stringify(payload.raw_payload ?? null),
      sourceFactId,
    ],
  );

  return { ...payload, source_fact_id: sourceFactId };
}

export async function ingestWeatherForecastFactV1(pool: Pool, payloadInput: Partial<WeatherForecastFactV1["payload"]>): Promise<WeatherForecastIndexV1> {
  const appended = await appendWeatherForecastFactV1(pool, payloadInput);
  return upsertWeatherForecastIndexV1(pool, appended.payload, appended.fact_id);
}

export async function getLatestWeatherForecastIndexV1(pool: Pool, tenant: { tenant_id: string; project_id: string; group_id: string }, fieldId: string): Promise<WeatherForecastIndexV1 | null> {
  await ensureWeatherForecastIndexV1(pool);
  const q = await pool.query(
    `SELECT *
       FROM weather_forecast_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
      ORDER BY generated_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId],
  );

  const row = q.rows?.[0];
  if (!row) return null;

  return rowToWeatherForecastIndexV1(row);
}

export async function getLatestUsableWeatherForecastIndexV1(pool: Pool, tenant: { tenant_id: string; project_id: string; group_id: string }, fieldId: string, asOfIso: string = new Date().toISOString()): Promise<WeatherForecastIndexV1 | null> {
  await ensureWeatherForecastIndexV1(pool);

  const q = await pool.query(
    `SELECT *
       FROM weather_forecast_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND valid_from <= $5::timestamptz
        AND valid_to >= $5::timestamptz
        AND horizon_hours >= 72
        AND rainfall_forecast_mm_72h IS NOT NULL
        AND temperature_max_c_72h IS NOT NULL
        AND et0_mm_72h IS NOT NULL
        AND COALESCE(quality_json->>'provider_status', '') = 'OK'
        AND COALESCE(quality_json->>'stale', 'false') = 'false'
        AND COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(quality_json->'missing_fields') = 'array' THEN quality_json->'missing_fields' ELSE '[]'::jsonb END), 0) = 0
      ORDER BY generated_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId, asOfIso],
  );

  const row = q.rows?.[0];
  if (!row) return null;

  return rowToWeatherForecastIndexV1(row);
}
