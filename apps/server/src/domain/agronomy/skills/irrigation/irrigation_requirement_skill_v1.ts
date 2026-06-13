/* apps/server/src/domain/agronomy/skills/irrigation/irrigation_requirement_skill_v1.ts */
/* PR18K-C defines a deterministic irrigation requirement calculator that does not write facts or create tasks. */

export type IrrigationRequirementSkillInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  soil_moisture: number | null;
  target_soil_moisture?: number | null;
  root_zone_depth_mm?: number | null;
  rain_forecast_mm_72h?: number | null;
  et0_mm_72h?: number | null;
  crop_stage?: string | null;
  application_efficiency?: number | null;
  evidence_refs?: string[];
};

export type IrrigationRequirementConfidenceV1 = {
  level: "HIGH" | "MEDIUM" | "LOW";
  basis: "measured" | "mixed" | "assumed";
  reasons: string[];
};

export type IrrigationRequirementCalculationTraceV1 = {
  formula_version: "irrigation_requirement_skill_v1";
  normalized_soil_moisture: number | null;
  target_soil_moisture: number;
  root_zone_depth_mm: number;
  soil_water_deficit_mm: number;
  crop_stage: string;
  crop_stage_coefficient: number;
  rain_forecast_mm_72h: number;
  rain_credit_mm: number;
  et0_mm_72h: number;
  et0_adjustment_mm: number;
  application_efficiency: number;
};

export type IrrigationRequirementSkillOutputV1 = {
  requirement_detected: boolean;
  net_irrigation_requirement_mm: number;
  gross_irrigation_requirement_mm: number;
  unit: "mm";
  rain_credit_mm: number;
  et0_adjustment_mm: number;
  confidence: IrrigationRequirementConfidenceV1;
  evidence_refs: string[];
  calculation_trace: IrrigationRequirementCalculationTraceV1;
};

const DEFAULT_TARGET_SOIL_MOISTURE = 0.22;
const DEFAULT_ROOT_ZONE_DEPTH_MM = 300;
const DEFAULT_RAIN_FORECAST_MM_72H = 0;
const DEFAULT_ET0_MM_72H = 0;
const DEFAULT_APPLICATION_EFFICIENCY = 0.85;
const DEFAULT_CROP_STAGE = "vegetative";

function toFiniteNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRatio(value: unknown): number | null {
  const parsed = toFiniteNumberOrNull(value);
  if (parsed == null) return null;
  if (parsed < 0) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function positiveOrDefault(value: unknown, fallback: number): number {
  const parsed = toFiniteNumberOrNull(value);
  return parsed != null && parsed > 0 ? parsed : fallback;
}

function nonNegativeOrDefault(value: unknown, fallback: number): number {
  const parsed = toFiniteNumberOrNull(value);
  return parsed != null && parsed >= 0 ? parsed : fallback;
}

function normalizeCropStage(value: unknown): string {
  const normalized = String(value ?? DEFAULT_CROP_STAGE).trim().toLowerCase();
  return normalized || DEFAULT_CROP_STAGE;
}

function cropStageCoefficient(stage: string): number {
  if (stage.includes("flower") || stage.includes("reproductive")) return 1.15;
  if (stage.includes("grain") || stage.includes("fill")) return 1.05;
  if (stage.includes("initial") || stage.includes("seedling")) return 0.7;
  if (stage.includes("maturity") || stage.includes("senescence")) return 0.8;
  return 1;
}

function roundMillimeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function uniqueEvidenceRefs(value: unknown): string[] {
  return Array.from(new Set((Array.isArray(value) ? value : []).map((item) => String(item ?? "").trim()).filter(Boolean)));
}

export function runIrrigationRequirementSkillV1(input: IrrigationRequirementSkillInputV1): IrrigationRequirementSkillOutputV1 {
  const soilMoisture = normalizeRatio(input.soil_moisture);
  const targetSoilMoisture = normalizeRatio(input.target_soil_moisture) ?? DEFAULT_TARGET_SOIL_MOISTURE;
  const rootZoneDepthMm = positiveOrDefault(input.root_zone_depth_mm, DEFAULT_ROOT_ZONE_DEPTH_MM);
  const rainForecastMm72h = nonNegativeOrDefault(input.rain_forecast_mm_72h, DEFAULT_RAIN_FORECAST_MM_72H);
  const et0Mm72h = nonNegativeOrDefault(input.et0_mm_72h, DEFAULT_ET0_MM_72H);
  const cropStage = normalizeCropStage(input.crop_stage);
  const cropCoefficient = cropStageCoefficient(cropStage);
  const applicationEfficiency = positiveOrDefault(input.application_efficiency, DEFAULT_APPLICATION_EFFICIENCY);

  const soilWaterDeficitMm = soilMoisture == null
    ? 0
    : roundMillimeters(Math.max(0, targetSoilMoisture - soilMoisture) * rootZoneDepthMm);
  const rainCreditMm = roundMillimeters(Math.min(rainForecastMm72h, soilWaterDeficitMm));
  const et0AdjustmentMm = roundMillimeters(et0Mm72h * cropCoefficient);
  const netRequirementMm = soilMoisture == null
    ? 0
    : roundMillimeters(Math.max(0, soilWaterDeficitMm + et0AdjustmentMm - rainCreditMm));
  const grossRequirementMm = roundMillimeters(netRequirementMm / applicationEfficiency);

  const confidenceReasons = [
    soilMoisture == null ? "soil_moisture_missing_or_invalid" : "soil_moisture_available",
    input.target_soil_moisture == null ? "target_soil_moisture_defaulted" : "target_soil_moisture_provided",
    input.root_zone_depth_mm == null ? "root_zone_depth_defaulted" : "root_zone_depth_provided",
    input.rain_forecast_mm_72h == null ? "rain_forecast_defaulted" : "rain_forecast_provided",
    input.et0_mm_72h == null ? "et0_defaulted" : "et0_provided",
    input.application_efficiency == null ? "application_efficiency_defaulted" : "application_efficiency_provided",
  ];

  const hasAllCoreInputs =
    soilMoisture != null
    && input.target_soil_moisture != null
    && input.root_zone_depth_mm != null
    && input.rain_forecast_mm_72h != null
    && input.et0_mm_72h != null
    && input.application_efficiency != null;

  const confidence: IrrigationRequirementConfidenceV1 = soilMoisture == null
    ? { level: "LOW", basis: "assumed", reasons: confidenceReasons }
    : hasAllCoreInputs
      ? { level: "HIGH", basis: "measured", reasons: confidenceReasons }
      : { level: "MEDIUM", basis: "mixed", reasons: confidenceReasons };

  return {
    requirement_detected: netRequirementMm > 0,
    net_irrigation_requirement_mm: netRequirementMm,
    gross_irrigation_requirement_mm: grossRequirementMm,
    unit: "mm",
    rain_credit_mm: rainCreditMm,
    et0_adjustment_mm: et0AdjustmentMm,
    confidence,
    evidence_refs: uniqueEvidenceRefs(input.evidence_refs),
    calculation_trace: {
      formula_version: "irrigation_requirement_skill_v1",
      normalized_soil_moisture: soilMoisture,
      target_soil_moisture: targetSoilMoisture,
      root_zone_depth_mm: rootZoneDepthMm,
      soil_water_deficit_mm: soilWaterDeficitMm,
      crop_stage: cropStage,
      crop_stage_coefficient: cropCoefficient,
      rain_forecast_mm_72h: rainForecastMm72h,
      rain_credit_mm: rainCreditMm,
      et0_mm_72h: et0Mm72h,
      et0_adjustment_mm: et0AdjustmentMm,
      application_efficiency: applicationEfficiency,
    },
  };
}
