import { requestJson, withQuery } from "./client";

export type SkillRuleSwitch = {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority: number;
  scope?: {
    tenant_id?: string;
    crop_code?: string;
  };
};

export async function listSkillRules(input?: {
  crop_code?: string;
  tenant_id?: string;
  enabled_only?: boolean;
}): Promise<SkillRuleSwitch[]> {
  return requestJson<SkillRuleSwitch[]>(withQuery("/api/v1/skills/rules", input));
}

export async function switchSkillRule(input: {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority?: number;
  scope?: {
    tenant_id?: string;
    crop_code?: string;
  };
}): Promise<{ ok: true; item: SkillRuleSwitch }> {
  return requestJson<{ ok: true; item: SkillRuleSwitch }>("/api/v1/skills/rules/switch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
