// Control Kernel - Allowed Input Projector (FieldMap)
//
// Purpose:
// - Convert raw input objects (ProblemState / UncertaintyEnvelope / PermissionSet)
//   into a strict FieldMap that contains ONLY the fields listed in
//   ALLOWED_INPUT_PATHS_V0.
// - Provide a single choke point so the kernel cannot "accidentally" read extra fields.
//
// Normative sources:
// - docs/controlplane/constitution/GEOX-ControlConstitution-AllowedInputs-v0.md
// - docs/controlplane/constitution/GEOX-ControlConstitution-AllowedInputPaths-v0.md

import { ALLOWED_INPUT_PATHS_SET_V0, type CanonicalFieldPath } from "./allowed_input_paths";

/**
 * FieldMap is the only data structure the Control Kernel is allowed to read.
 *
 * - Keys MUST be canonical dot-paths from Allowed Input Paths v0.
 * - Values are read-only snapshots of the corresponding input fields.
 */
export type FieldMap = Readonly<Record<CanonicalFieldPath, unknown>>;

/**
 * Minimal shape shared by inputs that carry a subject reference.
 */
export interface SubjectRef {
  projectId?: string;
  groupId?: string;
  plotId?: string;
  blockId?: string;
}

/**
 * Minimal window shape used by the kernel.
 */
export interface TimeWindow {
  startTs?: number;
  endTs?: number;
}

/**
 * Minimal ProblemState shape required for the FieldMap projection.
 */
export interface ProblemStateLike {
  subjectRef?: SubjectRef;
  window?: TimeWindow;
  problem_type?: string;
  confidence?: string;
  problem_scope?: string;
  state_layer_hint?: string;
  rate_class_hint?: string;
  uncertainty_sources?: string[];
  supporting_evidence_refs?: unknown[];
}

/**
 * Minimal UncertaintyEnvelope shape required for the FieldMap projection.
 */
export interface UncertaintyEnvelopeLike {
  problem_state_ref?: string;
  uncertainty_sources?: string[];
  supporting_evidence_refs?: unknown[];
}

/**
 * Minimal PermissionSet shape required for the FieldMap projection.
 */
export interface PermissionSetLike {
  subjectRef?: SubjectRef;
  window?: TimeWindow;
  scale?: string;
  action_taxonomy_ref?: string;
  candidate_actions?: Array<{ action_code?: string }>;
  supporting_evidence_refs?: unknown[];
}

/**
 * Projects the provided inputs into a strict, read-only FieldMap.
 *
 * @param problemState - ProblemState-like input object.
 * @param uncertaintyEnvelope - UncertaintyEnvelope-like input object.
 * @param permissionSet - PermissionSet-like input object.
 * @returns Read-only FieldMap containing ONLY allowed paths.
 */
export function projectInputsToFieldMapV0(
  problemState: ProblemStateLike,
  uncertaintyEnvelope: UncertaintyEnvelopeLike,
  permissionSet: PermissionSetLike
): FieldMap {
  // Build a plain object first, then freeze to enforce immutability.
  const out: Record<string, unknown> = Object.create(null);

  // ---- ProblemState ----
  out["problem_state.subjectRef"] = problemState.subjectRef;
  out["problem_state.subjectRef.projectId"] = problemState.subjectRef?.projectId;
  out["problem_state.subjectRef.groupId"] = problemState.subjectRef?.groupId;
  out["problem_state.subjectRef.plotId"] = problemState.subjectRef?.plotId;
  out["problem_state.subjectRef.blockId"] = problemState.subjectRef?.blockId;

  out["problem_state.window.startTs"] = problemState.window?.startTs;
  out["problem_state.window.endTs"] = problemState.window?.endTs;

  out["problem_state.problem_type"] = problemState.problem_type;
  out["problem_state.confidence"] = problemState.confidence;
  out["problem_state.problem_scope"] = problemState.problem_scope;
  out["problem_state.state_layer_hint"] = problemState.state_layer_hint;
  out["problem_state.rate_class_hint"] = problemState.rate_class_hint;

  out["problem_state.uncertainty_sources[]"] = Array.isArray(problemState.uncertainty_sources)
    ? [...problemState.uncertainty_sources]
    : undefined;
  out["problem_state.supporting_evidence_refs[]"] = Array.isArray(problemState.supporting_evidence_refs)
    ? [...problemState.supporting_evidence_refs]
    : undefined;

  // ---- UncertaintyEnvelope ----
  out["uncertainty_envelope.problem_state_ref"] = uncertaintyEnvelope.problem_state_ref;
  out["uncertainty_envelope.uncertainty_sources[]"] = Array.isArray(uncertaintyEnvelope.uncertainty_sources)
    ? [...uncertaintyEnvelope.uncertainty_sources]
    : undefined;
  out["uncertainty_envelope.supporting_evidence_refs[]"] = Array.isArray(uncertaintyEnvelope.supporting_evidence_refs)
    ? [...uncertaintyEnvelope.supporting_evidence_refs]
    : undefined;

  // ---- PermissionSet ----
  out["permission_set.subjectRef"] = permissionSet.subjectRef;
  out["permission_set.subjectRef.projectId"] = permissionSet.subjectRef?.projectId;
  out["permission_set.subjectRef.groupId"] = permissionSet.subjectRef?.groupId;
  out["permission_set.subjectRef.plotId"] = permissionSet.subjectRef?.plotId;
  out["permission_set.subjectRef.blockId"] = permissionSet.subjectRef?.blockId;

  out["permission_set.window.startTs"] = permissionSet.window?.startTs;
  out["permission_set.window.endTs"] = permissionSet.window?.endTs;

  out["permission_set.scale"] = permissionSet.scale;
  out["permission_set.action_taxonomy_ref"] = permissionSet.action_taxonomy_ref;
  out["permission_set.candidate_actions[].action_code"] = Array.isArray(permissionSet.candidate_actions)
    ? permissionSet.candidate_actions.map((x) => x.action_code)
    : undefined;
  out["permission_set.supporting_evidence_refs[]"] = Array.isArray(permissionSet.supporting_evidence_refs)
    ? [...permissionSet.supporting_evidence_refs]
    : undefined;

  // Defensive check: ensure we did not accidentally create a non-allowed key.
  // (This also prevents typos from silently widening the readable surface.)
  for (const key of Object.keys(out)) {
    if (!ALLOWED_INPUT_PATHS_SET_V0.has(key)) {
      throw new Error(`INTERNAL_BUG_UNALLOWED_KEY_EMITTED: ${key}`);
    }
  }

  // Freeze to enforce immutability.
  return Object.freeze(out) as FieldMap;
}
