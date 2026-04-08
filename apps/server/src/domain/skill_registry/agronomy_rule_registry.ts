import { createSkillRegistry, type SkillBindingRecord, type SkillBindingSource } from "@geox/skill-registry";
import { appendSkillBindingFact } from "./facts";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../../projections/skill_registry_read_v1";

if (process.env.GEOX_DISABLE_LEGACY_SKILLS !== "false") {
  throw new Error("LEGACY_AGRONOMY_SKILLS_DISABLED");
}

type MigrationRuleSkill = { id: string; version: string };

const registry = createSkillRegistry<MigrationRuleSkill>({
  ruleSkills: [],
  listFallbackSkillSwitches: () => [],
  appendSkillBindingFact,
  projectSkillRegistryReadV1,
  querySkillRegistryReadV1,
});

export type { SkillBindingRecord, SkillBindingSource };

export const configureSkillBindingsPool = registry.configureSkillBindingsPool;
export const listSkillBindings = registry.listSkillBindings;
export const switchSkillBinding = registry.switchSkillBinding;
export const resolveRuleSkillBindings = registry.resolveRuleSkillBindings;
export const getRuleSkills = registry.getRuleSkills;
