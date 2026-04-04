export type SkillScope = {
  tenant_id?: string;
  crop_code?: string;
};

export type SkillSwitch = {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority: number;
  scope?: SkillScope;
};

const defaultSkillSwitches: SkillSwitch[] = [
  { skill_id: "corn_water_balance", version: "v1", enabled: true, priority: 10, scope: { crop_code: "corn" } },
  { skill_id: "corn_water_balance", version: "v2", enabled: true, priority: 20, scope: { crop_code: "corn" } },
  { skill_id: "tomato_fertilize", version: "v1", enabled: true, priority: 10, scope: { crop_code: "tomato" } },
];

export let skillSwitches: SkillSwitch[] = defaultSkillSwitches.map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));

function sameScope(a?: SkillScope, b?: SkillScope): boolean {
  return (a?.tenant_id ?? "") === (b?.tenant_id ?? "")
    && (a?.crop_code ?? "") === (b?.crop_code ?? "");
}

export function listSkillSwitches(input?: {
  crop_code?: string;
  tenant_id?: string;
  enabled_only?: boolean;
}): SkillSwitch[] {
  const crop_code = input?.crop_code;
  const tenant_id = input?.tenant_id;
  const enabledOnly = input?.enabled_only ?? false;

  return skillSwitches
    .filter((s) => !enabledOnly || s.enabled)
    .filter((s) => !crop_code || !s.scope?.crop_code || s.scope.crop_code === crop_code)
    .filter((s) => !tenant_id || !s.scope?.tenant_id || s.scope.tenant_id === tenant_id)
    .map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));
}

export function switchSkill(input: {
  skill_id: string;
  version: string;
  enabled: boolean;
  priority?: number;
  scope?: SkillScope;
}): SkillSwitch {
  const idx = skillSwitches.findIndex((s) =>
    s.skill_id === input.skill_id
    && s.version === input.version
    && sameScope(s.scope, input.scope)
  );

  if (idx >= 0) {
    const current = skillSwitches[idx];
    const next: SkillSwitch = {
      ...current,
      enabled: input.enabled,
      priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : current.priority,
      scope: input.scope ? { ...input.scope } : current.scope,
    };
    skillSwitches[idx] = next;
    return { ...next, scope: next.scope ? { ...next.scope } : undefined };
  }

  const created: SkillSwitch = {
    skill_id: input.skill_id,
    version: input.version,
    enabled: input.enabled,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    scope: input.scope ? { ...input.scope } : undefined,
  };
  skillSwitches.push(created);
  return { ...created, scope: created.scope ? { ...created.scope } : undefined };
}

export function resetSkillSwitches(): void {
  skillSwitches = defaultSkillSwitches.map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));
}
