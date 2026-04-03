import { CORN_CROP_SKILL_V1 } from "./crop/corn/corn.crop";
import { TOMATO_CROP_SKILL_V1 } from "./crop/tomato/tomato.crop";
import { CORN_WATER_BALANCE_RULE_V1 } from "./rules/corn/corn.water_balance.rule";
import { TOMATO_FERTILIZE_RULE_V1 } from "./rules/tomato/tomato.fertilize.rule";
import { IRRIGATION_ACCEPTANCE_V1 } from "./acceptance/irrigation.acceptance";
import { FERTILIZE_ACCEPTANCE_V1 } from "./acceptance/fertilize.acceptance";
import type { AcceptanceSkill, CropSkill, RuleSkill, RuleSkillInput } from "./types";

export const CROP_SKILLS_V1: CropSkill[] = [
  CORN_CROP_SKILL_V1,
  TOMATO_CROP_SKILL_V1,
];

export const RULE_SKILLS_V1: RuleSkill[] = [
  CORN_WATER_BALANCE_RULE_V1,
  TOMATO_FERTILIZE_RULE_V1,
];

export const ACCEPTANCE_SKILLS_V1: AcceptanceSkill[] = [
  IRRIGATION_ACCEPTANCE_V1,
  FERTILIZE_ACCEPTANCE_V1,
];

export function getCropSkill(cropCode: string): CropSkill | null {
  const key = String(cropCode ?? "").trim().toLowerCase();
  if (!key) return null;
  return CROP_SKILLS_V1.find((x) => x.crop_code === key) ?? null;
}

export function evaluateRuleSkills(input: RuleSkillInput) {
  const key = String(input.crop_code ?? "").trim().toLowerCase();
  const candidates = RULE_SKILLS_V1.filter((rule) => rule.crop_code === key);
  return candidates.map((rule) => ({ rule_id: rule.rule_id, result: rule.evaluate(input) }));
}

export function getAcceptanceSkillByAction(actionType: string): AcceptanceSkill | null {
  const key = String(actionType ?? "").trim().toUpperCase();
  return ACCEPTANCE_SKILLS_V1.find((x) => x.action_type === key) ?? null;
}
