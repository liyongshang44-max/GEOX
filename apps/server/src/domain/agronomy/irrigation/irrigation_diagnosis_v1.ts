export type IrrigationDiagnosisInputV1 = {
  soil_moisture: number | null;
  soil_moisture_threshold?: number;
  rain_forecast_mm?: number;
  crop_stage?: string | null;
  observed_at_ts_ms?: number;
  evidence_refs?: string[];
};

export type IrrigationDiagnosisV1 = {
  diagnosis_id: string;
  diagnosis_type: "WATER_DEFICIT" | "NO_WATER_DEFICIT";
  threshold: number;
  soil_moisture: number | null;
  rain_forecast_mm: number;
  crop_stage: string;
  water_deficit: boolean;
  reason_codes: string[];
  evidence_refs: string[];
  explain: string;
  observed_at_ts_ms: number;
};

const DEFAULT_THRESHOLD = 0.22;
const DEFAULT_CROP_STAGE = "vegetative";

function normalizeNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function diagnoseIrrigationV1(input: IrrigationDiagnosisInputV1): IrrigationDiagnosisV1 {
  const threshold = normalizeNumber(input.soil_moisture_threshold) ?? DEFAULT_THRESHOLD;
  const soil_moisture = normalizeNumber(input.soil_moisture);
  const rain_forecast_mm = normalizeNumber(input.rain_forecast_mm) ?? 0;
  const crop_stage = String(input.crop_stage ?? DEFAULT_CROP_STAGE).trim() || DEFAULT_CROP_STAGE;
  const observed_at_ts_ms = normalizeNumber(input.observed_at_ts_ms) ?? Date.now();
  const water_deficit = soil_moisture != null && soil_moisture < threshold;

  const reason_codes = water_deficit
    ? ["soil_moisture_below_threshold", rain_forecast_mm <= 0 ? "no_rain_forecast" : "rain_forecast_present"]
    : ["soil_moisture_not_below_threshold"];

  const evidence_refs = (Array.isArray(input.evidence_refs) ? input.evidence_refs : []).filter(Boolean);

  const explain = water_deficit
    ? `Soil moisture (${soil_moisture}) is below threshold (${threshold}) with rain_forecast_mm=${rain_forecast_mm}; irrigation action should be considered.`
    : `Soil moisture (${soil_moisture}) is not below threshold (${threshold}); irrigation recommendation is not required.`;

  return {
    diagnosis_id: `diag_irrigation_${observed_at_ts_ms}`,
    diagnosis_type: water_deficit ? "WATER_DEFICIT" : "NO_WATER_DEFICIT",
    threshold,
    soil_moisture,
    rain_forecast_mm,
    crop_stage,
    water_deficit,
    reason_codes,
    evidence_refs,
    explain,
    observed_at_ts_ms,
  };
}
