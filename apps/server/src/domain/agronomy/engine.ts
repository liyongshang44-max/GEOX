import { randomUUID } from "node:crypto";
import { evaluateRules, pickBestRule } from "./rule_engine";
import type { AgronomyContext, AgronomyPriority, AgronomyRecommendationPayload, EffectType } from "./types";

function priorityToConfidence(priority: AgronomyPriority): number {
  if (priority === "high") return 0.9;
  if (priority === "medium") return 0.75;
  return 0.6;
}

function mapExpectedEffect(effect: { type: EffectType; value: number }) {
  if (effect.type === "moisture_increase") {
    return { metric: "soil_moisture", direction: "increase" as const, value: effect.value, unit: "%" };
  }
  if (effect.type === "nutrition_boost") {
    return { metric: "nutrition", direction: "increase" as const, value: effect.value };
  }
  return { metric: "disease_risk", direction: "decrease" as const, value: effect.value };
}

function collectTelemetryRefs(ctx: AgronomyContext): string[] {
  const refs: string[] = [];
  if (typeof ctx.currentMetrics.soil_moisture === "number") refs.push("telemetry:soil_moisture");
  if (typeof ctx.currentMetrics.temperature === "number") refs.push("telemetry:temperature");
  if (typeof ctx.currentMetrics.humidity === "number") refs.push("telemetry:humidity");
  return refs;
}

export function generateAgronomyRecommendation(ctx: AgronomyContext): AgronomyRecommendationPayload | null {
  const matched = evaluateRules(ctx);
  const best = pickBestRule(matched);
  if (!best) return null;

  const normalizedRuleId = String(best.ruleId ?? "").trim();
  const normalizedCropStage = String(best.cropStage ?? "").trim();
  if (!normalizedRuleId || !normalizedCropStage) return null;

  const reasons = best.reasonCodes.map((reason) => String(reason ?? "").trim()).filter(Boolean);
  const normalizedReasons = reasons.length > 0 ? reasons : ["rule_matched"];

  return {
    recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
    crop_code: best.cropCode,
    crop_stage: normalizedCropStage,
    rule_id: normalizedRuleId,
    action_type: best.actionType === "SPRAY" ? "INSPECT" : best.actionType,
    confidence: priorityToConfidence(best.priority),
    reasons: normalizedReasons,
    expected_effect: [mapExpectedEffect(best.expectedEffect)],
    evidence_basis: {
      telemetry_refs: collectTelemetryRefs(ctx),
    },
  };
}
