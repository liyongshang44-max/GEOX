import { newId, nowMs } from "./util";
import type { ProblemStateV1 } from "./problem_state";

export type LBCandidateV1 = {
  type: "lb_candidate_v1";
  schema_version: "1.0.0";
  lb_candidate_id: string;
  created_at_ts: number;
  run_id: string;
  problem_state_id?: string|null;
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  status_word: "STABLE"|"DRIFTING"|"UNSTABLE"|"NEEDS_VERIFICATION";
  title?: string|null;
  hypothesis?: string|null;
  metric?: string|null;
  supporting_evidence_refs?: any[];
};

export function deriveLBCandidates(run_id: string, ps: ProblemStateV1): LBCandidateV1[] {
  const metric = ps.metrics_involved?.[0] ?? null;
  const title = metric ? `Candidate pattern: ${metric}` : "Candidate pattern";
  const status_word: LBCandidateV1["status_word"] = "NEEDS_VERIFICATION";

  return [
    {
      type: "lb_candidate_v1",
      schema_version: "1.0.0",
      lb_candidate_id: newId("lb"),
      created_at_ts: nowMs(),
      run_id,
      problem_state_id: ps.problem_state_id,
      subjectRef: ps.subjectRef,
      scale: ps.scale,
      window: ps.window,
      status_word,
      title,
      hypothesis: null,
      metric,
      supporting_evidence_refs: ps.supporting_evidence_refs,
    },
  ];
}
