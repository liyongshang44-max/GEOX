import type { AgronomyRecommendationV2, AgronomyRuleInput } from "@geox/contracts";
import type { AgronomyContext } from "./types";
import { cropSkills } from "./skills";
import { getRuleSkills } from "./skills/registry";
import type { CropStage } from "./skills/types";

function normalizeSkillStage(stage: string): CropStage {
  const s = String(stage ?? "").trim().toLowerCase();
  if (s === "seedling" || s === "vegetative" || s === "flowering" || s === "fruiting" || s === "reproductive") {
    return s;
  }
  return "seedling";
}

export function normalizeAgronomyRuleInput(input: AgronomyRuleInput): AgronomyRuleInput {
  const cropCode = String(input.crop_code ?? "").toLowerCase();
  const crop = cropSkills.find((x) => x.crop_code === cropCode);
  const fromSkillResolver = crop?.resolveStage({
    days_after_sowing: Number.isFinite(Number((input.constraints as Record<string, unknown> | undefined)?.days_after_sowing))
      ? Number((input.constraints as Record<string, unknown>).days_after_sowing)
      : Number.isFinite(Number((input.constraints as Record<string, unknown> | undefined)?.days_after_planting))
        ? Number((input.constraints as Record<string, unknown>).days_after_planting)
        : undefined,
    metrics: input.telemetry,
  });

  const explicitStage = normalizeSkillStage(String(input.crop_stage ?? ""));

  return {
    ...input,
    crop_code: cropCode,
    crop_stage: (String(input.crop_stage ?? "").trim() ? explicitStage : fromSkillResolver) || "seedling",
  };
}

function normalizeContextToRuleInput(ctx: AgronomyContext): AgronomyRuleInput {
  const cropCode = String(ctx.cropCode ?? "").toLowerCase();
  const days_after_sowing = Number.isFinite(Number((ctx.constraints as Record<string, unknown> | undefined)?.days_after_sowing))
    ? Number((ctx.constraints as Record<string, unknown>).days_after_sowing)
    : Number.isFinite(Number((ctx.constraints as Record<string, unknown> | undefined)?.days_after_planting))
      ? Number((ctx.constraints as Record<string, unknown>).days_after_planting)
      : undefined;
  const cropSkill = cropSkills.find((x) => x.crop_code === cropCode);
  const explicitStageRaw = String(ctx.cropStage ?? "").trim();
  const explicitStage = explicitStageRaw ? normalizeSkillStage(explicitStageRaw) : null;

  return {
    tenant_id: ctx.tenantId,
    project_id: ctx.projectId,
    group_id: ctx.groupId,
    field_id: ctx.fieldId,
    season_id: ctx.seasonId ?? "unknown",
    crop_code: cropCode,
    crop_stage: explicitStage ?? cropSkill?.resolveStage({
      days_after_sowing,
      metrics: ctx.currentMetrics,
    }) ?? "seedling",
    telemetry: {
      soil_moisture: ctx.currentMetrics.soil_moisture ?? undefined,
      canopy_temp: ctx.currentMetrics.canopy_temp ?? ctx.currentMetrics.temperature ?? undefined,
      air_temp: ctx.currentMetrics.temperature ?? undefined,
      humidity: ctx.currentMetrics.humidity ?? undefined,
      ec: Number.isFinite(Number((ctx.constraints as Record<string, unknown> | undefined)?.ec))
        ? Number((ctx.constraints as Record<string, unknown>).ec)
        : undefined,
      ph: Number.isFinite(Number((ctx.constraints as Record<string, unknown> | undefined)?.ph))
        ? Number((ctx.constraints as Record<string, unknown>).ph)
        : undefined,
    },
    constraints: ctx.constraints as AgronomyRuleInput["constraints"] | undefined,
    context: {
      snapshot_ts: Date.now(),
    },
  };
}

function mapRuleRecommendationToV2(params: {
  input: AgronomyRuleInput;
  skillId: string;
  recommendation: {
    action_type: string;
    expected_effect?: { type: string; value: number };
    reason_codes: string[];
    rule_id: string;
    version: string;
  };
}): AgronomyRecommendationV2 {
  const metric = String(params.recommendation.expected_effect?.type ?? "general_effect");
  const direction = metric.includes("decrease") ? "decrease" : metric.includes("stabil") ? "stabilize" : "increase";

  const recommendation: AgronomyRecommendationV2 & { skill_id: string; reason_codes: string[] } = {
    recommendation_id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    crop_code: String(params.input.crop_code ?? "").toLowerCase(),
    crop_stage: String(params.input.crop_stage ?? ""),
    rule_id: `${params.recommendation.rule_id}_${params.recommendation.version}`,
    action_type: String(params.recommendation.action_type ?? "INSPECT") as AgronomyRecommendationV2["action_type"],
    confidence: 0.8,
    reasons: params.recommendation.reason_codes,
    reason_codes: params.recommendation.reason_codes,
    skill_id: params.skillId,
    expected_effect: [
      {
        metric,
        direction,
        value: Number(params.recommendation.expected_effect?.value ?? NaN),
      }
    ],
    evidence_basis: {
      snapshot_id: String((params.input.context as Record<string, unknown> | undefined)?.snapshot_id ?? ""),
      telemetry_refs: [],
    },
  };
  return recommendation;
}

export async function evaluateRules(ctx: AgronomyContext): Promise<AgronomyRecommendationV2[]> {
  const normalizedInput = normalizeContextToRuleInput(ctx);
  return evaluateRulesByInput(normalizedInput);
}

export async function evaluateRulesByInput(input: AgronomyRuleInput): Promise<AgronomyRecommendationV2[]> {
  const normalized = normalizeAgronomyRuleInput(input);
  const crop_code = String(normalized.crop_code ?? "").toLowerCase();
  const metrics = normalized.telemetry ?? {};
  const days_after_sowing = Number.isFinite(Number((normalized.constraints as Record<string, unknown> | undefined)?.days_after_sowing))
    ? Number((normalized.constraints as Record<string, unknown>).days_after_sowing)
    : Number.isFinite(Number((normalized.constraints as Record<string, unknown> | undefined)?.days_after_planting))
      ? Number((normalized.constraints as Record<string, unknown>).days_after_planting)
      : undefined;
  const cropSkill = cropSkills.find((c) => c.crop_code === crop_code);
  const explicitStage = String(normalized.crop_stage ?? "").trim();
  const crop_stage = explicitStage
    ? normalizeSkillStage(explicitStage)
    : cropSkill
      ? cropSkill.resolveStage({ days_after_sowing, metrics })
      : "seedling";

  const tenant_id = String(normalized.tenant_id ?? "").trim();
  if (!tenant_id) {
    throw new Error("TENANT_ID_REQUIRED_FOR_RULE_ENGINE");
  }

  const rules = await getRuleSkills({
    crop_code,
    tenant_id,
  });

  for (const rule of rules) {
    if (rule.match({ crop_stage, metrics })) {
      const recommendation = rule.recommend({
        field_id: String(normalized.field_id ?? ""),
        crop_stage,
        metrics,
      });
      return [
        mapRuleRecommendationToV2({
          input: { ...normalized, crop_stage },
          skillId: `${rule.id}_${rule.version}`,
          recommendation
        })
      ];
    }
  }

  return [];
}

export function pickBestRule(recommendations: AgronomyRecommendationV2[]): AgronomyRecommendationV2 | null {
  return recommendations[0] ?? null;
}

export function validateRecommendationMainChainFields(input: {
  snapshot_id?: unknown;
  crop_code?: unknown;
  crop_stage?: unknown;
  rule_id?: unknown;
}): { ok: true } | { ok: false; error: string } {
  const snapshotId = String(input.snapshot_id ?? "").trim();
  const cropCode = String(input.crop_code ?? "").trim();
  const cropStage = String(input.crop_stage ?? "").trim();
  const ruleId = String(input.rule_id ?? "").trim();

  if (!snapshotId) return { ok: false, error: "MISSING_SNAPSHOT_ID" };
  if (!cropCode) return { ok: false, error: "MISSING_CROP_CODE" };
  if (!cropStage) return { ok: false, error: "MISSING_CROP_STAGE" };
  if (!ruleId) return { ok: false, error: "MISSING_RULE_ID" };
  return { ok: true };
}
