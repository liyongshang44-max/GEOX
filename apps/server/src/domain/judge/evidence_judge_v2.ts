import { runDeviceFreshnessSkillV1 } from "./skills/device_freshness_skill_v1.js";
import { runSoilMoistureQualitySkillV1 } from "./skills/soil_moisture_quality_skill_v1.js";
import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

export type EvidenceJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id?: string | null;
  device_id?: string | null;
  soil_moisture?: number | null;
  observed_at_ts_ms?: number | null;
  now_ts_ms?: number | null;
  last_heartbeat_ts_ms?: number | null;
  last_telemetry_ts_ms?: number | null;
  evidence_refs?: unknown[];
};

function mapSeverity(verdict: string): JudgeResultV2CreateInput["severity"] {
  if (verdict === "DEVICE_OFFLINE") return "CRITICAL";
  if (verdict === "SENSOR_DRIFT" || verdict === "STALE_DATA") return "HIGH";
  if (verdict === "INSUFFICIENT_EVIDENCE") return "MEDIUM";
  return "LOW";
}

export function evaluateEvidenceJudgeV2(input: EvidenceJudgeEvaluateInput): JudgeResultV2CreateInput {
  const nowTs = Number.isFinite(Number(input.now_ts_ms)) ? Number(input.now_ts_ms) : Date.now();
  const observedAtTs = Number(input.observed_at_ts_ms);
  const heartbeatTs = Number(input.last_heartbeat_ts_ms);

  const observationAgeMinutes = Number.isFinite(observedAtTs) ? (nowTs - observedAtTs) / 60000 : Number.POSITIVE_INFINITY;
  const heartbeatAgeMinutes = Number.isFinite(heartbeatTs) ? (nowTs - heartbeatTs) / 60000 : Number.POSITIVE_INFINITY;

  const soil = runSoilMoistureQualitySkillV1({
    soil_moisture: input.soil_moisture,
  });

  const freshness = runDeviceFreshnessSkillV1({
    observation_age_minutes: observationAgeMinutes,
    heartbeat_age_minutes: heartbeatAgeMinutes,
  });

  const selected =
    soil.output.verdict !== "PASS" ? soil : freshness.output.verdict !== "PASS" ? freshness : null;

  const verdict = selected?.output.verdict ?? "PASS";
  const reasons = selected?.output.reasons ?? ["evidence_guard_pass"];

  return {
    judge_kind: "EVIDENCE",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    verdict,
    severity: mapSeverity(verdict),
    reasons,
    inputs: {
      soil_moisture: input.soil_moisture ?? null,
      observed_at_ts_ms: Number.isFinite(observedAtTs) ? observedAtTs : null,
      now_ts_ms: nowTs,
      last_heartbeat_ts_ms: Number.isFinite(heartbeatTs) ? heartbeatTs : null,
      last_telemetry_ts_ms: Number.isFinite(Number(input.last_telemetry_ts_ms))
        ? Number(input.last_telemetry_ts_ms)
        : null,
    },
    outputs: {
      skill_traces: [
        {
          skill_id: soil.trace.skill_id,
          trace_id: soil.trace.trace_id,
          run_id: soil.trace.run_id,
          skill_version: soil.trace.skill_version,
          skill_category: soil.trace.skill_category,
          verdict: soil.output.verdict,
          reasons: soil.output.reasons,
        },
        {
          skill_id: freshness.trace.skill_id,
          trace_id: freshness.trace.trace_id,
          run_id: freshness.trace.run_id,
          skill_version: freshness.trace.skill_version,
          skill_category: freshness.trace.skill_category,
          verdict: freshness.output.verdict,
          reasons: freshness.output.reasons,
        },
      ],
    },
    confidence: selected?.trace.confidence ?? {
      level: "HIGH",
      basis: "measured",
      reasons: ["soil_moisture_and_freshness_checks_passed"],
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: [
      {
        skill_id: soil.trace.skill_id,
        skill_version: soil.trace.skill_version,
        trace_id: soil.trace.trace_id,
        run_id: soil.trace.run_id,
        input_digest: soil.trace.input_digest,
        inputs: soil.trace.inputs,
        outputs: soil.trace.outputs,
        confidence: soil.trace.confidence,
        evidence_refs: soil.trace.evidence_refs,
      },
      {
        skill_id: freshness.trace.skill_id,
        skill_version: freshness.trace.skill_version,
        trace_id: freshness.trace.trace_id,
        run_id: freshness.trace.run_id,
        input_digest: freshness.trace.input_digest,
        inputs: freshness.trace.inputs,
        outputs: freshness.trace.outputs,
        confidence: freshness.trace.confidence,
        evidence_refs: freshness.trace.evidence_refs,
      },
    ],
  };
}
