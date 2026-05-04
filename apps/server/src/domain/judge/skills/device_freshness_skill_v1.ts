import { buildJudgeSkillTraceV1 } from "./judge_skill_trace_v1";

type DeviceFreshnessVerdict = "PASS" | "STALE_DATA" | "DEVICE_OFFLINE";

export type DeviceFreshnessSkillV1Input = {
  observation_age_minutes: number;
  heartbeat_age_minutes: number;
};

export type DeviceFreshnessSkillV1Output = {
  verdict: DeviceFreshnessVerdict;
  reasons: string[];
};

export function runDeviceFreshnessSkillV1(input: DeviceFreshnessSkillV1Input) {
  let output: DeviceFreshnessSkillV1Output;

  if (input.observation_age_minutes > 10) {
    output = { verdict: "STALE_DATA", reasons: ["observation_too_old"] };
  } else if (input.heartbeat_age_minutes > 5) {
    output = { verdict: "DEVICE_OFFLINE", reasons: ["heartbeat_timeout"] };
  } else {
    output = { verdict: "PASS", reasons: ["telemetry_freshness_pass"] };
  }

  const trace = buildJudgeSkillTraceV1({
    skill_id: "device_freshness_skill_v1",
    skill_version: "v1",
    skill_category: "sensing",
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
