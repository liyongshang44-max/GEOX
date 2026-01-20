import { newId, nowMs } from "./util";

export type EvidenceRef = {
  kind: "ledger_slice" | "state_vector" | "reference_view" | "qc_summary";
  ref_id: string;
  note?: string | null;
  time_range?: { startTs: number; endTs: number } | null;
};

export type ProblemStateV1 = {
  type: "problem_state_v1";
  schema_version: "1.0.0";
  problem_state_id: string;
  created_at_ts: number;
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  problem_type: string;
  confidence: "HIGH"|"MEDIUM"|"LOW"|"UNKNOWN";
  uncertainty_sources: string[];
  summary?: string|null;
  metrics_involved?: string[];
  sensors_involved?: string[];
  supporting_evidence_refs?: EvidenceRef[];
  state_inputs_used: any[];
  system_degraded?: boolean;
  state_layer_hint: "atomic"|"derived"|"memory"|"unknown";
  rate_class_hint: "fast"|"mid"|"slow"|"unknown";
  problem_scope: "sensor_point"|"spatial_unit"|"reference_view"|"unknown";
};

export function makeProblemStateBase(args: {
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  problem_type: string;
  confidence: ProblemStateV1["confidence"];
  uncertainty_sources: string[];
  summary?: string|null;
  metrics_involved?: string[];
  sensors_involved?: string[];
  supporting_evidence_refs?: EvidenceRef[];
  system_degraded?: boolean;
  state_layer_hint: ProblemStateV1["state_layer_hint"];
  rate_class_hint: ProblemStateV1["rate_class_hint"];
  problem_scope: ProblemStateV1["problem_scope"];
}): ProblemStateV1 {
  return {
    type: "problem_state_v1",
    schema_version: "1.0.0",
    problem_state_id: newId("ps"),
    created_at_ts: nowMs(),
    subjectRef: args.subjectRef,
    scale: args.scale,
    window: args.window,
    problem_type: args.problem_type,
    confidence: args.confidence,
    uncertainty_sources: args.uncertainty_sources,
    summary: args.summary ?? null,
    metrics_involved: args.metrics_involved,
    sensors_involved: args.sensors_involved,
    supporting_evidence_refs: args.supporting_evidence_refs,
    state_inputs_used: [],
    system_degraded: args.system_degraded ?? false,
    state_layer_hint: args.state_layer_hint,
    rate_class_hint: args.rate_class_hint,
    problem_scope: args.problem_scope,
  };
}
