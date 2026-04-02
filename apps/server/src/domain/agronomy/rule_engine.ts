import { cornRules } from "./crops/corn/rules";
import { tomatoRules } from "./crops/tomato/rules";
import type { AgronomyContext, AgronomyRule } from "./types";

type RuleWithScore = AgronomyRule & { score?: number };

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

function sortRules(rules: RuleWithScore[]): RuleWithScore[] {
  return rules.sort((a, b) => {
    const p = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (p !== 0) return p;

    const sA = a.score ?? 0;
    const sB = b.score ?? 0;
    return sB - sA;
  });
}

export function evaluateRules(ctx: AgronomyContext): AgronomyRule[] {
  return sortRules(
    getRulesForCrop(ctx.cropCode)
      .filter((rule) => rule.cropStage === ctx.cropStage)
      .filter((rule) => rule.matches(ctx)),
  );
}

export function pickBestRule(rules: AgronomyRule[]): AgronomyRule | null {
  return rules[0] ?? null;
}
