import type { Pool } from "pg";
import { cornRules } from "./crops/corn/rules";
import { tomatoRules } from "./crops/tomato/rules";
import type { AgronomyContext, AgronomyRule } from "./types";

export type RuleWithScore = AgronomyRule & { score?: number };

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

export function sortRules(rules: RuleWithScore[]): RuleWithScore[] {
  return rules.sort((a, b) => {
    const p = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (p !== 0) return p;

    const sA = a.score ?? 0;
    const sB = b.score ?? 0;
    return sB - sA;
  });
}

export async function attachRuleScores(rules: AgronomyRule[], pool: Pool): Promise<RuleWithScore[]> {
  if (!Array.isArray(rules) || !rules.length) return [];

  const ruleIds = Array.from(new Set(rules.map((rule) => String(rule.ruleId ?? "").trim()).filter(Boolean)));
  const scoreMap = new Map<string, number>();

  if (ruleIds.length) {
    const res = await pool.query(
      `SELECT rule_id, score
       FROM agronomy_rule_performance
       WHERE rule_id = ANY($1::text[])`,
      [ruleIds],
    );

    for (const row of res.rows ?? []) {
      const ruleId = String(row.rule_id ?? "").trim();
      if (!ruleId) continue;
      const score = Number(row.score ?? 0.5);
      scoreMap.set(ruleId, Number.isFinite(score) ? score : 0.5);
    }
  }

  return rules.map((rule) => ({
    ...rule,
    score: scoreMap.get(rule.ruleId) ?? 0.5,
  }));
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
