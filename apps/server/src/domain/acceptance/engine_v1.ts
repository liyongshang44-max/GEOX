import { buildGeoMetrics } from "./rules/geo.js";
import type { AcceptanceEvaluationOutput } from "./rules/types.js";
import { acceptanceSkillRegistryV1 } from "./skills.js";
import { evidencePolicyFromReceiptV1 } from "../evidence/formal_evidence_policy_v1.js";

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
  const completeCount = valid.filter((z: any) => ["APPLIED", "PARTIAL"].includes(String(z?.status ?? "").trim().toUpperCase())).length;
  const avgCoverage = valid.reduce((acc: number, z: any) => acc + Number(z?.coverage_percent ?? 0), 0) / valid.length;
  const maxDev = valid.reduce((acc: number, z: any) => {
    const planned = Number(z?.planned_amount);
    const applied = Number(z?.applied_amount);
    const dev = Math.abs(((applied - planned) / planned) * 100);
    return Math.max(acc, Number.isFinite(dev) ? dev : 0);
  }, 0);
  return { zone_application_count: zones.length, zone_completion_rate: completeCount / zones.length, avg_zone_coverage_percent: avgCoverage, max_zone_deviation_percent: maxDev };
}

function hasExecutionWindow(receipt: Record<string, any>): boolean {
  const payload = receipt?.payload ?? {};
  const executionTime = payload.execution_time ?? payload.meta?.execution_time ?? {};
  const start = Number(executionTime.start_ts ?? payload.execution_started_at ?? NaN);
  const end = Number(executionTime.end_ts ?? payload.execution_finished_at ?? NaN);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function hasDevMarker(receipt: Record<string, any>): boolean {
  const raw = JSON.stringify(receipt ?? "").toLowerCase();
  return raw.includes("flight-table") || raw.includes("flight_table") || raw.includes("irrigation_simulator") || raw.includes("simulated_dev_only") || raw.includes("sim_trace");
}

function variableZoneEvidencePassed(receipt: Record<string, any>): boolean {
  const variableExecution = receipt?.payload?.meta?.variable_execution;
  const mode = String(variableExecution?.mode ?? "").trim().toUpperCase();
  const zones = Array.isArray(variableExecution?.zone_applications) ? variableExecution.zone_applications : [];
  return mode === "VARIABLE_BY_ZONE" && zones.length > 0 && zones.every((z: any) => {
    const status = String(z?.status ?? "").trim().toUpperCase();
    return String(z?.zone_id ?? "").trim() && (status === "APPLIED" || status === "PARTIAL");
  });
}

export function evaluateAcceptanceV1(input: EvaluateInput): AcceptanceEvaluationOutput {
  const skill = selectAcceptanceSkillV1(input);
  const result = skill?.run({ receipt: input.receipt ?? {}, water_flow_state: input.water_flow_state ?? null, fertility_state: input.fertility_state ?? null, sensor_quality_state: input.sensor_quality_state ?? null });
  const geo = buildGeoMetrics(input.telemetry ?? {});
  const evidencePolicy = evidencePolicyFromReceiptV1(input.receipt ?? {});
  const formalExecutionPassed = hasExecutionWindow(input.receipt ?? {});
  const nonDevChain = !hasDevMarker(input.receipt ?? {}) && evidencePolicy.simulated_artifact_count === 0;
  const variableEvidencePassed = variableZoneEvidencePassed(input.receipt ?? {});
  const formalGatePassed = (evidencePolicy.formal_evidence_passed || variableEvidencePassed) && formalExecutionPassed && nonDevChain;
  const skillResult: AcceptanceEvaluationOutput["result"] = result?.verdict === "PASS" ? "PASSED" : result?.verdict === "FAIL" ? "FAILED" : "INCONCLUSIVE";
  const outputResult: AcceptanceEvaluationOutput["result"] = skillResult === "PASSED" && !formalGatePassed ? "INCONCLUSIVE" : skillResult;
  const gateCodes = formalGatePassed ? ["FORMAL_ACCEPTANCE_GATE_PASSED"] : [
    ...(!evidencePolicy.formal_evidence_passed && !variableEvidencePassed ? ["FORMAL_EVIDENCE_MISSING"] : []),
    ...(!formalExecutionPassed ? ["FORMAL_EXECUTION_WINDOW_MISSING"] : []),
    ...(!nonDevChain ? ["DEV_CHAIN_NOT_FORMAL"] : []),
    ...evidencePolicy.blocking_reasons,
  ];

  return {
    result: outputResult,
    score: outputResult === "PASSED" ? 1 : outputResult === "FAILED" ? 0 : undefined,
    metrics: {
      track_point_count: geo.trackPointCount,
      track_points_in_field: geo.inFieldCount,
      in_field_ratio: geo.inFieldRatio,
      formal_evidence_count: evidencePolicy.formal_artifact_count + (variableEvidencePassed ? 1 : 0),
      simulated_evidence_count: evidencePolicy.simulated_artifact_count,
      formal_execution_passed: formalExecutionPassed ? 1 : 0,
      non_simulated_chain: nonDevChain ? 1 : 0,
      ...buildVariableMetrics(input.receipt ?? {}),
    },
    rule_id: skill ? `${skill.skill_id}` : "acceptance_manual_fallback_v1",
    explanation_codes: Array.from(new Set([...(result?.explanation_codes ?? ["ACCEPTANCE_SKILL_NOT_FOUND"]), ...gateCodes])),
    acceptance_skill_id: skill?.skill_id ?? "acceptance_manual_fallback_v1",
    acceptance_skill_version: skill?.version ?? "v1",
  };
}
