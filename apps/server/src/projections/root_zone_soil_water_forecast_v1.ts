// apps/server/src/projections/root_zone_soil_water_forecast_v1.ts
// Purpose: project deterministic root-zone soil water forecasts into a scoped read index.
// Boundary: projection table helper only; no domain calculation, routes, scenarios, actions, or customer exposure.

import type { Pool, PoolClient } from "pg";
import type {
  RootZoneSoilWaterForecastPayloadV1,
  RootZoneSoilWaterForecastStatusV1,
} from "../domain/soil_water/root_zone_soil_water_forecast_builder_v1.js";

type DbConn = Pool | PoolClient;

export const ROOT_ZONE_SOIL_WATER_FORECAST_INDEX_V1_TABLE =
  "root_zone_soil_water_forecast_index_v1";

export type RootZoneSoilWaterForecastFactV1 = {
  type: "root_zone_soil_water_forecast_v1";
  payload: RootZoneSoilWaterForecastPayloadV1;
};

export type RootZoneSoilWaterForecastIndexV1 = RootZoneSoilWaterForecastPayloadV1 & {
  source_fact_id: string | null;
  updated_at?: string;
};

function textOrEmpty(value: unknown): string {
  return String(value ?? "").trim();
}

function textOrNull(value: unknown): string | null {
  const text = textOrEmpty(value);
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function isoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return textOrEmpty(value);
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string" || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function stringArray(value: unknown): string[] {
  return parseJsonArray(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function toJsonbArray(value: unknown): string {
  return JSON.stringify(parseJsonArray(value));
}

function toJsonbObject(value: unknown): string {
  return JSON.stringify(parseJsonObject(value));
}

export function mapRootZoneSoilWaterForecastRowV1(
  row: Record<string, unknown>,
): RootZoneSoilWaterForecastIndexV1 {
  return {
    forecast_id: textOrEmpty(row.forecast_id),
    tenant_id: textOrEmpty(row.tenant_id),
    project_id: textOrEmpty(row.project_id),
    group_id: textOrEmpty(row.group_id),
    field_id: textOrEmpty(row.field_id),
    zone_id: textOrEmpty(row.zone_id),
    source_state_id: textOrEmpty(row.source_state_id),
    source_state_ref: textOrEmpty(row.source_state_ref),
    weather_forecast_ref: textOrNull(row.weather_forecast_ref),
    baseline_mode: "NO_NEW_ACTION",
    horizon_days: numberOrZero(row.horizon_days),
    root_zone_depth_cm: numberOrZero(row.root_zone_depth_cm),
    root_zone_available_water_capacity_mm: numberOrZero(row.root_zone_available_water_capacity_mm),
    initial_available_water_fraction: numberOrNull(row.initial_available_water_fraction),
    initial_weighted_matric_potential_kpa: numberOrNull(row.initial_weighted_matric_potential_kpa),
    daily_forecast: parseJsonArray(
      row.daily_forecast_json,
    ) as RootZoneSoilWaterForecastPayloadV1["daily_forecast"],
    min_available_water_fraction: numberOrNull(row.min_available_water_fraction),
    max_available_water_fraction: numberOrNull(row.max_available_water_fraction),
    first_stress_date: textOrNull(row.first_stress_date),
    stress_day_count: numberOrZero(row.stress_day_count),
    limited_day_count: numberOrZero(row.limited_day_count),
    forecast_status: textOrEmpty(row.forecast_status) as RootZoneSoilWaterForecastStatusV1,
    blocking_reasons: stringArray(row.blocking_reasons_json),
    calculation_inputs: parseJsonObject(row.calculation_inputs_json),
    derivation: parseJsonObject(row.derivation_json),
    confidence: parseJsonObject(row.confidence_json) as RootZoneSoilWaterForecastPayloadV1["confidence"],
    determinism_hash: textOrEmpty(row.determinism_hash),
    source_fact_id: textOrNull(row.source_fact_id),
    computed_at: isoString(row.computed_at),
    updated_at: row.updated_at == null ? undefined : isoString(row.updated_at),
  };
}

export async function ensureRootZoneSoilWaterForecastIndexV1(pool: DbConn): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.root_zone_soil_water_forecast_index_v1 (
      forecast_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      zone_id text NOT NULL,
      source_state_id text NOT NULL,
      source_state_ref text NOT NULL,
      weather_forecast_ref text,
      baseline_mode text NOT NULL,
      horizon_days integer NOT NULL,
      root_zone_depth_cm double precision NOT NULL,
      root_zone_available_water_capacity_mm double precision NOT NULL,
      initial_available_water_fraction double precision,
      initial_weighted_matric_potential_kpa double precision,
      daily_forecast_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      min_available_water_fraction double precision,
      max_available_water_fraction double precision,
      first_stress_date text,
      stress_day_count integer NOT NULL,
      limited_day_count integer NOT NULL,
      forecast_status text NOT NULL,
      blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      determinism_hash text NOT NULL,
      source_fact_id text,
      computed_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_scope_latest
      ON public.root_zone_soil_water_forecast_index_v1
      (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_field_latest
      ON public.root_zone_soil_water_forecast_index_v1
      (tenant_id, project_id, group_id, field_id, computed_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_forecast_index_v1_source_state
      ON public.root_zone_soil_water_forecast_index_v1
      (source_state_id)
  `);
}

export async function upsertRootZoneSoilWaterForecastIndexV1(
  pool: DbConn,
  payload: RootZoneSoilWaterForecastPayloadV1,
  sourceFactId: string | null,
): Promise<RootZoneSoilWaterForecastIndexV1> {
  await ensureRootZoneSoilWaterForecastIndexV1(pool);

  const result = await pool.query(
    `
      INSERT INTO public.root_zone_soil_water_forecast_index_v1 (
        forecast_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        source_state_id,
        source_state_ref,
        weather_forecast_ref,
        baseline_mode,
        horizon_days,
        root_zone_depth_cm,
        root_zone_available_water_capacity_mm,
        initial_available_water_fraction,
        initial_weighted_matric_potential_kpa,
        daily_forecast_json,
        min_available_water_fraction,
        max_available_water_fraction,
        first_stress_date,
        stress_day_count,
        limited_day_count,
        forecast_status,
        blocking_reasons_json,
        calculation_inputs_json,
        derivation_json,
        confidence_json,
        determinism_hash,
        source_fact_id,
        computed_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16::jsonb, $17, $18,
        $19, $20, $21, $22, $23::jsonb, $24::jsonb,
        $25::jsonb, $26::jsonb, $27, $28, $29, now()
      )
      ON CONFLICT (forecast_id)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        zone_id = EXCLUDED.zone_id,
        source_state_id = EXCLUDED.source_state_id,
        source_state_ref = EXCLUDED.source_state_ref,
        weather_forecast_ref = EXCLUDED.weather_forecast_ref,
        baseline_mode = EXCLUDED.baseline_mode,
        horizon_days = EXCLUDED.horizon_days,
        root_zone_depth_cm = EXCLUDED.root_zone_depth_cm,
        root_zone_available_water_capacity_mm = EXCLUDED.root_zone_available_water_capacity_mm,
        initial_available_water_fraction = EXCLUDED.initial_available_water_fraction,
        initial_weighted_matric_potential_kpa = EXCLUDED.initial_weighted_matric_potential_kpa,
        daily_forecast_json = EXCLUDED.daily_forecast_json,
        min_available_water_fraction = EXCLUDED.min_available_water_fraction,
        max_available_water_fraction = EXCLUDED.max_available_water_fraction,
        first_stress_date = EXCLUDED.first_stress_date,
        stress_day_count = EXCLUDED.stress_day_count,
        limited_day_count = EXCLUDED.limited_day_count,
        forecast_status = EXCLUDED.forecast_status,
        blocking_reasons_json = EXCLUDED.blocking_reasons_json,
        calculation_inputs_json = EXCLUDED.calculation_inputs_json,
        derivation_json = EXCLUDED.derivation_json,
        confidence_json = EXCLUDED.confidence_json,
        determinism_hash = EXCLUDED.determinism_hash,
        source_fact_id = EXCLUDED.source_fact_id,
        computed_at = EXCLUDED.computed_at,
        updated_at = now()
      RETURNING *
    `,
    [
      payload.forecast_id,
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.zone_id,
      payload.source_state_id,
      payload.source_state_ref,
      payload.weather_forecast_ref,
      payload.baseline_mode,
      payload.horizon_days,
      payload.root_zone_depth_cm,
      payload.root_zone_available_water_capacity_mm,
      payload.initial_available_water_fraction,
      payload.initial_weighted_matric_potential_kpa,
      toJsonbArray(payload.daily_forecast),
      payload.min_available_water_fraction,
      payload.max_available_water_fraction,
      payload.first_stress_date,
      payload.stress_day_count,
      payload.limited_day_count,
      payload.forecast_status,
      toJsonbArray(payload.blocking_reasons),
      toJsonbObject(payload.calculation_inputs),
      toJsonbObject(payload.derivation),
      toJsonbObject(payload.confidence),
      payload.determinism_hash,
      sourceFactId,
      payload.computed_at,
    ],
  );

  return mapRootZoneSoilWaterForecastRowV1(result.rows[0] as Record<string, unknown>);
}
