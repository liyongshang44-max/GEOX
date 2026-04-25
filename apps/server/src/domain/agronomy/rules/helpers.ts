import { randomUUID } from "node:crypto";
import type { AgronomyRecommendationV2, AgronomyRuleInput } from "@geox/contracts";

import { buildSkillTraceV1 } from "../skill_trace_v1.js";

function telemetryRefs(input: AgronomyRuleInput): string[] {
  const refs: string[] = [];
  if (typeof input.telemetry.soil_moisture === "number") refs.push("telemetry:soil_moisture");
  if (typeof input.telemetry.canopy_temp === "number") refs.push("telemetry:canopy_temp");
  if (typeof input.telemetry.air_temp === "number") refs.push("telemetry:air_temp");
  if (typeof input.telemetry.ec === "number") refs.push("telemetry:ec");
  if (typeof input.telemetry.ph === "number") refs.push("telemetry:ph");
  return refs;
}

export function makeRecommendation(input: AgronomyRuleInput, payload: Omit<AgronomyRecommendationV2, "recommendation_id" | "crop_code" | "crop_stage" | "evidence_basis" | "skill_trace">): AgronomyRecommendationV2 {
  const telemetry_refs = telemetryRefs(input);
  const rule_id = String((payload as any)?.rule_id ?? "agronomy_rule_v1");

  return {
    recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
    crop_code: input.crop_code,
    crop_stage: input.crop_stage,
    evidence_basis: {
      telemetry_refs,
    },
    ...payload,
    skill_trace: buildSkillTraceV1({
      skill_id: rule_id.replace(/_v\d+$/i, "") || "irrigation_deficit_skill_v1",
      skill_version: (rule_id.match(/(v\d+)$/i)?.[1] ?? "v1").toLowerCase(),
      inputs: {
        tenant_id: input.tenant_id,
        project_id: input.project_id,
        group_id: input.group_id,
        field_id: input.field_id,
        crop_code: input.crop_code,
        crop_stage: input.crop_stage,
        telemetry: input.telemetry,
      },
      outputs: {
        recommendation_rule_id: rule_id,
        action_type: (payload as any)?.action_type ?? null,
      },
      confidence: {
        level: "MEDIUM",
        basis: "estimated",
        reasons: ["rule_engine_recommendation"],
      },
      evidence_refs: telemetry_refs,
    }),
  };
}
