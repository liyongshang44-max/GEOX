export type IrrigationDeficitSkillInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  soil_moisture: number;
  crop_stage?: string;
  rain_forecast_mm?: number;
  evidence_refs?: string[];
};

export type IrrigationDeficitSkillOutputV1 = {
  deficit_detected: boolean;
  deficit_level: "LOW" | "MEDIUM" | "HIGH";
  recommended_amount: number;
  unit: "L" | "mm";
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    basis: "measured" | "estimated" | "assumed";
    reasons: string[];
  };
  evidence_refs: string[];
};

const DEFICIT_THRESHOLD = 0.22;
const DEFAULT_RAIN_FORECAST_MM = 0;
const DEFAULT_RECOMMENDED_AMOUNT_L = 25;

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyDeficitLevel(soilMoisture: number, deficitDetected: boolean): "LOW" | "MEDIUM" | "HIGH" {
  if (!deficitDetected) return "LOW";
  if (soilMoisture < 0.16) return "HIGH";
  if (soilMoisture < 0.2) return "MEDIUM";
  return "LOW";
}

export function runIrrigationDeficitSkillV1(input: IrrigationDeficitSkillInputV1): IrrigationDeficitSkillOutputV1 {
  const soilMoisture = toFiniteNumber(input.soil_moisture);
  const rainForecast = toFiniteNumber(input.rain_forecast_mm) ?? DEFAULT_RAIN_FORECAST_MM;

  const deficitDetected = soilMoisture != null && soilMoisture < DEFICIT_THRESHOLD;
  const deficitLevel = classifyDeficitLevel(soilMoisture ?? 0, deficitDetected);
  const confidenceLevel = soilMoisture == null ? "LOW" : "HIGH";
  const confidenceBasis = soilMoisture == null ? "assumed" : "measured";

  const confidenceReasons = [
    soilMoisture == null ? "soil_moisture_missing_or_invalid" : "soil_moisture_measured",
    `threshold=${DEFICIT_THRESHOLD}`,
    `rain_forecast_mm=${rainForecast}`,
  ];
  if (deficitDetected) confidenceReasons.push("deficit_rule_triggered");

  const evidenceRefs = Array.from(new Set((Array.isArray(input.evidence_refs) ? input.evidence_refs : []).filter(Boolean)));

  return {
    deficit_detected: deficitDetected,
    deficit_level: deficitLevel,
    recommended_amount: deficitDetected ? DEFAULT_RECOMMENDED_AMOUNT_L : 0,
    unit: "L",
    confidence: {
      level: confidenceLevel,
      basis: confidenceBasis,
      reasons: confidenceReasons,
    },
    evidence_refs: evidenceRefs,
  };
}
