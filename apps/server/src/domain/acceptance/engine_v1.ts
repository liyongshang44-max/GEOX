// LEGACY acceptance bridge relying on agronomy/skills catalog.
// Frozen for compatibility; do not expand this into new runtime feature entrypoints.
import { acceptanceSkills } from "../agronomy/skills";
import { buildGeoMetrics } from "./rules/geo";
import type { AcceptanceEvaluationOutput } from "./rules/types";

type EvaluateInput = {
  action_type: string;
  parameters: Record<string, any>;
  telemetry: Record<string, any>;
  acceptance_policy_ref: string | null;
};

export function evaluateAcceptanceV1(input: EvaluateInput): AcceptanceEvaluationOutput {
  const action_type = String(input.action_type ?? "").trim().toUpperCase();
  const skill = acceptanceSkills.find((s) => s.action_type === action_type);
  const evidence = {
    ...input.telemetry,
    ...input.parameters,
    parameters: input.parameters ?? {},
    telemetry: input.telemetry ?? {},
    acceptance_policy_ref: input.acceptance_policy_ref ?? null,
  };
  const result = skill?.validate({ evidence });
  const geo = buildGeoMetrics(input.telemetry ?? {});
  const rule_id = skill ? `${skill.id}_${skill.version}` : "acceptance_manual_fallback_v1";
  const normalizedVerdict = result?.verdict ?? "PENDING";
  const outputResult: AcceptanceEvaluationOutput["result"] =
    normalizedVerdict === "PASS" ? "PASSED" : normalizedVerdict === "FAIL" ? "FAILED" : "INCONCLUSIVE";

  return {
    result: outputResult,
    score: outputResult === "PASSED" ? 1 : outputResult === "FAILED" ? 0 : undefined,
    metrics: {
      track_point_count: geo.trackPointCount,
      track_points_in_field: geo.inFieldCount,
      in_field_ratio: geo.inFieldRatio,
    },
    rule_id,
  };
}
