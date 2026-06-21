// apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts
// Purpose: project deterministic root-zone irrigation scenario sets into a scoped read index.
// Boundary: projection table helper only; no domain calculation, routes, actions, or customer exposure.

import type { Pool, PoolClient } from "pg";
import type { RootZoneIrrigationScenarioSetPayloadV1 } from "../domain/soil_water/root_zone_irrigation_scenario_builder_v1.js";

type DbConn = Pool | PoolClient;

export const ROOT_ZONE_IRRIGATION_SCENARIO_SET_INDEX_V1_TABLE = "root_zone_irrigation_scenario_set_index_v1";

export type RootZoneIrrigationScenarioSetFactV1 = {
  type: "root_zone_irrigation_scenario_set_v1";
  payload: RootZoneIrrigationScenarioSetPayloadV1;
};

export type RootZoneIrrigationScenarioSetIndexV1 = RootZoneIrrigationScenarioSetPayloadV1 & {
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

function numberOrZero(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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

function toJsonbArray(value: unknown): string {
  return JSON.stringify(parseJsonArray(value));
}

function toJsonbObject(value: unknown): string {
  return JSON.stringify(parseJsonObject(value));
}

export function mapRootZoneIrrigationScenarioSetRowV1(
  row: Record<string, unknown>,
): RootZoneIrrigationScenarioSetIndexV1 {
  return {
    scenario_set_id: textOrEmpty(row.scenario_set_id),
    tenant_id: textOrEmpty(row.tenant_id),
    project_id: textOrEmpty(row.project_id),
    group_id: textOrEmpty(row.group_id),
    field_id: textOrEmpty(row.field_id),
    zone_id: textOrEmpty(row.zone_id),
    source_forecast_id: textOrEmpty(row.source_forecast_id),
    source_forecast_ref: textOrEmpty(row.source_forecast_ref),
    baseline_mode: "FORECAST_BASELINE",
    comparison_mode: "HYPOTHETICAL_IRRIGATION_OPTIONS",
    horizon_days: numberOrZero(row.horizon_days),
    root_zone_depth_cm: numberOrZero(row.root_zone_depth_cm),
    root_zone_available_water_capacity_mm: numberOrZero(row.root_zone_available_water_capacity_mm),
    baseline_summary: parseJsonObject(
      row.baseline_summary_json,
    ) as RootZoneIrrigationScenarioSetPayloadV1["baseline_summary"],
    options: parseJsonArray(row.options_json) as RootZoneIrrigationScenarioSetPayloadV1["options"],
    input_status: textOrEmpty(row.input_status) as RootZoneIrrigationScenarioSetPayloadV1["input_status"],
    blocking_reasons: parseJsonArray(row.blocking_reasons_json).map((value) => String(value)),
    calculation_inputs: parseJsonObject(row.calculation_inputs_json),
    derivation: parseJsonObject(row.derivation_json),
    confidence: parseJsonObject(row.confidence_json) as RootZoneIrrigationScenarioSetPayloadV1["confidence"],
    determinism_hash: textOrEmpty(row.determinism_hash),
    source_fact_id: textOrNull(row.source_fact_id),
    computed_at: isoString(row.computed_at),
    updated_at: row.updated_at == null ? undefined : isoString(row.updated_at),
  };
}

export async function ensureRootZoneIrrigationScenarioSetIndexV1(pool: DbConn): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.root_zone_irrigation_scenario_set_index_v1 (
      scenario_set_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      zone_id text NOT NULL,
      source_forecast_id text NOT NULL,
      source_forecast_ref text NOT NULL,
      baseline_mode text NOT NULL,
      comparison_mode text NOT NULL,
      horizon_days integer NOT NULL,
      root_zone_depth_cm double precision NOT NULL,
      root_zone_available_water_capacity_mm double precision NOT NULL,
      baseline_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      input_status text NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_scope_latest
      ON public.root_zone_irrigation_scenario_set_index_v1
      (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_field_latest
      ON public.root_zone_irrigation_scenario_set_index_v1
      (tenant_id, project_id, group_id, field_id, computed_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_root_zone_irrigation_scenario_set_index_v1_source_forecast
      ON public.root_zone_irrigation_scenario_set_index_v1
      (source_forecast_id)
  `);
}

export async function upsertRootZoneIrrigationScenarioSetIndexV1(
  pool: DbConn,
  payload: RootZoneIrrigationScenarioSetPayloadV1,
  sourceFactId: string | null,
): Promise<RootZoneIrrigationScenarioSetIndexV1> {
  await ensureRootZoneIrrigationScenarioSetIndexV1(pool);

  const values = [
    payload.scenario_set_id,
    payload.tenant_id,
    payload.project_id,
    payload.group_id,
    payload.field_id,
    payload.zone_id,
    payload.source_forecast_id,
    payload.source_forecast_ref,
    payload.baseline_mode,
    payload.comparison_mode,
    payload.horizon_days,
    payload.root_zone_depth_cm,
    payload.root_zone_available_water_capacity_mm,
    toJsonbObject(payload.baseline_summary),
    toJsonbArray(payload.options),
    payload.input_status,
    toJsonbArray(payload.blocking_reasons),
    toJsonbObject(payload.calculation_inputs),
    toJsonbObject(payload.derivation),
    toJsonbObject(payload.confidence),
    payload.determinism_hash,
    sourceFactId,
    payload.computed_at,
  ];

  const result = await pool.query(
    `
      INSERT INTO public.root_zone_irrigation_scenario_set_index_v1 (
        scenario_set_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        source_forecast_id,
        source_forecast_ref,
        baseline_mode,
        comparison_mode,
        horizon_days,
        root_zone_depth_cm,
        root_zone_available_water_capacity_mm,
        baseline_summary_json,
        options_json,
        input_status,
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
        $11, $12, $13, $14::jsonb, $15::jsonb, $16,
        $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb,
        $21, $22, $23, now()
      )
      ON CONFLICT (scenario_set_id)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        zone_id = EXCLUDED.zone_id,
        source_forecast_id = EXCLUDED.source_forecast_id,
        source_forecast_ref = EXCLUDED.source_forecast_ref,
        baseline_mode = EXCLUDED.baseline_mode,
        comparison_mode = EXCLUDED.comparison_mode,
        horizon_days = EXCLUDED.horizon_days,
        root_zone_depth_cm = EXCLUDED.root_zone_depth_cm,
        root_zone_available_water_capacity_mm = EXCLUDED.root_zone_available_water_capacity_mm,
        baseline_summary_json = EXCLUDED.baseline_summary_json,
        options_json = EXCLUDED.options_json,
        input_status = EXCLUDED.input_status,
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
    values,
  );

  return mapRootZoneIrrigationScenarioSetRowV1(result.rows[0] as Record<string, unknown>);
}
