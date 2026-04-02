import { evaluateRules, pickBestRule } from "./rule_engine";
import type { AgronomyContext, AgronomyRecommendationPayload } from "./types";

function buildSummary(ruleId: string, cropCode: string, cropStage: string, actionType: string): string {
  return `根据当前作物阶段（${cropCode} / ${cropStage}）与田间指标，建议执行 ${actionType}。规则：${ruleId}`;
}

export function generateAgronomyRecommendation(ctx: AgronomyContext): AgronomyRecommendationPayload | null {
  const matched = evaluateRules(ctx);
  const best = pickBestRule(matched);
  if (!best) return null;

  return {
    crop_code: best.cropCode,
    crop_stage: best.cropStage,
    rule_id: best.ruleId,
    action_type: best.actionType,
    priority: best.priority,
    reason_codes: best.reasonCodes,
    expected_effect: best.expectedEffect,
    risk_if_not_execute: best.riskIfNotExecute,
    summary: buildSummary(best.ruleId, best.cropCode, best.cropStage, best.actionType),
  };
}
