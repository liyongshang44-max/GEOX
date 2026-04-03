import { randomUUID } from "node:crypto";
import type { AgronomyRecommendationV2, AgronomyRuleInput } from "@geox/contracts";

function telemetryRefs(input: AgronomyRuleInput): string[] {
  const refs: string[] = [];
  if (typeof input.telemetry.soil_moisture === "number") refs.push("telemetry:soil_moisture");
  if (typeof input.telemetry.canopy_temp === "number") refs.push("telemetry:canopy_temp");
  if (typeof input.telemetry.air_temp === "number") refs.push("telemetry:air_temp");
  if (typeof input.telemetry.ec === "number") refs.push("telemetry:ec");
  if (typeof input.telemetry.ph === "number") refs.push("telemetry:ph");
  return refs;
}

export function makeRecommendation(input: AgronomyRuleInput, payload: Omit<AgronomyRecommendationV2, "recommendation_id" | "crop_code" | "crop_stage" | "evidence_basis">): AgronomyRecommendationV2 {
  return {
    recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
    crop_code: input.crop_code,
    crop_stage: input.crop_stage,
    evidence_basis: {
      telemetry_refs: telemetryRefs(input),
    },
    ...payload,
  };
}
