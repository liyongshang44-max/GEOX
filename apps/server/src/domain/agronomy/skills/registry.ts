import type { AgronomyRuleSkill } from "./types";
import { ruleSkills } from "./index";
import { skillSwitches } from "./runtime_config";

type ResolvedRuleSkill = AgronomyRuleSkill & { __priority: number };

export function getRuleSkills(input: {
  crop_code: string;
  tenant_id?: string;
}): ResolvedRuleSkill[] {
  const { crop_code, tenant_id } = input;

  const enabled = skillSwitches.filter((s) =>
    s.enabled
    && (!s.scope?.crop_code || s.scope.crop_code === crop_code)
    && (!s.scope?.tenant_id || s.scope.tenant_id === tenant_id)
  );

  const resolved = enabled
    .map((s) => {
      const impl = ruleSkills.find((r) => r.id === s.skill_id && r.version === s.version);
      return impl ? { ...impl, __priority: s.priority } : null;
    })
    .filter((x): x is ResolvedRuleSkill => x !== null);

  resolved.sort((a, b) => b.__priority - a.__priority);

  return resolved;
}
