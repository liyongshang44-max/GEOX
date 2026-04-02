import type { AgronomyContext } from "./context_builder";
import { cornRules } from "./crops/corn/rules";
import { tomatoRules } from "./crops/tomato/rules";

export type AgronomyRule = {
  ruleId: string;
  cropCode: string;
  cropStage: string;
  actionType: "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";
  priority: "low" | "medium" | "high";
  reasonCodes: string[];
  expectedEffect: {
    type: string;
    value: number;
  };
  riskIfNotExecute: string;
  matches: (ctx: any) => boolean;
};

function priorityScore(priority: AgronomyRule["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function specificityScore(rule: AgronomyRule): number {
  return (rule.reasonCodes?.length ?? 0)
    + (rule.cropStage && rule.cropStage !== "any" ? 1 : 0)
    + (rule.riskIfNotExecute ? 1 : 0);
}

function pickRulesByCropCode(cropCode: string): AgronomyRule[] {
  switch (String(cropCode ?? "").trim().toLowerCase()) {
    case "corn":
      return cornRules as AgronomyRule[];
    case "tomato":
      return tomatoRules as AgronomyRule[];
    default:
      return [];
  }
}

function toCornContext(ctx: AgronomyContext): Record<string, unknown> {
  return {
    cropStage: ctx.cropStage,
    soilMoisture: ctx.currentMetrics?.soil_moisture ?? undefined,
  };
}

function toTomatoContext(ctx: AgronomyContext): Record<string, unknown> {
  const nutrientDeficit = Boolean(
    ctx.constraints?.nutrientDeficit
    ?? ctx.constraints?.nutrient_deficit
  );

  const soilDry = typeof ctx.currentMetrics?.soil_moisture === "number"
    ? ctx.currentMetrics.soil_moisture < 30
    : Boolean(ctx.constraints?.soilDry ?? ctx.constraints?.soil_dry);

  return {
    cropStage: ctx.cropStage,
    nutrientDeficit,
    soilDry,
  };
}

function toRuleContext(ctx: AgronomyContext): Record<string, unknown> {
  const cropCode = String(ctx.cropCode ?? "").trim().toLowerCase();
  if (cropCode === "corn") return toCornContext(ctx);
  if (cropCode === "tomato") return toTomatoContext(ctx);
  return { cropStage: ctx.cropStage };
}

export function evaluateRules(ctx: AgronomyContext): AgronomyRule[] {
  const candidateRules = pickRulesByCropCode(ctx.cropCode);
  const ruleContext = toRuleContext(ctx);

  const matched = candidateRules.filter((rule) => {
    try {
      return Boolean(rule.matches(ruleContext));
    } catch {
      return false;
    }
  });

  matched.sort((a, b) => {
    const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const specificityDiff = specificityScore(b) - specificityScore(a);
    if (specificityDiff !== 0) return specificityDiff;

    return a.ruleId.localeCompare(b.ruleId);
  });

  const dedupByActionType = new Set<string>();
  const unique: AgronomyRule[] = [];
  for (const rule of matched) {
    if (dedupByActionType.has(rule.actionType)) continue;
    dedupByActionType.add(rule.actionType);
    unique.push(rule);
  }

  return unique;
}

export function pickBestRule(rules: AgronomyRule[]): AgronomyRule | null {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  const sorted = [...rules].sort((a, b) => {
    const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const specificityDiff = specificityScore(b) - specificityScore(a);
    if (specificityDiff !== 0) return specificityDiff;

    return a.ruleId.localeCompare(b.ruleId);
  });

  return sorted[0] ?? null;
}
