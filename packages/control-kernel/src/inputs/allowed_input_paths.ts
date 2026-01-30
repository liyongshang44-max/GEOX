// Control Kernel - Allowed Input Paths v0
//
// Normative source: docs/controlplane/constitution/GEOX-ControlConstitution-AllowedInputPaths-v0.md
//
// This file provides an executable allowlist of canonical field paths.
// The kernel must project incoming inputs into a FieldMap using ONLY these paths.
// Any attempt to read data outside these paths is a governance violation.

/**
 * Canonical dot-path for input fields.
 *
 * Example: "problem_state.window.startTs"
 */
export type CanonicalFieldPath = string;

/**
 * All allowed input paths (v0). Treat this as a strict allowlist.
 */
export const ALLOWED_INPUT_PATHS_V0: ReadonlyArray<CanonicalFieldPath> = Object.freeze([
  // ---- ProblemStateV1 ----
  "problem_state.subjectRef",
  "problem_state.subjectRef.projectId",
  "problem_state.subjectRef.groupId",
  "problem_state.subjectRef.plotId",
  "problem_state.subjectRef.blockId",

  "problem_state.window.startTs",
  "problem_state.window.endTs",

  "problem_state.problem_type",
  "problem_state.confidence",
  "problem_state.problem_scope",
  "problem_state.state_layer_hint",
  "problem_state.rate_class_hint",

  "problem_state.uncertainty_sources[]",
  "problem_state.supporting_evidence_refs[]",

  // ---- UncertaintyEnvelope v0 ----
  "uncertainty_envelope.problem_state_ref",
  "uncertainty_envelope.uncertainty_sources[]",
  "uncertainty_envelope.supporting_evidence_refs[]",

  // ---- PermissionSet v0 ----
  "permission_set.subjectRef",
  "permission_set.subjectRef.projectId",
  "permission_set.subjectRef.groupId",
  "permission_set.subjectRef.plotId",
  "permission_set.subjectRef.blockId",

  "permission_set.window.startTs",
  "permission_set.window.endTs",

  "permission_set.scale",
  "permission_set.action_taxonomy_ref",
  "permission_set.candidate_actions[].action_code",
  "permission_set.supporting_evidence_refs[]"
]);

/**
 * Fast membership set for allowed input paths.
 */
export const ALLOWED_INPUT_PATHS_SET_V0: ReadonlySet<string> = new Set(ALLOWED_INPUT_PATHS_V0);

/**
 * Throws if a path is not in the v0 allowlist.
 */
export function assertAllowedInputPathV0(path: string, context: string): void {
  // Enforce exact match (no prefix shortcuts). This prevents hidden dependencies.
  if (!ALLOWED_INPUT_PATHS_SET_V0.has(path)) {
    throw new Error(`INPUT_PATH_NOT_ALLOWED: ${path} @ ${context}`);
  }
}
