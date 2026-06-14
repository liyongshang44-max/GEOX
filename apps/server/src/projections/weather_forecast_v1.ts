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
    input.source_id,
    input.generated_at,
    input.valid_from,
    input.valid_to,
  ].join("|");
  return "wf_" + createHash("sha256").update(raw).digest("hex").slice(0, 24);
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
    CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_scope_latest
      ON weather_forecast_index_v1 (tenant_id, project_id, group_id, field_id, generated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weather_forecast_index_v1_valid_window
      ON weather_forecast_index_v1 (field_id, valid_from, valid_to)
  `);
}

export function normalizeWeatherForecastFactV1(input: Partial<WeatherForecastFactV1["payload"]>): WeatherForecastFactV1["payload"] {
  const nowIso = new Date().toISOString();
  const generatedAt = textOrNull(input.generated_at) ?? nowIso;
  const validFrom = textOrNull(input.valid_from) ?? generatedAt;
  const horizonHours = Number.isFinite(Number(input.horizon_hours)) ? Number(input.horizon_hours) : 72;
  const validTo = textOrNull(input.valid_to) ?? new Date(Date.parse(validFrom) + horizonHours * 60 * 60 * 1000).toISOString();

  const payload: WeatherForecastFactV1["payload"] = {
    forecast_id: textOrNull(input.forecast_id) ?? "",
    tenant_id: textOrNull(input.tenant_id) ?? "tenantA",
    project_id: textOrNull(input.project_id) ?? "projectA",
    group_id: textOrNull(input.group_id) ?? "groupA",
    field_id: textOrNull(input.field_id) ?? "",
    provider: textOrNull(input.provider) ?? "MOCK",
    source_type: (textOrNull(input.source_type) as any) ?? "MOCK",
    source_id: textOrNull(input.source_id) ?? "weather_forecast_seed",
    latitude: finiteNumberOrNull(input.latitude),
    longitude: finiteNumberOrNull(input.longitude),
    generated_at: generatedAt,
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
      provider_status: (textOrNull(input.quality?.provider_status) as any) ?? "OK",
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
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21,now())
    ON CONFLICT (forecast_id) DO UPDATE SET
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
