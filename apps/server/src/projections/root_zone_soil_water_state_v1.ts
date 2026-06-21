// apps/server/src/projections/root_zone_soil_water_state_v1.ts
// Purpose: project deterministic root-zone soil water state estimates into a scoped read index.
// Boundary: projection table helper only; no domain calculation, routes, forecasts, scenarios, or customer exposure.

import type { Pool, PoolClient } from "pg";
import type { RootZoneSoilWaterStatePayloadV1, RootZoneSoilWaterPotentialClassV1, RootZoneSoilWaterStateInputStatusV1 } from "../domain/soil_water/root_zone_soil_water_state_builder_v1.js";

type DbConn = Pool | PoolClient;
export const ROOT_ZONE_SOIL_WATER_STATE_INDEX_V1_TABLE = "root_zone_soil_water_state_index_v1";
export type RootZoneSoilWaterStateFactV1 = { type: "root_zone_soil_water_state_v1"; payload: RootZoneSoilWaterStatePayloadV1 };
export type RootZoneSoilWaterStateIndexV1 = RootZoneSoilWaterStatePayloadV1 & { source_fact_id: string | null; updated_at?: string };

function textOrEmpty(value: unknown): string { return String(value ?? "").trim(); }
function textOrNull(value: unknown): string | null { const text = textOrEmpty(value); return text || null; }
function numberOrNull(value: unknown): number | null { if (value == null || value === "") return null; const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? n : null; }
function numberOrZero(value: unknown): number { return numberOrNull(value) ?? 0; }
function isoString(value: unknown): string { return value instanceof Date ? value.toISOString() : textOrEmpty(value); }
function parseJsonArray(value: unknown): unknown[] { if (Array.isArray(value)) return value; if (typeof value !== "string" || !value.trim()) return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function parseJsonObject(value: unknown): Record<string, unknown> { if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>; if (typeof value !== "string" || !value.trim()) return {}; try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
function stringArray(value: unknown): string[] { return parseJsonArray(value).map((item) => String(item ?? "").trim()).filter(Boolean); }
function toJsonbArray(value: unknown): string { return JSON.stringify(parseJsonArray(value)); }
function toJsonbObject(value: unknown): string { return JSON.stringify(parseJsonObject(value)); }

export function mapRootZoneSoilWaterStateRowV1(row: Record<string, unknown>): RootZoneSoilWaterStateIndexV1 {
  return {
    state_id: textOrEmpty(row.state_id), tenant_id: textOrEmpty(row.tenant_id), project_id: textOrEmpty(row.project_id), group_id: textOrEmpty(row.group_id), field_id: textOrEmpty(row.field_id), zone_id: textOrEmpty(row.zone_id), root_zone_depth_cm: numberOrZero(row.root_zone_depth_cm),
    layer_estimate_refs: stringArray(row.layer_estimate_refs_json), layer_count: numberOrZero(row.layer_count), estimated_layer_count: numberOrZero(row.estimated_layer_count), blocked_layer_count: numberOrZero(row.blocked_layer_count),
    weighted_matric_potential_kpa: numberOrNull(row.weighted_matric_potential_kpa), root_zone_available_water_fraction: numberOrNull(row.root_zone_available_water_fraction), root_zone_water_potential_class: textOrEmpty(row.root_zone_water_potential_class) as RootZoneSoilWaterPotentialClassV1, worst_layer_class: textOrEmpty(row.worst_layer_class) as RootZoneSoilWaterStatePayloadV1["worst_layer_class"], stress_layer_count: numberOrZero(row.stress_layer_count), limited_layer_count: numberOrZero(row.limited_layer_count), input_status: textOrEmpty(row.input_status) as RootZoneSoilWaterStateInputStatusV1,
    blocking_reasons: stringArray(row.blocking_reasons_json), calculation_inputs: parseJsonObject(row.calculation_inputs_json), derivation: parseJsonObject(row.derivation_json), confidence: parseJsonObject(row.confidence_json) as RootZoneSoilWaterStatePayloadV1["confidence"], determinism_hash: textOrEmpty(row.determinism_hash), source_fact_id: textOrNull(row.source_fact_id), computed_at: isoString(row.computed_at), updated_at: row.updated_at == null ? undefined : isoString(row.updated_at),
  };
}

export async function ensureRootZoneSoilWaterStateIndexV1(pool: DbConn): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.root_zone_soil_water_state_index_v1 (
    state_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text NOT NULL, zone_id text NOT NULL, root_zone_depth_cm double precision NOT NULL,
    layer_estimate_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb, layer_count integer NOT NULL, estimated_layer_count integer NOT NULL, blocked_layer_count integer NOT NULL,
    weighted_matric_potential_kpa double precision, root_zone_available_water_fraction double precision,
    root_zone_water_potential_class text NOT NULL, worst_layer_class text NOT NULL, stress_layer_count integer NOT NULL, limited_layer_count integer NOT NULL,
    input_status text NOT NULL, blocking_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb, calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb, derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb, confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    determinism_hash text NOT NULL, source_fact_id text, computed_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_state_index_v1_scope_latest ON public.root_zone_soil_water_state_index_v1 (tenant_id, project_id, group_id, field_id, zone_id, computed_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_root_zone_soil_water_state_index_v1_field_latest ON public.root_zone_soil_water_state_index_v1 (tenant_id, project_id, group_id, field_id, computed_at DESC)`);
}

export async function upsertRootZoneSoilWaterStateIndexV1(pool: DbConn, payload: RootZoneSoilWaterStatePayloadV1, sourceFactId: string | null): Promise<RootZoneSoilWaterStateIndexV1> {
  await ensureRootZoneSoilWaterStateIndexV1(pool);
  const result = await pool.query(`INSERT INTO public.root_zone_soil_water_state_index_v1 (state_id, tenant_id, project_id, group_id, field_id, zone_id, root_zone_depth_cm, layer_estimate_refs_json, layer_count, estimated_layer_count, blocked_layer_count, weighted_matric_potential_kpa, root_zone_available_water_fraction, root_zone_water_potential_class, worst_layer_class, stress_layer_count, limited_layer_count, input_status, blocking_reasons_json, calculation_inputs_json, derivation_json, confidence_json, determinism_hash, source_fact_id, computed_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23,$24,$25,now())
    ON CONFLICT (state_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, zone_id=EXCLUDED.zone_id, root_zone_depth_cm=EXCLUDED.root_zone_depth_cm, layer_estimate_refs_json=EXCLUDED.layer_estimate_refs_json, layer_count=EXCLUDED.layer_count, estimated_layer_count=EXCLUDED.estimated_layer_count, blocked_layer_count=EXCLUDED.blocked_layer_count, weighted_matric_potential_kpa=EXCLUDED.weighted_matric_potential_kpa, root_zone_available_water_fraction=EXCLUDED.root_zone_available_water_fraction, root_zone_water_potential_class=EXCLUDED.root_zone_water_potential_class, worst_layer_class=EXCLUDED.worst_layer_class, stress_layer_count=EXCLUDED.stress_layer_count, limited_layer_count=EXCLUDED.limited_layer_count, input_status=EXCLUDED.input_status, blocking_reasons_json=EXCLUDED.blocking_reasons_json, calculation_inputs_json=EXCLUDED.calculation_inputs_json, derivation_json=EXCLUDED.derivation_json, confidence_json=EXCLUDED.confidence_json, determinism_hash=EXCLUDED.determinism_hash, source_fact_id=EXCLUDED.source_fact_id, computed_at=EXCLUDED.computed_at, updated_at=now() RETURNING *`,
    [payload.state_id, payload.tenant_id, payload.project_id, payload.group_id, payload.field_id, payload.zone_id, payload.root_zone_depth_cm, toJsonbArray(payload.layer_estimate_refs), payload.layer_count, payload.estimated_layer_count, payload.blocked_layer_count, payload.weighted_matric_potential_kpa, payload.root_zone_available_water_fraction, payload.root_zone_water_potential_class, payload.worst_layer_class, payload.stress_layer_count, payload.limited_layer_count, payload.input_status, toJsonbArray(payload.blocking_reasons), toJsonbObject(payload.calculation_inputs), toJsonbObject(payload.derivation), toJsonbObject(payload.confidence), payload.determinism_hash, sourceFactId, payload.computed_at]);
  return mapRootZoneSoilWaterStateRowV1(result.rows[0] as Record<string, unknown>);
}
