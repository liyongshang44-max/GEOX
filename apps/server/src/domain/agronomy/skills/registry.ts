import { CORN_CROP_SKILL } from "./crop/corn/corn.crop";
import { TOMATO_CROP_SKILL } from "./crop/tomato/tomato.crop";
import { CORN_WATER_BALANCE_RULE } from "./rules/corn/corn.water_balance.rule";
import { TOMATO_FERTILIZE_RULE } from "./rules/tomato/tomato.fertilize.rule";
import { IRRIGATION_ACCEPTANCE_SKILL } from "./acceptance/irrigation.acceptance";
import { FERTILIZE_ACCEPTANCE_SKILL } from "./acceptance/fertilize.acceptance";
import type { AcceptanceSkill, AgronomyRuleSkill, CropSkill, CropStage } from "./types";

export const CROP_SKILLS: CropSkill[] = [
  CORN_CROP_SKILL,
  TOMATO_CROP_SKILL,
];

export const AGRONOMY_RULE_SKILLS: AgronomyRuleSkill[] = [
  CORN_WATER_BALANCE_RULE,
  TOMATO_FERTILIZE_RULE,
];

export const ACCEPTANCE_SKILLS: AcceptanceSkill[] = [
  IRRIGATION_ACCEPTANCE_SKILL,
  FERTILIZE_ACCEPTANCE_SKILL,
];

export function getCropSkill(cropCode: string): CropSkill | null {
  const key = String(cropCode ?? "").trim().toLowerCase();
  if (!key) return null;
  return CROP_SKILLS.find((x) => x.crop_code === key) ?? null;
}

export function resolveCropStage(input: {
  crop_code: string;
  days_after_sowing?: number;
  metrics?: any;
}): CropStage | null {
  const crop = getCropSkill(input.crop_code);
  if (!crop) return null;
  return crop.resolveStage({
    days_after_sowing: input.days_after_sowing,
    metrics: input.metrics,
  });
}

export function evaluateAgronomyRules(input: {
  crop_code: string;
  crop_stage: CropStage;
  field_id: string;
  metrics: any;
}) {
  const key = String(input.crop_code ?? "").trim().toLowerCase();
  const matched = AGRONOMY_RULE_SKILLS
    .filter((rule) => rule.crop_code === key)
    .filter((rule) => rule.match({ crop_stage: input.crop_stage, metrics: input.metrics }));

  return matched.map((rule) => ({
    id: rule.id,
    recommendation: rule.recommend({
      field_id: input.field_id,
      crop_stage: input.crop_stage,
      metrics: input.metrics,
    }),
  }));
}

export function getAcceptanceSkill(actionType: string): AcceptanceSkill | null {
  const key = String(actionType ?? "").trim().toUpperCase();
  return ACCEPTANCE_SKILLS.find((x) => x.action_type === key) ?? null;
}
