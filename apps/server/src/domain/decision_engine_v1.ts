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

export function evaluateHardRuleHintsV1(input: {
  moisture_constraint?: string | null;
  salinity_risk?: string | null;
  source?: "request_constraints" | "field_fertility_state_v1";
}): HardRuleMatchV1[] {
  const moistureConstraint = String(input.moisture_constraint ?? "").trim().toLowerCase();
  const salinityRisk = String(input.salinity_risk ?? "").trim().toLowerCase();
  const source = input.source ?? "request_constraints";
  const out: HardRuleMatchV1[] = [];

  if (moistureConstraint === "dry") {
    out.push({
      action_hint: "irrigate_first",
      reason_code: "hard_rule_moisture_constraint_dry",
      source
    });
  }
  if (salinityRisk === "high") {
    out.push({
      action_hint: "inspect",
      reason_code: "hard_rule_salinity_risk_high",
      source
    });
  }

  return out;
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
