import { createSkillRegistry, type SkillBindingRecord, type SkillBindingSource } from "@geox/skill-registry";
import { ruleSkills } from "../agronomy/skills";
import type { AgronomyRuleSkill } from "../agronomy/skills/types";
import { listFallbackSkillSwitches } from "../agronomy/skills/runtime_config";
import { appendSkillBindingFact } from "./facts";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../../projections/skill_registry_read_v1";

const registry = createSkillRegistry<AgronomyRuleSkill>({
  ruleSkills,
  listFallbackSkillSwitches,
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
