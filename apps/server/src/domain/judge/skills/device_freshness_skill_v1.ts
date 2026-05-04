import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type DeviceFreshnessCode = "PASS" | "STALE_DATA" | "DEVICE_OFFLINE";

export type DeviceFreshnessSkillV1Input = {
  observation_age_minutes: number;
  heartbeat_age_minutes: number;
};

export type DeviceFreshnessSkillV1Output = {
  code: DeviceFreshnessCode;
  reason: string;
};

export function runDeviceFreshnessSkillV1(input: DeviceFreshnessSkillV1Input) {
  let output: DeviceFreshnessSkillV1Output;

  if (input.observation_age_minutes > 10) {
    output = {
      code: "STALE_DATA",
      reason: "Observation age exceeds 10 minutes",
    };
  } else if (input.heartbeat_age_minutes > 5) {
    output = {
      code: "DEVICE_OFFLINE",
      reason: "Heartbeat age exceeds 5 minutes",
    };
  } else {
    output = {
      code: "PASS",
      reason: "Observation and heartbeat are fresh",
    };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "device_freshness_skill_v1",
    skill_version: "v1",
    skill_category: "SENSING",
    inputs: {
      observation_age_minutes: input.observation_age_minutes,
      heartbeat_age_minutes: input.heartbeat_age_minutes,
    },
    outputs: output,
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["Direct freshness checks on telemetry timestamps."],
    },
  });

  return { output, trace };
}
