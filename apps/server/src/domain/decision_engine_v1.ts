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
