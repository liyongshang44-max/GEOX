import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type IrrigationEffectAcceptanceCode = "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";

export type IrrigationEffectAcceptanceSkillV1Input = {
  delta: number | null | undefined;
};

export type IrrigationEffectAcceptanceSkillV1Output = {
  code: IrrigationEffectAcceptanceCode;
  reason: string;
};

export function runIrrigationEffectAcceptanceSkillV1(input: IrrigationEffectAcceptanceSkillV1Input) {
  const delta = input.delta;

  let output: IrrigationEffectAcceptanceSkillV1Output;

  if (delta == null) {
    output = {
      code: "INSUFFICIENT_EVIDENCE",
      reason: "delta is missing",
    };
  } else if (delta >= 0.03) {
    output = {
      code: "PASS",
      reason: "delta meets acceptance threshold (>= 0.03)",
    };
  } else {
    output = {
      code: "FAIL",
      reason: "delta is below acceptance threshold (< 0.03)",
    };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "irrigation_effect_acceptance_skill_v1",
    skill_version: "v1",
    skill_category: "ACCEPTANCE",
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
