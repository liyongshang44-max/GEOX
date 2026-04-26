import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

export type AgronomyJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  recommendation_id?: string | null;
  prescription_id?: string | null;
  field_id?: string | null;
  season_id?: string | null;
  device_id?: string | null;
  soil_moisture?: number | null;
  deficit_threshold?: number;
  evidence_refs?: unknown[];
  source_refs?: unknown[];
};

export function evaluateAgronomyJudgeV2(input: AgronomyJudgeEvaluateInput): JudgeResultV2CreateInput {
  const soilMoisture = Number(input.soil_moisture);
  const threshold = Number(input.deficit_threshold ?? 0.22);
  const hasSoilMoisture = Number.isFinite(soilMoisture);
  const inDeficit = hasSoilMoisture ? soilMoisture < threshold : true;

  return {
    judge_kind: "AGRONOMY",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    recommendation_id: input.recommendation_id ?? null,
    prescription_id: input.prescription_id ?? null,
    field_id: input.field_id ?? null,
    season_id: input.season_id ?? null,
    device_id: input.device_id ?? null,
    verdict: hasSoilMoisture ? (inDeficit ? "WATER_DEFICIT" : "PASS") : "INSUFFICIENT_EVIDENCE",
    severity: hasSoilMoisture ? (inDeficit ? "HIGH" : "LOW") : "MEDIUM",
    reasons: hasSoilMoisture
      ? (inDeficit ? ["soil_moisture_below_threshold"] : ["soil_moisture_within_threshold"])
      : ["soil_moisture_missing"],
    inputs: {
      soil_moisture: hasSoilMoisture ? soilMoisture : null,
      deficit_threshold: threshold,
    },
    outputs: {
      in_deficit: inDeficit,
    },
    confidence: {
      level: hasSoilMoisture ? "MEDIUM" : "LOW",
      basis: hasSoilMoisture ? "measured" : "assumed",
      reasons: hasSoilMoisture ? ["soil_moisture_signal"] : ["fallback_without_sensor"],
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
  };
}
