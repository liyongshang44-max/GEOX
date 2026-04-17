import { buildGeoMetrics } from "./rules/geo.js";
import type { AcceptanceEvaluationOutput } from "./rules/types.js";
import { acceptanceSkillRegistryV1 } from "./skills.js";

type EvaluateInput = {
  action_type: string;
  parameters: Record<string, any>;
  telemetry: Record<string, any>;
  receipt: Record<string, any>;
  water_flow_state?: Record<string, any> | null;
  fertility_state?: Record<string, any> | null;
  sensor_quality_state?: Record<string, any> | null;
  acceptance_policy_ref: string | null;
};

export function evaluateAcceptanceV1(input: EvaluateInput): AcceptanceEvaluationOutput {
  const action_type = String(input.action_type ?? "").trim().toUpperCase();
  const skill = acceptanceSkillRegistryV1.find((s) => s.action_type === action_type) ?? null;
  const result = skill?.run({
    receipt: input.receipt ?? {},
    water_flow_state: input.water_flow_state ?? null,
    fertility_state: input.fertility_state ?? null,
    sensor_quality_state: input.sensor_quality_state ?? null,
  });

  const geo = buildGeoMetrics(input.telemetry ?? {});
  const outputResult: AcceptanceEvaluationOutput["result"] =
    result?.verdict === "PASS" ? "PASSED" : result?.verdict === "FAIL" ? "FAILED" : "INCONCLUSIVE";

  return {
    result: outputResult,
    score: outputResult === "PASSED" ? 1 : outputResult === "FAILED" ? 0 : undefined,
    metrics: {
      track_point_count: geo.trackPointCount,
      track_points_in_field: geo.inFieldCount,
      in_field_ratio: geo.inFieldRatio,
    },
    rule_id: skill ? `${skill.skill_id}` : "acceptance_manual_fallback_v1",
    explanation_codes: result?.explanation_codes ?? ["ACCEPTANCE_SKILL_NOT_FOUND"],
    acceptance_skill_id: skill?.skill_id ?? "acceptance_manual_fallback_v1",
    acceptance_skill_version: skill?.version ?? "v1",
  };
}
