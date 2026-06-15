// apps/server/src/projections/irrigation_requirement_skill_input_v1.ts
// Purpose: read the formal irrigation skill input artifact projected into irrigation_requirement_skill_input_index_v1.
// Boundary: this module is read-only; it does not calculate irrigation demand and does not mutate operational state.

import type { Pool } from "pg";

export type IrrigationRequirementSkillInputTenantV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type IrrigationRequirementSkillInputIndexV1 = {
  skill_input_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  requirement_id: string | null;
  season_id: string | null;
  crop_code: string | null;
  crop_stage: string | null;
  source_forecast_id: string | null;
  skill_id: string;
  skill_version: string;
  skill_run_id: string | null;
  input_source: string;
  source_refs: Record<string, unknown>;
  input_values: Record<string, unknown>;
  input_units: Record<string, unknown>;
  source_fact_id: string | null;
  created_at: string | null;
};

function toText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const text = toText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : text;
}

export function mapIrrigationRequirementSkillInputIndexV1(row: any): IrrigationRequirementSkillInputIndexV1 {
  return {
    skill_input_id: String(row.skill_input_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: String(row.field_id ?? ""),
    requirement_id: toText(row.requirement_id),
    season_id: toText(row.season_id),
    crop_code: toText(row.crop_code),
    crop_stage: toText(row.crop_stage),
    source_forecast_id: toText(row.source_forecast_id),
    skill_id: String(row.skill_id ?? ""),
    skill_version: String(row.skill_version ?? ""),
    skill_run_id: toText(row.skill_run_id),
    input_source: String(row.input_source ?? ""),
    source_refs: toJsonObject(row.source_refs_json),
    input_values: toJsonObject(row.input_values_json),
    input_units: toJsonObject(row.input_units_json),
    source_fact_id: toText(row.source_fact_id),
    created_at: toIso(row.created_at),
  };
}

export async function getIrrigationRequirementSkillInputIndexV1(
  pool: Pool,
  tenant: IrrigationRequirementSkillInputTenantV1,
  skillInputId: string,
): Promise<IrrigationRequirementSkillInputIndexV1 | null> {
  const id = toText(skillInputId);
  if (!id) return null;

  const result = await pool.query(
    `SELECT skill_input_id,
            tenant_id,
            project_id,
            group_id,
            field_id,
            requirement_id,
            season_id,
            crop_code,
            crop_stage,
            source_forecast_id,
            skill_id,
            skill_version,
            skill_run_id,
            input_source,
            source_refs_json,
            input_values_json,
            input_units_json,
            source_fact_id,
            created_at
       FROM irrigation_requirement_skill_input_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND skill_input_id = $4
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, id],
  ).catch(() => ({ rows: [] as any[] }));

  const row = result.rows?.[0] ?? null;
  return row ? mapIrrigationRequirementSkillInputIndexV1(row) : null;
}
