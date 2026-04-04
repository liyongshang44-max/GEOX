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

export const skillSwitches: SkillSwitch[] = [
  { skill_id: "corn_water_balance", version: "v1", enabled: true, priority: 10, scope: { crop_code: "corn" } },
  { skill_id: "corn_water_balance", version: "v2", enabled: true, priority: 20, scope: { crop_code: "corn" } },
  { skill_id: "tomato_fertilize", version: "v1", enabled: true, priority: 10, scope: { crop_code: "tomato" } },
];
