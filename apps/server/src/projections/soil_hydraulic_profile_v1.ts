// apps/server/src/projections/soil_hydraulic_profile_v1.ts
// Purpose: typed helper for the H31 soil hydraulic profile projection.
// Boundary: scoped source-index read/write helper only; no routes, forecasts, scenarios, or action generation.

import type { Pool, PoolClient } from "pg";

export const SOIL_HYDRAULIC_PROFILE_INDEX_V1_TABLE = "soil_hydraulic_profile_index_v1";
export type SoilHydraulicParameterSourceV1 = "DEFAULT_TEXTURE_CLASS" | "FIELD_LAB" | "CALIBRATED" | "MANUAL";
export type SoilHydraulicCalibrationStatusV1 = "UNVERIFIED" | "PARTIALLY_CALIBRATED" | "CALIBRATED";
export type SoilHydraulicConfidenceLevelV1 = "LOW" | "MEDIUM" | "HIGH";

export type SoilHydraulicProfilePayloadV1 = {
  profile_id: string; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string;
  layer_depth_cm: number; texture_class: string; theta_r: number; theta_s: number; alpha_per_kpa: number; n: number; m: number;
  parameter_source: SoilHydraulicParameterSourceV1; calibration_status: SoilHydraulicCalibrationStatusV1;
  confidence_level: SoilHydraulicConfidenceLevelV1; confidence_score: number; evidence_refs: string[]; created_at: string;
};
export type SoilHydraulicProfileFactV1 = { type: "soil_hydraulic_profile_v1"; payload: SoilHydraulicProfilePayloadV1 };
export type SoilHydraulicProfileIndexV1 = SoilHydraulicProfilePayloadV1 & { source_fact_id: string | null; updated_at?: string };
type DbConn = Pool | PoolClient;

function n(v: unknown): number { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? x : NaN; }
function s(v: unknown): string { return String(v ?? ""); }
function arr(v: unknown): string[] { if (Array.isArray(v)) return v.map(String); if (typeof v === "string" && v) { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } } return []; }
function iso(v: unknown): string { return v instanceof Date ? v.toISOString() : String(v ?? ""); }
export function deriveSoilHydraulicMFromNV1(value: number): number { return Math.round((1 - 1 / value) * 1_000_000) / 1_000_000; }
export function validateSoilHydraulicProfileV1(profile: Omit<SoilHydraulicProfilePayloadV1, "m"> & { m?: number }): string[] {
  const reasons: string[] = [];
  if (!Number.isFinite(profile.theta_r)) reasons.push("THETA_R_NOT_FINITE");
  if (!Number.isFinite(profile.theta_s)) reasons.push("THETA_S_NOT_FINITE");
  if (Number.isFinite(profile.theta_r) && Number.isFinite(profile.theta_s) && profile.theta_r >= profile.theta_s) reasons.push("THETA_R_NOT_LESS_THAN_THETA_S");
  if (!Number.isFinite(profile.alpha_per_kpa) || profile.alpha_per_kpa <= 0) reasons.push("ALPHA_PER_KPA_NOT_POSITIVE");
  if (!Number.isFinite(profile.n) || profile.n <= 1) reasons.push("N_NOT_GREATER_THAN_ONE");
  if (!Number.isFinite(profile.layer_depth_cm) || profile.layer_depth_cm <= 0) reasons.push("LAYER_DEPTH_CM_NOT_POSITIVE");
  if (profile.m != null && Math.abs(profile.m - (1 - 1 / profile.n)) > 1e-6) reasons.push("M_NOT_VAN_GENUCHTEN_DERIVED");
  return reasons;
}
export function buildSoilHydraulicProfileV1(input: Omit<SoilHydraulicProfilePayloadV1, "m"> & { m?: number }): SoilHydraulicProfilePayloadV1 {
  const payload = { ...input, m: input.m ?? deriveSoilHydraulicMFromNV1(input.n) };
  const errors = validateSoilHydraulicProfileV1(payload);
  if (errors.length) throw new Error(`INVALID_SOIL_HYDRAULIC_PROFILE_V1:${errors.join(",")}`);
  return payload;
}
export function mapSoilHydraulicProfileIndexV1Row(row: any): SoilHydraulicProfileIndexV1 { return { profile_id:s(row.profile_id), tenant_id:s(row.tenant_id), project_id:s(row.project_id), group_id:s(row.group_id), field_id:s(row.field_id), zone_id:s(row.zone_id), layer_depth_cm:n(row.layer_depth_cm), texture_class:s(row.texture_class), theta_r:n(row.theta_r), theta_s:n(row.theta_s), alpha_per_kpa:n(row.alpha_per_kpa), n:n(row.n), m:n(row.m), parameter_source:s(row.parameter_source) as SoilHydraulicParameterSourceV1, calibration_status:s(row.calibration_status) as SoilHydraulicCalibrationStatusV1, confidence_level:s(row.confidence_level) as SoilHydraulicConfidenceLevelV1, confidence_score:n(row.confidence_score), evidence_refs:arr(row.evidence_refs_json), source_fact_id: row.source_fact_id ? s(row.source_fact_id) : null, created_at:iso(row.created_at), updated_at: row.updated_at ? iso(row.updated_at) : undefined }; }
export async function ensureSoilHydraulicProfileIndexV1(pool: DbConn): Promise<void> { await pool.query(`CREATE TABLE IF NOT EXISTS public.soil_hydraulic_profile_index_v1 (profile_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text NOT NULL, zone_id text NOT NULL, layer_depth_cm double precision NOT NULL, texture_class text NOT NULL, theta_r double precision NOT NULL, theta_s double precision NOT NULL, alpha_per_kpa double precision NOT NULL, n double precision NOT NULL, m double precision NOT NULL, parameter_source text NOT NULL, calibration_status text NOT NULL, confidence_level text NOT NULL, confidence_score double precision NOT NULL, evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb, source_fact_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, project_id, group_id, field_id, zone_id, layer_depth_cm))`); await pool.query(`CREATE INDEX IF NOT EXISTS idx_soil_hydraulic_profile_index_v1_scope_latest ON public.soil_hydraulic_profile_index_v1 (tenant_id, project_id, group_id, field_id, zone_id, layer_depth_cm, updated_at DESC)`); await pool.query(`CREATE INDEX IF NOT EXISTS idx_soil_hydraulic_profile_index_v1_field ON public.soil_hydraulic_profile_index_v1 (tenant_id, project_id, group_id, field_id)`); }
export async function upsertSoilHydraulicProfileIndexV1(pool: DbConn, payload: SoilHydraulicProfilePayloadV1, sourceFactId: string | null = null): Promise<SoilHydraulicProfileIndexV1> { await ensureSoilHydraulicProfileIndexV1(pool); await pool.query(`INSERT INTO public.soil_hydraulic_profile_index_v1 (profile_id,tenant_id,project_id,group_id,field_id,zone_id,layer_depth_cm,texture_class,theta_r,theta_s,alpha_per_kpa,n,m,parameter_source,calibration_status,confidence_level,confidence_score,evidence_refs_json,source_fact_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,now()) ON CONFLICT (profile_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,zone_id=EXCLUDED.zone_id,layer_depth_cm=EXCLUDED.layer_depth_cm,texture_class=EXCLUDED.texture_class,theta_r=EXCLUDED.theta_r,theta_s=EXCLUDED.theta_s,alpha_per_kpa=EXCLUDED.alpha_per_kpa,n=EXCLUDED.n,m=EXCLUDED.m,parameter_source=EXCLUDED.parameter_source,calibration_status=EXCLUDED.calibration_status,confidence_level=EXCLUDED.confidence_level,confidence_score=EXCLUDED.confidence_score,evidence_refs_json=EXCLUDED.evidence_refs_json,source_fact_id=EXCLUDED.source_fact_id,created_at=EXCLUDED.created_at,updated_at=now()`, [payload.profile_id,payload.tenant_id,payload.project_id,payload.group_id,payload.field_id,payload.zone_id,payload.layer_depth_cm,payload.texture_class,payload.theta_r,payload.theta_s,payload.alpha_per_kpa,payload.n,payload.m,payload.parameter_source,payload.calibration_status,payload.confidence_level,payload.confidence_score,JSON.stringify(payload.evidence_refs || []),sourceFactId,payload.created_at]); return { ...payload, source_fact_id: sourceFactId }; }
