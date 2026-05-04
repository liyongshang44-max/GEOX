import type { FieldMemoryContextV1 } from "./field_memory_context_service.js";

export type RecommendationMemoryAdjustmentV1 = {
  confidence_adjustment: "NONE" | "LOWER_ONE_LEVEL";
  requires_manual_review: boolean;
  risk_reasons: string[];
  explain_append: string;
  memory_refs: string[];
};

export function buildRecommendationMemoryAdjustmentV1(memory: FieldMemoryContextV1): RecommendationMemoryAdjustmentV1 {
  const risk_reasons: string[] = [];
  const explain: string[] = [];
  let confidence_adjustment: RecommendationMemoryAdjustmentV1["confidence_adjustment"] = "NONE";
  let requires_manual_review = false;

  if (memory.weak_response_count >= 2) {
    confidence_adjustment = "LOWER_ONE_LEVEL";
    requires_manual_review = true;
    risk_reasons.push("FIELD_MEMORY_WEAK_IRRIGATION_RESPONSE");
    explain.push("该地块历史灌后水分回升偏弱，本次建议需人工复核。");
  }

  if (memory.execution_deviation_count >= 2) {
    requires_manual_review = true;
    risk_reasons.push("FIELD_MEMORY_EXECUTION_DEVIATION_RISK");
    explain.push("该地块历史执行偏差较大，本次建议需人工复核。");
  }

  if (memory.skill_failure_count >= 1) {
    risk_reasons.push("FIELD_MEMORY_SKILL_PERFORMANCE_RISK");
    explain.push(`历史技能失败 ${memory.skill_failure_count} 次`);
  }

  return {
    confidence_adjustment,
    requires_manual_review,
    risk_reasons,
    explain_append: explain.join("；"),
    memory_refs: memory.memory_refs,
  };
}
