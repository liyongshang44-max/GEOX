import { randomUUID } from "node:crypto";
import { evaluateRules, pickBestRule } from "./rule_engine";
import type { AgronomyContext, AgronomyRecommendationPayload } from "./types";

export function generateAgronomyRecommendation(ctx: AgronomyContext): AgronomyRecommendationPayload | null {
  const matched = evaluateRules(ctx);
  const best = pickBestRule(matched);
  if (!best) return null;

  if (!String(best.rule_id ?? "").trim()) return null;
  if (!String(best.crop_stage ?? "").trim()) return null;
  if (!Array.isArray(best.reasons) || best.reasons.length === 0) return null;

  return best;
}
