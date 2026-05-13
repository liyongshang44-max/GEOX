import type { CropContextV1 } from "./crop_context_v1.js";
import type { FieldObservabilityProfileV1 } from "../field/field_observability_profile_v1.js";

export type CropPlanCandidateV1 = {
  field_id: string;
  season_id: string | null;
  crop_code: string;
  suitability_score: number;
  expected_yield_range: { min: number; max: number; unit: string };
  expected_revenue_range: { min: number; max: number; currency: string };
  expected_margin_range: { min: number; max: number; currency: string };
  risk_profile: Record<string, unknown>;
  required_inputs: string[];
  required_devices: string[];
  assumptions: Record<string, unknown>;
  confidence: number;
};

export function buildCropPlanCandidatesV1(params: {
  field_id: string;
  season_id?: string | null;
  crop_context: CropContextV1;
  observability: FieldObservabilityProfileV1;
}): CropPlanCandidateV1[] {
  if (!params.crop_context.allowed_actions.allow_crop_planning) return [];
  const baseConfidence = params.observability.status === "OBSERVED" ? 0.55 : params.observability.status === "PARTIALLY_OBSERVED" ? 0.35 : 0.2;
  const missing = params.observability.missing_inputs;
  return [
    {
      field_id: params.field_id,
      season_id: params.season_id ?? params.crop_context.season_id ?? null,
      crop_code: "corn",
      suitability_score: params.observability.device_coverage.soil_probe ? 0.62 : 0.48,
      expected_yield_range: { min: 7.5, max: 10.5, unit: "t/ha" },
      expected_revenue_range: { min: 15000, max: 22000, currency: "CNY" },
      expected_margin_range: { min: 3500, max: 7600, currency: "CNY" },
      risk_profile: { water_risk: missing.includes("weather") ? "UNKNOWN" : "MEDIUM", data_gap: missing },
      required_inputs: ["soil_texture", "historical_yield", "market_price", "planting_window"],
      required_devices: ["soil_probe", "weather"],
      assumptions: { basis: "default_planning_candidate_v1", note: "placeholder candidate until crop suitability skill is connected" },
      confidence: baseConfidence,
    },
    {
      field_id: params.field_id,
      season_id: params.season_id ?? params.crop_context.season_id ?? null,
      crop_code: "soybean",
      suitability_score: params.observability.device_coverage.soil_probe ? 0.55 : 0.42,
      expected_yield_range: { min: 2.4, max: 3.6, unit: "t/ha" },
      expected_revenue_range: { min: 11000, max: 17000, currency: "CNY" },
      expected_margin_range: { min: 3000, max: 6800, currency: "CNY" },
      risk_profile: { water_risk: "MEDIUM", data_gap: missing },
      required_inputs: ["soil_texture", "rotation_history", "market_price", "planting_window"],
      required_devices: ["soil_probe", "weather"],
      assumptions: { basis: "default_planning_candidate_v1", note: "placeholder candidate until crop economics skill is connected" },
      confidence: Math.max(0.15, baseConfidence - 0.05),
    },
  ];
}
