import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";
import { runIrrigationDeficitSkillV1 } from "../agronomy/skills/irrigation/irrigation_deficit_skill_v1.js";

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

export function evaluateAgronomyJudgeV2(input: AgronomyJudgeEvaluateInput): JudgeResultV2CreateInput {
  const soilMoisture = Number(input.soil_moisture);
  const evidenceVerdict = String(input.evidence_judge_verdict ?? "").trim().toUpperCase();
  const blockedByEvidence = ["DEVICE_OFFLINE", "INSUFFICIENT_EVIDENCE", "STALE_DATA"].includes(evidenceVerdict);
  const skillOutput = runIrrigationDeficitSkillV1({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: String(input.field_id ?? "__unknown_field__"),
    soil_moisture: Number.isFinite(soilMoisture) ? soilMoisture : NaN,
    evidence_refs: toStringArray(input.evidence_refs),
  });
  const inDeficit = Number.isFinite(soilMoisture) && soilMoisture < 0.22;

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
    verdict: blockedByEvidence ? "BLOCKED" : (inDeficit ? "WATER_DEFICIT" : "PASS"),
    severity: blockedByEvidence ? "HIGH" : (inDeficit ? "HIGH" : "LOW"),
    reasons: blockedByEvidence
      ? ["blocked_by_evidence_judge"]
      : (inDeficit ? ["soil_moisture_below_threshold"] : ["soil_moisture_within_threshold"]),
    inputs: {
      soil_moisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
      evidence_judge_verdict: evidenceVerdict || null,
    },
    outputs: {
      skill_id: "irrigation_deficit_skill_v1",
      deficit_detected: skillOutput.deficit_detected,
      recommended_amount: skillOutput.recommended_amount,
      unit: skillOutput.unit,
    },
    confidence: {
      level: blockedByEvidence ? "MEDIUM" : skillOutput.confidence.level,
      basis: blockedByEvidence ? "assumed" : skillOutput.confidence.basis,
      reasons: blockedByEvidence ? ["evidence_judge_gate"] : skillOutput.confidence.reasons,
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
  };
}
