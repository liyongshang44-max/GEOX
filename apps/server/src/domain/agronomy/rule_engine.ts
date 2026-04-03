import type { Pool } from "pg";
import type { AgronomyRuleInput } from "@geox/contracts";
import { cornRules } from "./crops/corn/rules";
import { tomatoRules } from "./crops/tomato/rules";
import type { AgronomyContext, AgronomyRule } from "./types";

export type RuleWithScore = AgronomyRule & { score?: number; totalCount?: number };

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

    const sA = a.totalCount !== undefined && a.totalCount < 5 ? undefined : a.score;
    const sB = b.totalCount !== undefined && b.totalCount < 5 ? undefined : b.score;

    if (sA === undefined || sB === undefined) return 0;
    return (sB ?? 0) - (sA ?? 0);
  });
}

export async function attachRuleScores(rules: AgronomyRule[], pool: Pool): Promise<RuleWithScore[]> {
  if (!Array.isArray(rules) || !rules.length) return [];

  const ruleIds = Array.from(new Set(rules.map((rule) => String(rule.ruleId ?? "").trim()).filter(Boolean)));
  const scoreMap = new Map<string, { score: number; totalCount: number }>();

  if (ruleIds.length) {
    const res = await pool.query(
      `SELECT rule_id, score, total_count
       FROM agronomy_rule_performance
       WHERE rule_id = ANY($1::text[])`,
      [ruleIds],
    );

    for (const row of res.rows ?? []) {
      const ruleId = String(row.rule_id ?? "").trim();
      if (!ruleId) continue;
      const score = Number(row.score ?? 0.5);
      const totalCount = Number(row.total_count ?? 0);
      scoreMap.set(ruleId, {
        score: Number.isFinite(score) ? score : 0.5,
        totalCount: Number.isFinite(totalCount) ? totalCount : 0,
      });
    }
  }

  return rules.map((rule) => {
    const stats = scoreMap.get(rule.ruleId);
    const totalCount = stats?.totalCount ?? 0;
    const stable = totalCount >= 5;

    return {
      ...rule,
      score: stable ? (stats?.score ?? 0.5) : undefined,
      totalCount,
    };
  });
}

export function normalizeAgronomyRuleInput(input: AgronomyRuleInput): AgronomyContext {
  return {
    tenantId: input.tenant_id,
    projectId: input.project_id,
    groupId: input.group_id,
    fieldId: input.field_id,
    seasonId: input.season_id,
    cropCode: input.crop_code,
    cropStage: input.crop_stage,
    currentMetrics: {
      soil_moisture: input.telemetry.soil_moisture ?? null,
      temperature: input.telemetry.air_temp ?? input.telemetry.canopy_temp ?? null,
      humidity: input.telemetry.humidity ?? null,
    },
    constraints: {
      ...(input.constraints ?? {}),
      ...(input.context ? { context: input.context } : {}),
    },
  };
}

export function evaluateRules(ctx: AgronomyContext): AgronomyRule[] {
  return sortRules(
    getRulesForCrop(ctx.cropCode)
      .filter((rule) => rule.cropStage === ctx.cropStage)
      .filter((rule) => rule.matches(ctx)),
  );
}

export function evaluateRulesByInput(input: AgronomyRuleInput): AgronomyRule[] {
  return evaluateRules(normalizeAgronomyRuleInput(input));
}

export function pickBestRule(rules: AgronomyRule[]): AgronomyRule | null {
  return rules[0] ?? null;
}
