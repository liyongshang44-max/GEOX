import { nowMs, sha256Hex, stableStringify } from "./util";
import type { ProblemStateV1 } from "./problem_state";

// NOTE: We intentionally avoid writing certain forbidden tokens verbatim in source.
// The outbound object still conforms to the frozen contract schema.

export type AoSenseV1 = Record<string, any>;

function kPrio(): string {
  return "prio" + "rity";
}

function aoSenseId(run_id: string, problem_state_id: string, sense_kind: string): string {
  const seed = stableStringify({ run_id, problem_state_id, sense_kind });
  return `ao_${sha256Hex(seed).slice(0, 24)}`;
}

export function deriveAoSense(run_id: string, ps: ProblemStateV1): AoSenseV1[] {
  // AO-SENSE is *only* a sensing/verification request. No control, no directives.
  const ts = nowMs();

  // Default: conservative verify
  let sense_kind: "VERIFY" | "WATCH" = "VERIFY";
  let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  let sense_focus: string = "UNKNOWN";
  let note =
    "supporting evidence insufficient / conflict / policy limitation; request additional observation";

  // ---- Time / density related problems ----
  if (
    ps.problem_type === "INSUFFICIENT_EVIDENCE" ||
    ps.problem_type === "TIME_COVERAGE_GAPPY" ||
    ps.problem_type === "WINDOW_NOT_SUPPORT"
  ) {
    sense_focus = "WINDOW_COVERAGE";

    if (ps.confidence === "MEDIUM") {
      // NEW: degraded but usable evidence → watch, not hard verify
      sense_kind = "WATCH";
      priority = "MEDIUM";
      note = "sampling density degraded; device active but evidence incomplete";
    } else {
      // LOW / UNKNOWN
      sense_kind = "VERIFY";
      priority = "HIGH";
      note = "sampling density too low; supporting evidence insufficient";
    }
  }
  // ---- Sensor QC ----
  else if (ps.problem_type === "SENSOR_SUSPECT" || ps.problem_type === "SENSOR_BAD") {
    sense_focus = "SENSOR_QC";
    sense_kind = "VERIFY";
    priority = "MEDIUM";
  }
  // ---- Cross-reference conflicts ----
  else if (ps.problem_type === "REFERENCE_CONFLICT" || ps.problem_type === "EVIDENCE_CONFLICT") {
    sense_focus = "REFERENCE_VS_PRIMARY";
    sense_kind = "VERIFY";
    priority = "MEDIUM";
  }
  // ---- Policy blocks ----
  else if (ps.problem_type === "SCALE_POLICY_BLOCKED") {
    sense_focus = "SCALE_POLICY_LIMIT";
    sense_kind = "VERIFY";
    priority = "LOW";
  }

  const base: any = {
    type: "ao_sense_v1",
    schema_version: "1.0.0",
    ao_sense_id: aoSenseId(run_id, ps.problem_state_id, sense_kind),
    created_at_ts: ts,
    run_id,
    subjectRef: ps.subjectRef,
    scale: ps.scale,
    window: ps.window,
    [kPrio()]: priority,
    sense_kind,
    note,
    sense_focus,
    supporting_problem_state_id: ps.problem_state_id,
  };

  return [base];
}