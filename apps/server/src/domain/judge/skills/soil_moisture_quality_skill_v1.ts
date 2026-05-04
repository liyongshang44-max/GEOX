import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type SoilMoistureQualityCode = "PASS" | "INSUFFICIENT_EVIDENCE" | "SENSOR_DRIFT";

export type SoilMoistureQualitySkillV1Input = {
  soil_moisture: number | null | undefined;
};

export type SoilMoistureQualitySkillV1Output = {
  code: SoilMoistureQualityCode;
  reason: string;
};

export function runSoilMoistureQualitySkillV1(input: SoilMoistureQualitySkillV1Input) {
  const value = input.soil_moisture;

  let output: SoilMoistureQualitySkillV1Output;

  if (value == null) {
    output = {
      code: "INSUFFICIENT_EVIDENCE",
      reason: "soil_moisture is missing",
    };
  } else if (value < 0 || value > 1.2) {
    output = {
      code: "SENSOR_DRIFT",
      reason: "soil_moisture is out of expected range [0, 1.2]",
    };
  } else {
    output = {
      code: "PASS",
      reason: "soil_moisture is within expected range",
    };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "soil_moisture_quality_skill_v1",
    skill_version: "v1",
    skill_category: "EVIDENCE",
    inputs: { soil_moisture: value },
    outputs: output,
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["Direct threshold checks on sensor observation."],
    },
  });

  return { output, trace };
}
