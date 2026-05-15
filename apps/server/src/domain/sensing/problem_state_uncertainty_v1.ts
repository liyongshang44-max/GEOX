import type { Pool, PoolClient } from "pg";
import { createHash, randomUUID } from "node:crypto";

export type ProblemStateActionabilityV1 = "ACTIONABLE" | "NEEDS_EVIDENCE";
export type ProblemStateProblemScopeV1 = "field" | "management_zone" | "device" | "unknown";
export type ProblemStateLayerHintV1 = "sensing" | "agronomy" | "execution";
export type ProblemStateRateClassHintV1 = "acute" | "gradual" | "unknown";
export type UncertaintyConfidenceLevelV1 = "HIGH" | "MEDIUM" | "LOW";

export type ProblemStateV1 = {
  kind: "problem_state_v1";
  problem_state_id: string;
  subjectRef: {
    tenant_id: string;
    project_id: string | null;
    group_id: string | null;
    field_id: string;
    device_id: string | null;
  };
  window: {
    start_ts_ms: number;
    end_ts_ms: number;
  };
  problem_type: string;
  problem_scope: ProblemStateProblemScopeV1;
  state_layer_hint: ProblemStateLayerHintV1;
  rate_class_hint: ProblemStateRateClassHintV1;
  confidence: number;
  actionability: ProblemStateActionabilityV1;
  supporting_evidence_refs: string[];
  evidence_sufficiency_ref: string | null;
  time_coverage_ref: string | null;
  device_health_ref: string | null;
  conflict_detection_ref: string | null;
};

export type UncertaintyEnvelopeV1 = {
  kind: "uncertainty_envelope_v1";
  uncertainty_envelope_id: string;
  problem_state_ref: string;
  uncertainty_sources: string[];
  confidence_level: UncertaintyConfidenceLevelV1;
  missing_inputs: string[];
  conflicting_sources: string[];
  supporting_evidence_refs: string[];
};

type DbConn = Pool | PoolClient;

type BuildProblemStateParams = {
  tenant_id: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id: string;
  device_id?: string | null;
  stage1Summary: Record<string, any>;
};

function stableId(prefix: string, payload: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function asObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function evidenceRef(kind: string, id: string | null): string | null {
  return id ? `${kind}:${id}` : null;
}

function deriveProblemType(stage1Summary: Record<string, any>): string {
  const irrigationEffectiveness = String(stage1Summary.irrigation_effectiveness ?? "").trim().toLowerCase();
  const leakRisk = String(stage1Summary.leak_risk ?? "").trim().toLowerCase();
  if (irrigationEffectiveness === "low") return "irrigation_effectiveness_low";
  if (leakRisk === "high") return "leak_risk_high";
  return "stage1_sensing_anomaly";
}

function deriveRateClass(stage1Summary: Record<string, any>): ProblemStateRateClassHintV1 {
  const leakRisk = String(stage1Summary.leak_risk ?? "").trim().toLowerCase();
  if (leakRisk === "high") return "acute";
  const irrigationEffectiveness = String(stage1Summary.irrigation_effectiveness ?? "").trim().toLowerCase();
  if (irrigationEffectiveness === "low") return "gradual";
  return "unknown";
}

function deriveConfidence(stage1Summary: Record<string, any>): number {
  const summaryConfidence = toNumber(stage1Summary.confidence);
  if (summaryConfidence != null) return Math.max(0, Math.min(1, summaryConfidence));
  const coverage = asObj(stage1Summary.time_coverage_v1);
  const ratio = toNumber(coverage.coverage_ratio);
  return ratio == null ? 0 : Math.max(0, Math.min(1, ratio));
}

function deriveMissingInputs(stage1Summary: Record<string, any>): string[] {
  const out: string[] = [];
  if (!stage1Summary.evidence_sufficiency_v1) out.push("evidence_sufficiency_v1");
  if (!stage1Summary.time_coverage_v1) out.push("time_coverage_v1");
  if (!stage1Summary.device_health_snapshot_v1) out.push("device_health_snapshot_v1");
  if (!stage1Summary.conflict_detection_v1) out.push("conflict_detection_v1");
  const coverage = asObj(stage1Summary.time_coverage_v1);
  if (toNumber(coverage.sample_count) == null) out.push("time_coverage_v1.sample_count");
  if (toNumber(coverage.coverage_ratio) == null) out.push("time_coverage_v1.coverage_ratio");
  return Array.from(new Set(out));
}

function deriveUncertaintySources(stage1Summary: Record<string, any>): string[] {
  const out: string[] = [];
  const evidence = asObj(stage1Summary.evidence_sufficiency_v1);
  out.push(...asArray(evidence.reason_codes));
  const coverage = asObj(stage1Summary.time_coverage_v1);
  const freshness = String(coverage.freshness ?? "").trim().toLowerCase();
  if (freshness && freshness !== "fresh") out.push(`freshness:${freshness}`);
  const device = asObj(stage1Summary.device_health_snapshot_v1);
  const deviceHealth = String(device.device_health_status ?? "").trim().toUpperCase();
  if (deviceHealth && deviceHealth !== "GOOD" && deviceHealth !== "DEGRADED") out.push(`device_health:${deviceHealth}`);
  const conflict = asObj(stage1Summary.conflict_detection_v1);
  if (String(conflict.conflict_status ?? "").trim().toUpperCase() === "UNRESOLVED") out.push("conflict_status:UNRESOLVED");
  if (String(conflict.sensor_drift_status ?? "").trim().toUpperCase() === "DRIFTING") out.push("sensor_drift_status:DRIFTING");
  return Array.from(new Set(out));
}

function deriveConflictingSources(stage1Summary: Record<string, any>): string[] {
  const conflict = asObj(stage1Summary.conflict_detection_v1);
  const reasons = asArray(conflict.conflict_reasons);
  if (String(conflict.conflict_status ?? "").trim().toUpperCase() === "UNRESOLVED" && reasons.length === 0) {
    return ["conflict_detection_v1"];
  }
  return reasons;
}

function confidenceLevel(problemState: ProblemStateV1, uncertaintySources: string[]): UncertaintyConfidenceLevelV1 {
  if (uncertaintySources.length >= 3 || problemState.confidence < 0.5) return "LOW";
  if (uncertaintySources.length > 0 || problemState.confidence < 0.75) return "MEDIUM";
  return "HIGH";
}

export function buildProblemStateAndUncertaintyEnvelopeV1(params: BuildProblemStateParams): {
  problem_state_v1: ProblemStateV1;
  uncertainty_envelope_v1: UncertaintyEnvelopeV1;
} {
  const stage1Summary = asObj(params.stage1Summary);
  const evidence = asObj(stage1Summary.evidence_sufficiency_v1);
  const coverage = asObj(stage1Summary.time_coverage_v1);
  const device = asObj(stage1Summary.device_health_snapshot_v1);
  const conflict = asObj(stage1Summary.conflict_detection_v1);
  const evidenceSufficiency = String(stage1Summary.evidence_sufficiency ?? evidence.evidence_sufficiency ?? "").trim().toUpperCase();
  const evidenceOk = evidenceSufficiency === "PASS";
  const hasTimeCoverage = Boolean(stage1Summary.time_coverage_v1 && coverage.observation_window);
  const window = asObj(coverage.observation_window);
  const startTs = toNumber(window.start_ts_ms) ?? toNumber(stage1Summary.computed_at_ts_ms) ?? Date.now();
  const endTs = toNumber(window.end_ts_ms) ?? toNumber(stage1Summary.updated_ts_ms) ?? Date.now();

  const supportRefs = [
    evidenceRef("evidence_sufficiency_v1", stableId("es", evidence)),
    evidenceRef("time_coverage_v1", hasTimeCoverage ? stableId("tc", coverage) : null),
    evidenceRef("device_health_snapshot_v1", stableId("dh", device)),
    evidenceRef("conflict_detection_v1", stableId("cd", conflict)),
  ].filter((x): x is string => Boolean(x));

  const idBasis = {
    tenant_id: params.tenant_id,
    project_id: params.project_id ?? null,
    group_id: params.group_id ?? null,
    field_id: params.field_id,
    device_id: params.device_id ?? null,
    problem_type: deriveProblemType(stage1Summary),
    startTs,
    endTs,
  };
  const problemStateId = stableId("problem_state", idBasis);
  const problemState: ProblemStateV1 = {
    kind: "problem_state_v1",
    problem_state_id: problemStateId,
    subjectRef: {
      tenant_id: params.tenant_id,
      project_id: params.project_id ?? null,
      group_id: params.group_id ?? null,
      field_id: params.field_id,
      device_id: params.device_id ?? null,
    },
    window: {
      start_ts_ms: startTs,
      end_ts_ms: endTs,
    },
    problem_type: deriveProblemType(stage1Summary),
    problem_scope: "field",
    state_layer_hint: "sensing",
    rate_class_hint: deriveRateClass(stage1Summary),
    confidence: deriveConfidence(stage1Summary),
    actionability: evidenceOk && hasTimeCoverage ? "ACTIONABLE" : "NEEDS_EVIDENCE",
    supporting_evidence_refs: supportRefs,
    evidence_sufficiency_ref: evidenceRef("evidence_sufficiency_v1", stableId("es", evidence)),
    time_coverage_ref: evidenceRef("time_coverage_v1", hasTimeCoverage ? stableId("tc", coverage) : null),
    device_health_ref: evidenceRef("device_health_snapshot_v1", stableId("dh", device)),
    conflict_detection_ref: evidenceRef("conflict_detection_v1", stableId("cd", conflict)),
  };

  const missingInputs = deriveMissingInputs(stage1Summary);
  const uncertaintySources = deriveUncertaintySources(stage1Summary);
  const conflictingSources = deriveConflictingSources(stage1Summary);
  if (conflictingSources.length > 0 && !uncertaintySources.includes("conflict_status:UNRESOLVED")) {
    uncertaintySources.push("conflict_status:UNRESOLVED");
  }
  const uncertaintyEnvelope: UncertaintyEnvelopeV1 = {
    kind: "uncertainty_envelope_v1",
    uncertainty_envelope_id: stableId("uncertainty_envelope", { problemStateId, uncertaintySources, missingInputs, conflictingSources }),
    problem_state_ref: `problem_state_v1:${problemState.problem_state_id}`,
    uncertainty_sources: Array.from(new Set(uncertaintySources)),
    confidence_level: confidenceLevel(problemState, uncertaintySources),
    missing_inputs: missingInputs,
    conflicting_sources: conflictingSources,
    supporting_evidence_refs: supportRefs,
  };

  return { problem_state_v1: problemState, uncertainty_envelope_v1: uncertaintyEnvelope };
}

export async function appendProblemStateAndUncertaintyFactsV1(db: DbConn, params: BuildProblemStateParams): Promise<{
  problem_state_v1: ProblemStateV1;
  uncertainty_envelope_v1: UncertaintyEnvelopeV1;
  fact_ids: {
    problem_state_fact_id: string;
    uncertainty_envelope_fact_id: string;
  };
}> {
  const built = buildProblemStateAndUncertaintyEnvelopeV1(params);
  const problemFactId = randomUUID();
  const uncertaintyFactId = randomUUID();
  await db.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
    [problemFactId, "problem_state_v1", JSON.stringify(built.problem_state_v1)]
  );
  await db.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb) ON CONFLICT (fact_id) DO NOTHING",
    [uncertaintyFactId, "uncertainty_envelope_v1", JSON.stringify(built.uncertainty_envelope_v1)]
  );
  return {
    ...built,
    fact_ids: {
      problem_state_fact_id: problemFactId,
      uncertainty_envelope_fact_id: uncertaintyFactId,
    },
  };
}
