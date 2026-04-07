import { evaluateAgronomy } from "./agronomy/agronomy_engine";
import { getCropProfile } from "./agronomy/crop_catalog";

export type DecisionEngineInputV1 = {
  crop_code: string;
  soil_moisture: number;
  canopy_temp: number;
  stress_score: number;
};

export type IrrigationDecisionV1 = {
  should_irrigate: boolean;
  reason_codes: string[];
  moisture_threshold: number | null;
  crop_name: string | null;
};

export type HardRuleActionHintV1 = "irrigate_first" | "inspect";

export type HardRuleMatchV1 = {
  action_hint: HardRuleActionHintV1;
  reason_code: string;
  source: "request_constraints" | "field_fertility_state_v1";
};

export type HardRuleRecommendationBlueprintV1 = {
  action_hint: HardRuleActionHintV1;
  rule_id: string;
  recommendation_type: "irrigation_recommendation_v1" | "crop_health_alert_v1";
  reason_codes_suffix: string[];
  evidence_refs: string[];
  confidence: number;
  suggested_action: {
    action_type: string;
    summary: string;
    parameters: Record<string, unknown>;
  };
  expected_effect: Record<string, number> | null;
};

type HardRulePolicyConfigItemV1 = {
  when: (input: { moistureConstraint: string; salinityRisk: string; }) => boolean;
  match: Omit<HardRuleMatchV1, "source">;
  blueprint: HardRuleRecommendationBlueprintV1;
};

const HARD_RULE_POLICY_CONFIG_V1: HardRulePolicyConfigItemV1[] = [
  {
    when: ({ moistureConstraint }) => moistureConstraint === "dry",
    match: {
      action_hint: "irrigate_first",
      reason_code: "hard_rule_moisture_constraint_dry",
    },
    blueprint: {
      action_hint: "irrigate_first",
      rule_id: "hard_rule_moisture_constraint_dry_v1",
      recommendation_type: "irrigation_recommendation_v1",
      reason_codes_suffix: ["irrigate_first"],
      evidence_refs: ["constraint:moisture_constraint"],
      confidence: 0.95,
      expected_effect: { soil_moisture: 8 },
      suggested_action: {
        action_type: "irrigation.start",
        summary: "命中硬规则 moisture_constraint=dry，建议优先灌溉。",
        parameters: {
          trigger: { moisture_constraint: "dry" },
          priority: "high"
        }
      }
    }
  },
  {
    when: ({ salinityRisk }) => salinityRisk === "high",
    match: {
      action_hint: "inspect",
      reason_code: "hard_rule_salinity_risk_high",
    },
    blueprint: {
      action_hint: "inspect",
      rule_id: "hard_rule_salinity_risk_high_v1",
      recommendation_type: "crop_health_alert_v1",
      reason_codes_suffix: ["inspect"],
      evidence_refs: ["constraint:salinity_risk"],
      confidence: 0.95,
      expected_effect: null,
      suggested_action: {
        action_type: "inspection.start",
        summary: "命中硬规则 salinity_risk=high，建议先人工巡检。",
        parameters: {
          trigger: { salinity_risk: "high" },
          priority: "high"
        }
      }
    }
  }
];

export function evaluateHardRuleHintsV1(input: {
  moisture_constraint?: string | null;
  salinity_risk?: string | null;
  source?: "request_constraints" | "field_fertility_state_v1";
}): HardRuleMatchV1[] {
  const moistureConstraint = String(input.moisture_constraint ?? "").trim().toLowerCase();
  const salinityRisk = String(input.salinity_risk ?? "").trim().toLowerCase();
  const source = input.source ?? "request_constraints";

  return HARD_RULE_POLICY_CONFIG_V1
    .filter((entry) => entry.when({ moistureConstraint, salinityRisk }))
    .map((entry) => ({ ...entry.match, source }));
}

export function getHardRuleRecommendationBlueprintV1(actionHint: HardRuleActionHintV1): HardRuleRecommendationBlueprintV1 | null {
  const item = HARD_RULE_POLICY_CONFIG_V1.find((entry) => entry.blueprint.action_hint === actionHint);
  return item ? item.blueprint : null;
}

export function evaluateIrrigationDecisionV1(input: DecisionEngineInputV1): IrrigationDecisionV1 {
  const crop = getCropProfile(input.crop_code);
  const agronomy = evaluateAgronomy({
    crop_code: input.crop_code,
    soil_moisture: input.soil_moisture
  });

  const soilRuleMatched = agronomy.should_irrigate;
  const heatRuleMatched = Number.isFinite(input.canopy_temp) && input.canopy_temp >= 32 && input.stress_score >= 0.45;

  if (soilRuleMatched || heatRuleMatched) {
    return {
      should_irrigate: true,
      reason_codes: [agronomy.reason, heatRuleMatched ? "heat_stress_risk" : "soil_moisture_low_or_heat_stress"],
      moisture_threshold: crop?.stages[0]?.soil_moisture_min ?? null,
      crop_name: crop?.code ?? null
    };
  }

  return {
    should_irrigate: false,
    reason_codes: [agronomy.reason],
    moisture_threshold: crop?.stages[0]?.soil_moisture_min ?? null,
    crop_name: crop?.code ?? null
  };
}
