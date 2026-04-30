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

function selectAcceptanceSkillV1(input: EvaluateInput) {
  const action_type = String(input.action_type ?? "").trim().toUpperCase();
  const variableMode = String(input.receipt?.payload?.meta?.variable_execution?.mode ?? "").trim().toUpperCase();

  if (action_type === "IRRIGATE") {
    if (variableMode === "VARIABLE_BY_ZONE") {
      return acceptanceSkillRegistryV1.find((s) => s.skill_id === "variable_irrigation_acceptance_v1") ?? null;
    }

    return acceptanceSkillRegistryV1.find((s) => s.skill_id === "irrigation_acceptance_v1") ?? null;
  }

  return acceptanceSkillRegistryV1.find((s) => s.action_type === action_type) ?? null;
}

function buildVariableMetrics(receipt: Record<string, any>): Record<string, any> {
  const variableExecution = receipt?.payload?.meta?.variable_execution;
  const zones = Array.isArray(variableExecution?.zone_applications) ? variableExecution.zone_applications : [];
  if (!zones.length) return {};

  const valid = zones.filter((z: any) => Number.isFinite(Number(z?.planned_amount)) && Number(z?.planned_amount) > 0);
  if (!valid.length) return { zone_application_count: zones.length, zone_completion_rate: 0 };

  const completeCount = valid.filter((z: any) => {
    const st = String(z?.status ?? "").trim().toUpperCase();
    return st === "APPLIED" || st === "PARTIAL";
  }).length;

  const avgCoverage = valid.reduce((acc: number, z: any) => acc + Number(z?.coverage_percent ?? 0), 0) / valid.length;

  const maxDev = valid.reduce((acc: number, z: any) => {
    const planned = Number(z?.planned_amount);
    const applied = Number(z?.applied_amount);
    const dev = Math.abs(((applied - planned) / planned) * 100);
    return Math.max(acc, Number.isFinite(dev) ? dev : 0);
  }, 0);

  return {
    zone_application_count: zones.length,
    zone_completion_rate: completeCount / zones.length,
    avg_zone_coverage_percent: avgCoverage,
    max_zone_deviation_percent: maxDev,
  };
}

export function evaluateAcceptanceV1(input: EvaluateInput): AcceptanceEvaluationOutput {
  const skill = selectAcceptanceSkillV1(input);

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
      ...buildVariableMetrics(input.receipt ?? {}),
    },
    rule_id: skill ? `${skill.skill_id}` : "acceptance_manual_fallback_v1",
    explanation_codes: result?.explanation_codes ?? ["ACCEPTANCE_SKILL_NOT_FOUND"],
    acceptance_skill_id: skill?.skill_id ?? "acceptance_manual_fallback_v1",
    acceptance_skill_version: skill?.version ?? "v1",
  };
}