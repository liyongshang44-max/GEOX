import type { ProblemStateV1, UncertaintyEnvelopeV1 } from "../sensing/problem_state_uncertainty_v1.js";

export type PermissionSetV1 = {
  kind: "permission_set_v1";
  permission_set_id: string;
  subjectRef: ProblemStateV1["subjectRef"];
  allowed_actions: string[];
  denied_actions: string[];
  requires_human_approval: boolean;
  reasons: string[];
};

export type ControlKernelInputV1 = {
  problem_state_v1: ProblemStateV1;
  uncertainty_envelope_v1: UncertaintyEnvelopeV1;
  permission_set_v1: PermissionSetV1;
};

export type ControlKernelDecisionV1 = {
  kind: "control_kernel_decision_v1";
  status: "CAN_PROPOSE_ACTION" | "NEEDS_EVIDENCE" | "FORBIDDEN";
  problem_state_ref: string;
  uncertainty_envelope_ref: string;
  permission_set_ref: string;
  reason_codes: string[];
};

function hasActionPermission(permissionSet: PermissionSetV1): boolean {
  return Array.isArray(permissionSet.allowed_actions) && permissionSet.allowed_actions.length > 0;
}

export function evaluateControlKernelInputV1(input: ControlKernelInputV1): ControlKernelDecisionV1 {
  const problem = input.problem_state_v1;
  const uncertainty = input.uncertainty_envelope_v1;
  const permissions = input.permission_set_v1;
  const reasonCodes: string[] = [];

  if (problem.kind !== "problem_state_v1") reasonCodes.push("PROBLEM_STATE_REQUIRED");
  if (uncertainty.kind !== "uncertainty_envelope_v1") reasonCodes.push("UNCERTAINTY_ENVELOPE_REQUIRED");
  if (permissions.kind !== "permission_set_v1") reasonCodes.push("PERMISSION_SET_REQUIRED");
  if (problem.actionability !== "ACTIONABLE") reasonCodes.push("PROBLEM_STATE_NOT_ACTIONABLE");
  if (uncertainty.conflicting_sources.length > 0) reasonCodes.push("UNCERTAINTY_HAS_CONFLICTING_SOURCES");
  if (uncertainty.missing_inputs.length > 0) reasonCodes.push("UNCERTAINTY_HAS_MISSING_INPUTS");
  if (!hasActionPermission(permissions)) reasonCodes.push("NO_ALLOWED_ACTION_PERMISSION");
  if (permissions.requires_human_approval) reasonCodes.push("HUMAN_APPROVAL_REQUIRED");

  if (reasonCodes.includes("PROBLEM_STATE_REQUIRED") || reasonCodes.includes("UNCERTAINTY_ENVELOPE_REQUIRED") || reasonCodes.includes("PERMISSION_SET_REQUIRED")) {
    return {
      kind: "control_kernel_decision_v1",
      status: "FORBIDDEN",
      problem_state_ref: `problem_state_v1:${String(problem?.problem_state_id ?? "missing")}`,
      uncertainty_envelope_ref: `uncertainty_envelope_v1:${String(uncertainty?.uncertainty_envelope_id ?? "missing")}`,
      permission_set_ref: `permission_set_v1:${String(permissions?.permission_set_id ?? "missing")}`,
      reason_codes: reasonCodes,
    };
  }

  if (reasonCodes.some((x) => x.startsWith("UNCERTAINTY_") || x === "PROBLEM_STATE_NOT_ACTIONABLE")) {
    return {
      kind: "control_kernel_decision_v1",
      status: "NEEDS_EVIDENCE",
      problem_state_ref: `problem_state_v1:${problem.problem_state_id}`,
      uncertainty_envelope_ref: `uncertainty_envelope_v1:${uncertainty.uncertainty_envelope_id}`,
      permission_set_ref: `permission_set_v1:${permissions.permission_set_id}`,
      reason_codes: reasonCodes,
    };
  }

  if (reasonCodes.length > 0) {
    return {
      kind: "control_kernel_decision_v1",
      status: "FORBIDDEN",
      problem_state_ref: `problem_state_v1:${problem.problem_state_id}`,
      uncertainty_envelope_ref: `uncertainty_envelope_v1:${uncertainty.uncertainty_envelope_id}`,
      permission_set_ref: `permission_set_v1:${permissions.permission_set_id}`,
      reason_codes: reasonCodes,
    };
  }

  return {
    kind: "control_kernel_decision_v1",
    status: "CAN_PROPOSE_ACTION",
    problem_state_ref: `problem_state_v1:${problem.problem_state_id}`,
    uncertainty_envelope_ref: `uncertainty_envelope_v1:${uncertainty.uncertainty_envelope_id}`,
    permission_set_ref: `permission_set_v1:${permissions.permission_set_id}`,
    reason_codes: [],
  };
}
