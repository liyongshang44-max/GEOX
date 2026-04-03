import type { AgronomyRecommendationV2, AgronomyRuleInput } from "@geox/contracts";
import { evaluateRuleRegistry } from "./rules";
import { resolveCropStage } from "./stage_resolver";
import type { AgronomyContext } from "./types";

export function normalizeAgronomyRuleInput(input: AgronomyRuleInput): AgronomyRuleInput {
  return {
    ...input,
    crop_code: String(input.crop_code ?? "").toLowerCase(),
    crop_stage: resolveCropStage({
      cropCode: input.crop_code,
      explicitStage: input.crop_stage,
      daysAfterPlanting: Number.isFinite(Number((input.constraints as Record<string, unknown> | undefined)?.days_after_planting))
        ? Number((input.constraints as Record<string, unknown>).days_after_planting)
        : undefined,
    }),
  };
}

function normalizeContextToRuleInput(ctx: AgronomyContext): AgronomyRuleInput {
  return {
    tenant_id: ctx.tenantId,
    project_id: ctx.projectId,
    group_id: ctx.groupId,
    field_id: ctx.fieldId,
    season_id: ctx.seasonId ?? "unknown",
    crop_code: String(ctx.cropCode ?? "").toLowerCase(),
    crop_stage: resolveCropStage({
      cropCode: ctx.cropCode,
      explicitStage: ctx.cropStage,
      daysAfterPlanting: Number.isFinite(Number((ctx.constraints as Record<string, unknown> | undefined)?.days_after_planting))
        ? Number((ctx.constraints as Record<string, unknown>).days_after_planting)
        : undefined,
    }),
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

export function evaluateRules(ctx: AgronomyContext): AgronomyRecommendationV2[] {
  const normalizedInput = normalizeContextToRuleInput(ctx);
  return evaluateRulesByInput(normalizedInput);
}

export function evaluateRulesByInput(input: AgronomyRuleInput): AgronomyRecommendationV2[] {
  return evaluateRuleRegistry(normalizeAgronomyRuleInput(input));
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

