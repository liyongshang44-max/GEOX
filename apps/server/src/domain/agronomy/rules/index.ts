import type { AgronomyRecommendationV2, AgronomyRuleInput } from "@geox/contracts";
import { cornRules } from "./corn_rules.js";
import { tomatoRules } from "./tomato_rules.js";

export type AgronomyRule = {
  rule_id: string;
  crop_code: string;
  stages: string[];
  evaluate: (input: AgronomyRuleInput) => AgronomyRecommendationV2 | null;
};

export const agronomyRuleRegistry: AgronomyRule[] = [
  ...cornRules,
  ...tomatoRules,
];

export function evaluateRuleRegistry(input: AgronomyRuleInput): AgronomyRecommendationV2[] {
  const crop = String(input.crop_code || "").toLowerCase();
  const stage = String(input.crop_stage || "").toLowerCase();

  return agronomyRuleRegistry
    .filter((rule) => rule.crop_code === crop)
    .filter((rule) => rule.stages.includes(stage))
    .map((rule) => rule.evaluate(input))
    .filter((rec): rec is AgronomyRecommendationV2 => Boolean(rec))
    .filter((rec) => Array.isArray(rec.reasons) && rec.reasons.length > 0)
    .sort((a, b) => b.confidence - a.confidence);
}
