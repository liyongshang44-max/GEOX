import { cornRules } from "./crops/corn/rules";
import { tomatoRules } from "./crops/tomato/rules";
import type { AgronomyContext, AgronomyRule } from "./types";

function getRulesForCrop(cropCode: string): AgronomyRule[] {
  const key = String(cropCode || "").toLowerCase();
  if (key === "corn") return cornRules;
  if (key === "tomato") return tomatoRules;
  return [];
}

function priorityWeight(priority: string): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

export function evaluateRules(ctx: AgronomyContext): AgronomyRule[] {
  return getRulesForCrop(ctx.cropCode)
    .filter((rule) => rule.cropStage === ctx.cropStage)
    .filter((rule) => rule.matches(ctx))
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
}

export function pickBestRule(rules: AgronomyRule[]): AgronomyRule | null {
  return rules[0] ?? null;
}
