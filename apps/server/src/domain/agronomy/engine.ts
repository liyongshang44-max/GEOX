import { randomUUID } from "node:crypto";
import { evaluateRules, pickBestRule } from "./rule_engine.js";
import type { AgronomyContext, AgronomyRecommendationPayload } from "./types.js";

export async function generateAgronomyRecommendation(ctx: AgronomyContext): Promise<AgronomyRecommendationPayload | null> {
  const matched = await evaluateRules(ctx);
  const best = pickBestRule(matched);
  if (!best) return null;

  if (!String(best.rule_id ?? "").trim()) return null;
  if (!String(best.crop_stage ?? "").trim()) return null;
  if (!Array.isArray(best.reasons) || best.reasons.length === 0) return null;

  return best;
}

export function newRecommendationId(prefix = "rec"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
