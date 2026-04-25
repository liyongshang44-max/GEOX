import { IRRIGATION_RECOMMENDATION_ACTION } from "../../controlplane/irrigation_action_mapping_v1.js";
import type { IrrigationDiagnosisV1 } from "./irrigation_diagnosis_v1.js";

export type IrrigationRecommendationInputV1 = {
  recommendation_id: string;
  snapshot_id: string;
  field_id: string;
  season_id: string;
  device_id: string;
  crop_code: string;
  crop_stage: string;
  diagnosis: IrrigationDiagnosisV1;
  suggested_amount?: { amount: number; unit: "L" | "mm" };
  created_ts?: number;
  confidence?: number;
  skill_trace?: {
    skill_id: string;
    skill_version?: string;
    trace_id?: string;
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
    confidence?: { level: "HIGH" | "MEDIUM" | "LOW"; basis: "measured" | "estimated" | "assumed"; reasons?: string[] };
    evidence_refs?: string[];
  };
};

export function buildIrrigationRecommendationV1(input: IrrigationRecommendationInputV1) {
  const suggestedAmount = input.suggested_amount ?? { amount: 25, unit: "L" as const };
  const createdTs = Number.isFinite(Number(input.created_ts)) ? Number(input.created_ts) : Date.now();
  const confidence = Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 0.83;
  const diagnosis = input.diagnosis;

  const evidence_refs = Array.from(
    new Set([
      ...diagnosis.evidence_refs,
      "weather_mock:rain_forecast_mm=0",
      "crop_stage:mock_vegetative",
      `diagnosis:${diagnosis.diagnosis_id}`,
    ].filter(Boolean))
  );

  return {
    recommendation_id: input.recommendation_id,
    snapshot_id: input.snapshot_id,
    field_id: input.field_id,
    season_id: input.season_id,
    device_id: input.device_id,
    crop_code: input.crop_code,
    crop_stage: input.crop_stage,
    rule_id: "irrigation_soil_moisture_threshold_v1",
    expected_effect: { soil_moisture: 0.03 },
    recommendation_type: "irrigation_recommendation_v1" as const,
    action_type: "IRRIGATE" as const,
    status: "proposed" as const,
    reason_codes: diagnosis.reason_codes,
    reason_details: diagnosis.reason_codes.map((code) => ({
      code,
      action_hint: "irrigate_first" as const,
      source: "field_sensing_overview_v1" as const,
    })),
    evidence_refs,
    evidence_basis: {
      snapshot_id: input.snapshot_id,
      telemetry_refs: diagnosis.evidence_refs,
    },
    rule_hit: [
      {
        rule_id: "irrigation_soil_moisture_threshold_v1",
        matched: diagnosis.water_deficit,
        threshold: diagnosis.threshold,
        actual: diagnosis.soil_moisture,
      },
    ],
    confidence,
    explain: {
      trigger_source_fields: [
        { field: "soil_moisture", role: "support_signal" as const, value: diagnosis.soil_moisture },
        { field: "soil_moisture_threshold", role: "support_signal" as const, value: diagnosis.threshold },
        { field: "rain_forecast_mm", role: "support_signal" as const, value: diagnosis.rain_forecast_mm },
        { field: "crop_stage", role: "support_signal" as const, value: diagnosis.crop_stage },
      ],
      action_summary: diagnosis.explain,
      rule_hit_summary: [
        {
          rule_id: "irrigation_soil_moisture_threshold_v1",
          matched: diagnosis.water_deficit,
          summary: `soil_moisture=${diagnosis.soil_moisture}, threshold=${diagnosis.threshold}, rain_forecast_mm=${diagnosis.rain_forecast_mm}`,
        },
      ],
    },
    suggested_action: {
      action_type: IRRIGATION_RECOMMENDATION_ACTION,
      summary: `土壤水分低于阈值，建议灌溉 ${suggestedAmount.amount} ${suggestedAmount.unit}。`,
      parameters: {
        amount: suggestedAmount.amount,
        unit: suggestedAmount.unit,
        rain_forecast_mm: diagnosis.rain_forecast_mm,
        crop_stage: diagnosis.crop_stage,
        diagnosis_id: diagnosis.diagnosis_id,
      },
    },
    created_ts: createdTs,
    model_version: "decision_engine_v1" as const,
    skill_trace: input.skill_trace,
  };
}
