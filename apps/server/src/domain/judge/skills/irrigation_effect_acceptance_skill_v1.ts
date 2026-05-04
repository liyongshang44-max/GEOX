import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type IrrigationEffectAcceptanceVerdict = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

export type IrrigationEffectAcceptanceSkillV1Input = {
  delta: number | null | undefined;
};

export type IrrigationEffectAcceptanceSkillV1Output = {
  verdict: IrrigationEffectAcceptanceVerdict;
  reasons: string[];
};

export function runIrrigationEffectAcceptanceSkillV1(input: IrrigationEffectAcceptanceSkillV1Input) {
  const delta = input.delta;

  let output: IrrigationEffectAcceptanceSkillV1Output;

  if (delta == null) {
    output = { verdict: "INSUFFICIENT_EVIDENCE", reasons: ["missing_soil_moisture_delta"] };
  } else if (delta >= 0.03) {
    output = { verdict: "PASS", reasons: ["soil_moisture_delta_reached"] };
  } else {
    output = { verdict: "FAIL", reasons: ["soil_moisture_delta_not_reached"] };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "irrigation_effect_acceptance_skill_v1",
    skill_version: "v1",
    skill_category: "acceptance",
    inputs: { delta },
    outputs: output,
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["Direct threshold check on irrigation effect delta."],
    },
  });

  return { output, trace };
}
