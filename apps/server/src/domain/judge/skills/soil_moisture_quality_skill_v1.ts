import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type SoilMoistureQualityVerdict = "PASS" | "INSUFFICIENT_EVIDENCE" | "SENSOR_DRIFT";

export type SoilMoistureQualitySkillV1Input = {
  soil_moisture: number | null | undefined;
};

export type SoilMoistureQualitySkillV1Output = {
  verdict: SoilMoistureQualityVerdict;
  reasons: string[];
};

export function runSoilMoistureQualitySkillV1(input: SoilMoistureQualitySkillV1Input) {
  const value = input.soil_moisture;

  let output: SoilMoistureQualitySkillV1Output;

  if (value == null) {
    output = { verdict: "INSUFFICIENT_EVIDENCE", reasons: ["soil_moisture_missing"] };
  } else if (value < 0 || value > 1.2) {
    output = { verdict: "SENSOR_DRIFT", reasons: ["soil_moisture_out_of_range"] };
  } else {
    output = { verdict: "PASS", reasons: ["soil_moisture_in_expected_range"] };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "soil_moisture_quality_skill_v1",
    skill_version: "v1",
    skill_category: "sensing",
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
