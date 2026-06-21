// apps/server/src/projections/soil_water_potential_estimate_v1.ts
// Purpose: project H31 deterministic soil water potential estimates into the scoped source-index table.
// Boundary: projection table helper only; no domain calculation, fact append, routes, forecast, scenario, recommendation, approval, operation, dispatch, ROI, or customer exposure.

import type { Pool, PoolClient } from "pg";
import type {
  SoilWaterPotentialClassV1,
  SoilWaterPotentialEstimatePayloadV1,
  SoilWaterPotentialInputStatusV1,
  SoilWaterPotentialThetaUnitV1,
} from "../domain/soil_water/soil_water_potential_builder_v1.js";
import { buildSoilWaterPotentialEstimateV1 } from "../domain/soil_water/soil_water_potential_builder_v1.js";
import { ensureSoilHydraulicProfileIndexV1 } from "./soil_hydraulic_profile_v1.js";

export {
  SOIL_WATER_POTENTIAL_MODEL_VERSION_V1,
  buildSoilWaterPotentialEstimateV1,
  classifySoilWaterPotentialV1,
} from "../domain/soil_water/soil_water_potential_builder_v1.js";

export type {
  SoilWaterPotentialClassV1,
  SoilWaterPotentialEstimatePayloadV1,
  SoilWaterPotentialInputStatusV1,
  SoilWaterPotentialThetaUnitV1,
} from "../domain/soil_water/soil_water_potential_builder_v1.js";

export const SOIL_WATER_POTENTIAL_ESTIMATE_INDEX_V1_TABLE =
  "soil_water_potential_estimate_index_v1";

export type SoilWaterPotentialEstimateFactV1 = {
  type: "soil_water_potential_estimate_v1";
  payload: SoilWaterPotentialEstimatePayloadV1;
};

export type SoilWaterPotentialEstimateIndexV1 = SoilWaterPotentialEstimatePayloadV1 & {
  source_fact_id: string | null;
  updated_at?: string;
};

type DbConn = Pool | PoolClient;

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function textOrEmpty(value: unknown): string {
  return textOrNull(value) ?? "";
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

function jsonStringArray(value: unknown): string[] {
  return parseJsonArray(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export function toJsonbObject(value: unknown): string {
  return JSON.stringify(parseJsonObject(value));
}

export function toJsonbArray(value: unknown): string {
  return JSON.stringify(parseJsonArray(value));
}

export function mapSoilWaterPotentialEstimateRowV1(
  row: Record<string, unknown>,
): SoilWaterPotentialEstimateIndexV1 {
  return {
    estimate_id: textOrEmpty(row.estimate_id),
    tenant_id: textOrEmpty(row.tenant_id),
    project_id: textOrEmpty(row.project_id),
    group_id: textOrEmpty(row.group_id),
    field_id: textOrEmpty(row.field_id),
    zone_id: textOrEmpty(row.zone_id),
    layer_depth_cm: numberOrZero(row.layer_depth_cm),
    source_window_id: textOrNull(row.source_window_id),
    source_profile_id: textOrNull(row.source_profile_id),
    observed_theta: numberOrNull(row.observed_theta),
    theta_unit: textOrEmpty(row.theta_unit) as SoilWaterPotentialThetaUnitV1,
    normalized_theta_m3_m3: numberOrNull(row.normalized_theta_m3_m3),
    matric_potential_kpa: numberOrNull(row.matric_potential_kpa),
    matric_potential_class: textOrEmpty(row.matric_potential_class) as SoilWaterPotentialClassV1,
    available_water_fraction: numberOrNull(row.available_water_fraction),
    root_zone_weight: numberOrZero(row.root_zone_weight),
    input_status: textOrEmpty(row.input_status) as SoilWaterPotentialInputStatusV1,
    blocking_reasons: jsonStringArray(row.blocking_reasons_json),
    hydraulic_profile_ref: textOrNull(row.hydraulic_profile_ref),
    data_quality_ref: textOrNull(row.data_quality_ref),
    evidence_refs: jsonStringArray(row.evidence_refs_json),
    calculation_inputs: parseJsonObject(row.calculation_inputs_json),
    derivation: parseJsonObject(row.derivation_json),
    confidence: parseJsonObject(row.confidence_json) as SoilWaterPotentialEstimatePayloadV1["confidence"],
    determinism_hash: textOrEmpty(row.determinism_hash),
    source_fact_id: textOrNull(row.source_fact_id),
    computed_at: isoString(row.computed_at),
    updated_at: row.updated_at == null ? undefined : isoString(row.updated_at),
  };
}

export const mapSoilWaterPotentialEstimateIndexV1Row = mapSoilWaterPotentialEstimateRowV1;

export async function ensureSoilWaterPotentialEstimateIndexV1(pool: DbConn): Promise<void> {
  await ensureSoilHydraulicProfileIndexV1(pool);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.soil_water_potential_estimate_index_v1 (
      estimate_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      zone_id text NOT NULL,
      layer_depth_cm double precision NOT NULL,
      source_window_id text,
      source_profile_id text,
      observed_theta double precision,
      theta_unit text NOT NULL,
      normalized_theta_m3_m3 double precision,
      matric_potential_kpa double precision,
      matric_potential_class text NOT NULL,
      available_water_fraction double precision,
      root_zone_weight double precision NOT NULL,
      input_status text NOT NULL,
      blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      hydraulic_profile_ref text,
      data_quality_ref text,
      evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
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
    CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_scope_latest
      ON public.soil_water_potential_estimate_index_v1
      (tenant_id, project_id, group_id, field_id, computed_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_window
      ON public.soil_water_potential_estimate_index_v1
      (source_window_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_soil_water_potential_estimate_index_v1_profile
      ON public.soil_water_potential_estimate_index_v1
      (source_profile_id)
  `);
}

export async function upsertSoilWaterPotentialEstimateIndexV1(
  pool: DbConn,
  payload: SoilWaterPotentialEstimatePayloadV1,
  sourceFactId: string | null,
): Promise<SoilWaterPotentialEstimateIndexV1> {
  await ensureSoilWaterPotentialEstimateIndexV1(pool);

  const result = await pool.query(
    `
      INSERT INTO public.soil_water_potential_estimate_index_v1 (
        estimate_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        layer_depth_cm,
        source_window_id,
        source_profile_id,
        observed_theta,
        theta_unit,
        normalized_theta_m3_m3,
        matric_potential_kpa,
        matric_potential_class,
        available_water_fraction,
        root_zone_weight,
        input_status,
        blocking_reasons_json,
        hydraulic_profile_ref,
        data_quality_ref,
        evidence_refs_json,
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
        $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        $19, $20, $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb,
        $25, $26, $27, now()
      )
      ON CONFLICT (estimate_id)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        project_id = EXCLUDED.project_id,
        group_id = EXCLUDED.group_id,
        field_id = EXCLUDED.field_id,
        zone_id = EXCLUDED.zone_id,
        layer_depth_cm = EXCLUDED.layer_depth_cm,
        source_window_id = EXCLUDED.source_window_id,
        source_profile_id = EXCLUDED.source_profile_id,
        observed_theta = EXCLUDED.observed_theta,
        theta_unit = EXCLUDED.theta_unit,
        normalized_theta_m3_m3 = EXCLUDED.normalized_theta_m3_m3,
        matric_potential_kpa = EXCLUDED.matric_potential_kpa,
        matric_potential_class = EXCLUDED.matric_potential_class,
        available_water_fraction = EXCLUDED.available_water_fraction,
        root_zone_weight = EXCLUDED.root_zone_weight,
        input_status = EXCLUDED.input_status,
        blocking_reasons_json = EXCLUDED.blocking_reasons_json,
        hydraulic_profile_ref = EXCLUDED.hydraulic_profile_ref,
        data_quality_ref = EXCLUDED.data_quality_ref,
        evidence_refs_json = EXCLUDED.evidence_refs_json,
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
      payload.estimate_id,
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.zone_id,
      payload.layer_depth_cm,
      payload.source_window_id,
      payload.source_profile_id,
      payload.observed_theta,
      payload.theta_unit,
      payload.normalized_theta_m3_m3,
      payload.matric_potential_kpa,
      payload.matric_potential_class,
      payload.available_water_fraction,
      payload.root_zone_weight,
      payload.input_status,
      toJsonbArray(payload.blocking_reasons),
      payload.hydraulic_profile_ref,
      payload.data_quality_ref,
      toJsonbArray(payload.evidence_refs),
      toJsonbObject(payload.calculation_inputs),
      toJsonbObject(payload.derivation),
      toJsonbObject(payload.confidence),
      payload.determinism_hash,
      sourceFactId,
      payload.computed_at,
    ],
  );

  return mapSoilWaterPotentialEstimateRowV1(result.rows[0] as Record<string, unknown>);
}
