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

const defaultFallbackSkillSwitches: SkillSwitch[] = [
  { skill_id: "corn_water_balance", version: "v1", enabled: true, priority: 10, scope: { crop_code: "corn" } },
  { skill_id: "corn_water_balance", version: "v2", enabled: true, priority: 20, scope: { crop_code: "corn" } },
  { skill_id: "tomato_fertilize", version: "v1", enabled: true, priority: 10, scope: { crop_code: "tomato" } },
];

let fallbackSkillSwitches: SkillSwitch[] = defaultFallbackSkillSwitches.map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));

function isLegacyAgronomyFallbackEnabled(): boolean {
  const raw = String(process.env.GEOX_ENABLE_AGRONOMY_SKILL_FALLBACK ?? "0").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

export function listFallbackSkillSwitches(input?: {
  crop_code?: string;
  tenant_id?: string;
  enabled_only?: boolean;
}): SkillSwitch[] {
  if (!isLegacyAgronomyFallbackEnabled()) return [];
  const crop_code = input?.crop_code;
  const tenant_id = input?.tenant_id;
  const enabledOnly = input?.enabled_only ?? false;

  return fallbackSkillSwitches
    .filter((s) => !enabledOnly || s.enabled)
    .filter((s) => !crop_code || !s.scope?.crop_code || s.scope.crop_code === crop_code)
    .filter((s) => !tenant_id || !s.scope?.tenant_id || s.scope.tenant_id === tenant_id)
    .map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));
}

export function getDefaultFallbackSkillSwitches(): SkillSwitch[] {
  return defaultFallbackSkillSwitches.map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));
}

export function resetFallbackSkillSwitches(): void {
  fallbackSkillSwitches = defaultFallbackSkillSwitches.map((s) => ({ ...s, scope: s.scope ? { ...s.scope } : undefined }));
}
