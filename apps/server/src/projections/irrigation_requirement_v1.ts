// apps/server/src/projections/irrigation_requirement_v1.ts
// Purpose: define and read the formal irrigation requirement projection used by controlled-pilot H2/H3 acceptance.
// Boundary: this module exposes read-model types and read helpers only; it does not calculate or mutate irrigation requirements.

import type { Pool } from "pg";

export const IRRIGATION_REQUIREMENT_INDEX_V1_TABLE = "irrigation_requirement_index_v1";

export type IrrigationRequirementTenantTripleV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type IrrigationRequirementIndexV1 = {
  requirement_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  crop_code: string | null;
  crop_stage: string | null;
  source_forecast_id: string | null;
  source_observation_refs: string[];
  skill_id: string;
  skill_version: string;
  skill_run_id: string | null;
  root_zone_soil_moisture_percent: number | null;
  target_soil_moisture_percent: number | null;
  target_min_soil_moisture_percent: number | null;
  target_max_soil_moisture_percent: number | null;
  rainfall_forecast_mm_72h: number | null;
  effective_rainfall_mm_72h: number | null;
  temperature_max_c_72h: number | null;
  net_irrigation_mm: number | null;
  gross_irrigation_mm: number | null;
  gross_irrigation_requirement_mm: number | null;
  unit: "mm";
  calculation_method: string;
  calculation_inputs: Record<string, unknown>;
  derivation: Record<string, unknown>;
  quality: Record<string, unknown>;
  source_fact_id: string | null;
  created_at: string;
};

function toText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : (() => {
      if (typeof value !== "string" || !value.trim()) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = toText(value);
  if (!text) return "";
  const parsedMs = Date.parse(text);
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : text;
}

export function mapIrrigationRequirementIndexV1Row(row: any): IrrigationRequirementIndexV1 {
  return {
    requirement_id: String(row.requirement_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: String(row.field_id ?? ""),
    season_id: String(row.season_id ?? ""),
    crop_code: toText(row.crop_code),
    crop_stage: toText(row.crop_stage),
    source_forecast_id: toText(row.source_forecast_id),
    source_observation_refs: parseJsonStringArray(row.source_observation_refs_json),
    skill_id: String(row.skill_id ?? ""),
    skill_version: String(row.skill_version ?? ""),
    skill_run_id: toText(row.skill_run_id),
    root_zone_soil_moisture_percent: toNumberOrNull(row.root_zone_soil_moisture_percent),
    target_soil_moisture_percent: toNumberOrNull(row.target_soil_moisture_percent),
    target_min_soil_moisture_percent: toNumberOrNull(row.target_min_soil_moisture_percent),
    target_max_soil_moisture_percent: toNumberOrNull(row.target_max_soil_moisture_percent),
    rainfall_forecast_mm_72h: toNumberOrNull(row.rainfall_forecast_mm_72h),
    effective_rainfall_mm_72h: toNumberOrNull(row.effective_rainfall_mm_72h),
    temperature_max_c_72h: toNumberOrNull(row.temperature_max_c_72h),
    net_irrigation_mm: toNumberOrNull(row.net_irrigation_mm),
    gross_irrigation_mm: toNumberOrNull(row.gross_irrigation_mm),
    gross_irrigation_requirement_mm: toNumberOrNull(row.gross_irrigation_requirement_mm),
    unit: "mm",
    calculation_method: String(row.calculation_method ?? ""),
    calculation_inputs: parseJsonObject(row.calculation_inputs_json),
    derivation: parseJsonObject(row.derivation_json),
    quality: parseJsonObject(row.quality_json),
    source_fact_id: toText(row.source_fact_id),
    created_at: toIsoString(row.created_at),
  };
}

export async function getLatestIrrigationRequirementIndexV1(
  pool: Pool,
  tenant: IrrigationRequirementTenantTripleV1,
  params: { field_id: string; source_forecast_id?: string | null },
): Promise<IrrigationRequirementIndexV1 | null> {
  const fieldId = toText(params.field_id);
  if (!fieldId) return null;

  const sourceForecastId = toText(params.source_forecast_id);
  const result = await pool.query(
    `SELECT requirement_id,
            tenant_id,
            project_id,
            group_id,
            field_id,
            season_id,
            crop_code,
            crop_stage,
            source_forecast_id,
            source_observation_refs_json,
            skill_id,
            skill_version,
            skill_run_id,
            root_zone_soil_moisture_percent,
            target_soil_moisture_percent,
            target_min_soil_moisture_percent,
            target_max_soil_moisture_percent,
            rainfall_forecast_mm_72h,
            effective_rainfall_mm_72h,
            temperature_max_c_72h,
            net_irrigation_mm,
            gross_irrigation_mm,
            gross_irrigation_requirement_mm,
            unit,
            calculation_method,
            calculation_inputs_json,
             derivation_json,
            quality_json,
            source_fact_id,
            created_at
       FROM irrigation_requirement_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND ($5::text IS NULL OR source_forecast_id = $5)
      ORDER BY
        CASE WHEN $5::text IS NOT NULL AND source_forecast_id = $5 THEN 0 ELSE 1 END,
        created_at DESC,
        requirement_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId, sourceForecastId],
  );

  const row = result.rows?.[0] ?? null;
  return row ? mapIrrigationRequirementIndexV1Row(row) : null;
}
