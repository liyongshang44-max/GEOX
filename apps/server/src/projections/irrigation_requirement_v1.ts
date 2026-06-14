// apps/server/src/projections/irrigation_requirement_v1.ts
// Purpose: define the formal irrigation requirement projection contract used by controlled-pilot H2 acceptance.
// Boundary: this file defines the read-model shape only; seed/apply code owns the compatibility upsert for the C8 fixture.

export const IRRIGATION_REQUIREMENT_INDEX_V1_TABLE = "irrigation_requirement_index_v1";

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
  quality: Record<string, unknown>;
  source_fact_id: string | null;
  created_at: string;
};
