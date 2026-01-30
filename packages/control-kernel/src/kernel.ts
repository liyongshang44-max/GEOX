// Control Kernel - Pure evaluation entrypoint (v0)
//
// Normative sources:
// - docs/controlplane/constitution/GEOX-ControlKernel-NonGoals-v0.md
// - docs/controlplane/constitution/GEOX-ControlKernel-AllowedOutputs-v0.md
// - docs/controlplane/constitution/GEOX-ControlConstitution-AllowedInputPaths-v0.md
// - docs/controlplane/constitution/GEOX-AO-ActionTaxonomy-v0.md
//
// This module exports a single pure function that:
// 1) Projects inputs into a FieldMap (strict allowlist).
// 2) Evaluates each provided ControlRuleSetV0.
// 3) Returns only ControlVerdict v0 outputs.
//
// No IO. No side effects. No execution. No explanation.

import type { ProblemStateLike, UncertaintyEnvelopeLike, PermissionSetLike } from "./inputs/projector";
import { projectInputsToFieldMapV0 } from "./inputs/projector";
import type { ControlRuleSetV0, ControlVerdictV0 } from "./ruleset/types";
import { evaluateRuleSetV0 } from "./ruleset/evaluator";

/**
 * Evaluates control rulesets deterministically against the provided inputs.
 *
 * @param problemState - ProblemState-like input.
 * @param uncertaintyEnvelope - UncertaintyEnvelope-like input.
 * @param permissionSet - PermissionSet-like input.
 * @param ruleSets - Rule sets to evaluate (each for one action_code).
 * @returns Array of ControlVerdict v0 outputs.
 */
export function evaluateControlV0(
  problemState: ProblemStateLike,
  uncertaintyEnvelope: UncertaintyEnvelopeLike,
  permissionSet: PermissionSetLike,
  ruleSets: ReadonlyArray<ControlRuleSetV0>
): ReadonlyArray<ControlVerdictV0> {
  // Project inputs into a strict FieldMap so the kernel cannot read extra fields.
  const fieldMap = projectInputsToFieldMapV0(problemState, uncertaintyEnvelope, permissionSet);

  // Subject/window are treated as opaque blobs (kernel does not interpret them).
  const subjectRef = problemState.subjectRef;
  const window = problemState.window;

  // Evaluate each ruleset independently (no cross-ruleset aggregation).
  const verdicts: ControlVerdictV0[] = [];
  for (const rs of ruleSets) {
    const v = evaluateRuleSetV0(fieldMap, rs, subjectRef, window, { permissionSet });
    verdicts.push(v);
  }

  // Freeze to prevent accidental mutation by callers.
  return Object.freeze(verdicts);
}
