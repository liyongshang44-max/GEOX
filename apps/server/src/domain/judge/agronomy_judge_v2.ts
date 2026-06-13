import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";
import { runIrrigationDeficitSkillV1 } from "../agronomy/skills/irrigation/irrigation_deficit_skill_v1.js";
import { runIrrigationRequirementSkillV1 } from "../agronomy/skills/irrigation/irrigation_requirement_skill_v1.js";

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
  target_soil_moisture?: number | null;
  root_zone_depth_mm?: number | null;
  rain_forecast_mm_72h?: number | null;
  et0_mm_72h?: number | null;
  crop_stage?: string | null;
  application_efficiency?: number | null;
  evidence_judge_verdict?: string | null;
  evidence_refs?: unknown[];
  source_refs?: unknown[];
};

function toStringArray(values: unknown[] | undefined): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function confidenceBasisForJudgeV2(basis: "measured" | "mixed" | "assumed"): "measured" | "estimated" | "assumed" {
  return basis === "mixed" ? "estimated" : basis;
}

export function evaluateAgronomyJudgeV2(input: AgronomyJudgeEvaluateInput): JudgeResultV2CreateInput {
  const soilMoisture = toFiniteNumberOrNull(input.soil_moisture);
  const targetSoilMoisture = toFiniteNumberOrNull(input.target_soil_moisture);
  const rootZoneDepthMm = toFiniteNumberOrNull(input.root_zone_depth_mm);
  const rainForecastMm72h = toFiniteNumberOrNull(input.rain_forecast_mm_72h);
  const et0Mm72h = toFiniteNumberOrNull(input.et0_mm_72h);
  const applicationEfficiency = toFiniteNumberOrNull(input.application_efficiency);
  const cropStage = String(input.crop_stage ?? "").trim() || null;
  const evidenceVerdict = String(input.evidence_judge_verdict ?? "").trim().toUpperCase();
  const blockedByEvidence = ["DEVICE_OFFLINE", "INSUFFICIENT_EVIDENCE", "STALE_DATA"].includes(evidenceVerdict);
  const evidenceRefs = toStringArray(input.evidence_refs);

  const deficitSkillOutput = runIrrigationDeficitSkillV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: String(input.field_id ?? "__unknown_field__"),
    soil_moisture: soilMoisture ?? NaN,
    crop_stage: cropStage ?? undefined,
    rain_forecast_mm: rainForecastMm72h ?? undefined,
    evidence_refs: evidenceRefs,
  });

  const requirementSkillOutput = runIrrigationRequirementSkillV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: String(input.field_id ?? "__unknown_field__"),
    soil_moisture: soilMoisture,
    target_soil_moisture: targetSoilMoisture,
    root_zone_depth_mm: rootZoneDepthMm,
    rain_forecast_mm_72h: rainForecastMm72h,
    et0_mm_72h: et0Mm72h,
    crop_stage: cropStage,
    application_efficiency: applicationEfficiency,
    evidence_refs: evidenceRefs,
  });

  const requirementDetected = requirementSkillOutput.requirement_detected;
  const reasons = blockedByEvidence
    ? ["blocked_by_evidence_judge"]
    : requirementDetected
      ? [
          "irrigation_requirement_detected",
          ...(deficitSkillOutput.deficit_detected ? ["soil_moisture_below_threshold"] : []),
          ...(requirementSkillOutput.et0_adjustment_mm > 0 ? ["et0_adjustment_included"] : []),
          ...(requirementSkillOutput.rain_credit_mm > 0 ? ["rain_credit_included"] : []),
        ]
      : ["no_irrigation_requirement"];

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
    verdict: blockedByEvidence ? "BLOCKED" : (requirementDetected ? "WATER_DEFICIT" : "PASS"),
    severity: blockedByEvidence ? "HIGH" : (requirementDetected ? "HIGH" : "LOW"),
    reasons,
    inputs: {
      soil_moisture: soilMoisture,
      target_soil_moisture: targetSoilMoisture,
      root_zone_depth_mm: rootZoneDepthMm,
      rain_forecast_mm_72h: rainForecastMm72h,
      et0_mm_72h: et0Mm72h,
      crop_stage: cropStage,
      application_efficiency: applicationEfficiency,
      evidence_judge_verdict: evidenceVerdict || null,
    },
    outputs: {
      skill_id: "irrigation_deficit_skill_v1",
      deficit_detected: deficitSkillOutput.deficit_detected,
      recommended_amount: deficitSkillOutput.recommended_amount,
      unit: deficitSkillOutput.unit,
      requirement_skill_id: "irrigation_requirement_skill_v1",
      requirement_detected: requirementSkillOutput.requirement_detected,
      net_irrigation_requirement_mm: requirementSkillOutput.net_irrigation_requirement_mm,
      gross_irrigation_requirement_mm: requirementSkillOutput.gross_irrigation_requirement_mm,
      requirement_unit: requirementSkillOutput.unit,
      rain_credit_mm: requirementSkillOutput.rain_credit_mm,
      et0_adjustment_mm: requirementSkillOutput.et0_adjustment_mm,
      calculation_trace: requirementSkillOutput.calculation_trace,
    },
    confidence: blockedByEvidence
      ? {
          level: "MEDIUM",
          basis: "assumed",
          reasons: ["evidence_judge_gate"],
        }
      : {
          level: requirementSkillOutput.confidence.level,
          basis: confidenceBasisForJudgeV2(requirementSkillOutput.confidence.basis),
          reasons: requirementSkillOutput.confidence.reasons,
        },
    evidence_refs: requirementSkillOutput.evidence_refs,
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
  };
}
