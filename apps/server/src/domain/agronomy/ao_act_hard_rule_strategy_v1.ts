export type HardRuleScopeV1 = {
  tenant_id: string;
  project_id: string;
};

export type HardRuleSourceV1 = "request_constraints" | "field_fertility_state_v1";

export type HardRuleActionHintV1 = "irrigate_first" | "inspect";

export type HardRulePrecheckResultV1 = {
  matched: boolean;
  reason_codes: string[];
  action_hints: HardRuleActionHintV1[];
  reason_details: Array<{
    code: "hard_rule_precheck_required";
    rule_key: "moisture_constraint_dry" | "salinity_risk_high";
    action_hint: HardRuleActionHintV1;
    source: HardRuleSourceV1;
  }>;
};

export type HardRuleThresholdsV1 = {
  moisture_constraint_dry_value?: string;
  salinity_risk_high_value?: string;
};

export type HardRulePolicyEntryV1 = {
  tenant_id?: string;
  project_id?: string;
  thresholds?: HardRuleThresholdsV1;
};

const DEFAULT_THRESHOLDS_V1: Required<HardRuleThresholdsV1> = {
  moisture_constraint_dry_value: "dry",
  salinity_risk_high_value: "high",
};

const DEFAULT_POLICY_ENTRIES_V1: HardRulePolicyEntryV1[] = [
  { tenant_id: "*", project_id: "*", thresholds: DEFAULT_THRESHOLDS_V1 },
];

let runtimePolicyEntriesV1: HardRulePolicyEntryV1[] = DEFAULT_POLICY_ENTRIES_V1.map((x) => ({ ...x, thresholds: { ...DEFAULT_THRESHOLDS_V1, ...(x.thresholds ?? {}) } }));
let runtimeLoadedFromEnvV1 = false;

function normalizeText(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function parseEnvPolicyV1(raw: string): HardRulePolicyEntryV1[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("AO_ACT_HARD_RULE_POLICY_V1 must be a JSON array");
  return parsed.map((entry: any) => ({
    tenant_id: entry?.tenant_id == null ? undefined : String(entry.tenant_id),
    project_id: entry?.project_id == null ? undefined : String(entry.project_id),
    thresholds: {
      moisture_constraint_dry_value: entry?.thresholds?.moisture_constraint_dry_value == null ? undefined : String(entry.thresholds.moisture_constraint_dry_value),
      salinity_risk_high_value: entry?.thresholds?.salinity_risk_high_value == null ? undefined : String(entry.thresholds.salinity_risk_high_value),
    },
  }));
}

function ensureEnvPolicyLoadedV1(): void {
  if (runtimeLoadedFromEnvV1) return;
  runtimeLoadedFromEnvV1 = true;
  const raw = String(process.env.AO_ACT_HARD_RULE_POLICY_V1 ?? "").trim();
  if (!raw) return;
  try {
    setHardRulePolicyEntriesV1(parseEnvPolicyV1(raw));
  } catch {
    runtimePolicyEntriesV1 = DEFAULT_POLICY_ENTRIES_V1.map((x) => ({ ...x, thresholds: { ...DEFAULT_THRESHOLDS_V1, ...(x.thresholds ?? {}) } }));
  }
}

function entryWeight(entry: HardRulePolicyEntryV1): number {
  const tenantScore = entry.tenant_id && entry.tenant_id !== "*" ? 2 : 0;
  const projectScore = entry.project_id && entry.project_id !== "*" ? 1 : 0;
  return tenantScore + projectScore;
}

function matchEntry(entry: HardRulePolicyEntryV1, scope: HardRuleScopeV1): boolean {
  const tenantOk = !entry.tenant_id || entry.tenant_id === "*" || entry.tenant_id === scope.tenant_id;
  const projectOk = !entry.project_id || entry.project_id === "*" || entry.project_id === scope.project_id;
  return tenantOk && projectOk;
}

function resolveThresholdsV1(scope: HardRuleScopeV1): Required<HardRuleThresholdsV1> {
  ensureEnvPolicyLoadedV1();
  const matched = runtimePolicyEntriesV1
    .filter((entry) => matchEntry(entry, scope))
    .sort((a, b) => entryWeight(b) - entryWeight(a))[0];
  return {
    moisture_constraint_dry_value: normalizeText(matched?.thresholds?.moisture_constraint_dry_value ?? DEFAULT_THRESHOLDS_V1.moisture_constraint_dry_value),
    salinity_risk_high_value: normalizeText(matched?.thresholds?.salinity_risk_high_value ?? DEFAULT_THRESHOLDS_V1.salinity_risk_high_value),
  };
}

export function setHardRulePolicyEntriesV1(entries: HardRulePolicyEntryV1[]): void {
  runtimePolicyEntriesV1 = (Array.isArray(entries) && entries.length ? entries : DEFAULT_POLICY_ENTRIES_V1).map((entry) => ({
    tenant_id: entry.tenant_id,
    project_id: entry.project_id,
    thresholds: {
      moisture_constraint_dry_value: normalizeText(entry.thresholds?.moisture_constraint_dry_value ?? DEFAULT_THRESHOLDS_V1.moisture_constraint_dry_value),
      salinity_risk_high_value: normalizeText(entry.thresholds?.salinity_risk_high_value ?? DEFAULT_THRESHOLDS_V1.salinity_risk_high_value),
    },
  }));
}

export function resetHardRulePolicyEntriesV1(): void {
  runtimePolicyEntriesV1 = DEFAULT_POLICY_ENTRIES_V1.map((x) => ({ ...x, thresholds: { ...DEFAULT_THRESHOLDS_V1, ...(x.thresholds ?? {}) } }));
  runtimeLoadedFromEnvV1 = false;
}

export function evaluateAoActHardRulePrecheckV1(input: {
  scope: HardRuleScopeV1;
  constraints: Record<string, unknown>;
  source?: HardRuleSourceV1;
}): HardRulePrecheckResultV1 {
  const source = input.source ?? "request_constraints";
  const thresholds = resolveThresholdsV1(input.scope);
  const moistureConstraint = normalizeText(input.constraints?.moisture_constraint);
  const salinityRisk = normalizeText(input.constraints?.salinity_risk);

  const action_hints: HardRuleActionHintV1[] = [];
  const reason_details: HardRulePrecheckResultV1["reason_details"] = [];

  // 冻结：仅维护两条硬分流规则，防止策略数量扩展导致 P1 膨胀。
  if (moistureConstraint === thresholds.moisture_constraint_dry_value) {
    action_hints.push("irrigate_first");
    reason_details.push({
      code: "hard_rule_precheck_required",
      rule_key: "moisture_constraint_dry",
      action_hint: "irrigate_first",
      source,
    });
  }

  if (salinityRisk === thresholds.salinity_risk_high_value) {
    action_hints.push("inspect");
    reason_details.push({
      code: "hard_rule_precheck_required",
      rule_key: "salinity_risk_high",
      action_hint: "inspect",
      source,
    });
  }

  return {
    matched: reason_details.length > 0,
    reason_codes: reason_details.length > 0 ? ["hard_rule_precheck_required"] : [],
    action_hints,
    reason_details,
  };
}
