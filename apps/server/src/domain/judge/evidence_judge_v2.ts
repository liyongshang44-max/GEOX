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

export function evaluateEvidenceJudgeV2(input: EvidenceJudgeEvaluateInput): JudgeResultV2CreateInput {
  const nowTs = Number(input.now_ts_ms ?? Date.now());
  const observedAt = Number(input.observed_at_ts_ms);
  const soilMoisture = Number(input.soil_moisture);
  const heartbeatTs = Number(input.last_heartbeat_ts_ms);
  const telemetryTs = Number(input.last_telemetry_ts_ms);
  const evidenceRefs = Array.isArray(input.evidence_refs) ? input.evidence_refs : [];

  if (!Number.isFinite(soilMoisture)) {
    return {
      judge_kind: "EVIDENCE",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "MEDIUM",
      reasons: ["soil_moisture_missing"],
      inputs: {
        soil_moisture: null,
        observed_at_ts_ms: Number.isFinite(observedAt) ? observedAt : null,
        now_ts_ms: Number.isFinite(nowTs) ? nowTs : Date.now(),
      },
      outputs: { stale_data: false, device_offline: false, sensor_drift: false },
      confidence: { level: "LOW", basis: "assumed", reasons: ["soil_moisture_required"] },
      evidence_refs: evidenceRefs,
      source_refs: [],
    };
  }

  if (soilMoisture < 0 || soilMoisture > 1.2) {
    return {
      judge_kind: "EVIDENCE",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      verdict: "SENSOR_DRIFT",
      severity: "HIGH",
      reasons: ["soil_moisture_out_of_range"],
      inputs: {
        soil_moisture: soilMoisture,
        observed_at_ts_ms: Number.isFinite(observedAt) ? observedAt : null,
        now_ts_ms: Number.isFinite(nowTs) ? nowTs : Date.now(),
      },
      outputs: { stale_data: false, device_offline: false, sensor_drift: true },
      confidence: { level: "MEDIUM", basis: "measured", reasons: ["value_range_rule"] },
      evidence_refs: evidenceRefs,
      source_refs: [],
    };
  }

  if (Number.isFinite(observedAt) && Number.isFinite(nowTs) && nowTs - observedAt > 10 * 60 * 1000) {
    return {
      judge_kind: "EVIDENCE",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      verdict: "STALE_DATA",
      severity: "HIGH",
      reasons: ["observation_too_old"],
      inputs: {
        soil_moisture: soilMoisture,
        observed_at_ts_ms: observedAt,
        now_ts_ms: nowTs,
      },
      outputs: { stale_data: true, device_offline: false, sensor_drift: false },
      confidence: { level: "HIGH", basis: "measured", reasons: ["timestamp_freshness_rule"] },
      evidence_refs: evidenceRefs,
      source_refs: [],
    };
  }

  if (Number.isFinite(heartbeatTs) && Number.isFinite(nowTs) && nowTs - heartbeatTs > 5 * 60 * 1000) {
    return {
      judge_kind: "EVIDENCE",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      verdict: "DEVICE_OFFLINE",
      severity: "CRITICAL",
      reasons: ["heartbeat_timeout"],
      inputs: {
        soil_moisture: soilMoisture,
        observed_at_ts_ms: Number.isFinite(observedAt) ? observedAt : null,
        now_ts_ms: nowTs,
        last_heartbeat_ts_ms: heartbeatTs,
      },
      outputs: { stale_data: false, device_offline: true, sensor_drift: false },
      confidence: { level: "HIGH", basis: "measured", reasons: ["heartbeat_freshness_rule"] },
      evidence_refs: evidenceRefs,
      source_refs: [],
    };
  }

  return {
    judge_kind: "EVIDENCE",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    verdict: "PASS",
    severity: "LOW",
    reasons: ["evidence_guard_pass"],
    inputs: {
      soil_moisture: soilMoisture,
      observed_at_ts_ms: Number.isFinite(observedAt) ? observedAt : null,
      now_ts_ms: Number.isFinite(nowTs) ? nowTs : Date.now(),
      last_heartbeat_ts_ms: Number.isFinite(heartbeatTs) ? heartbeatTs : null,
      last_telemetry_ts_ms: Number.isFinite(telemetryTs) ? telemetryTs : null,
    },
    outputs: {
      stale_data: false,
      device_offline: false,
      sensor_drift: false,
    },
    confidence: {
      level: "HIGH",
      basis: "measured",
      reasons: ["soil_moisture_and_freshness_checks_passed"],
    },
    evidence_refs: evidenceRefs,
    source_refs: [],
  };
}
