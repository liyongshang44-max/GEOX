export type ApprovalExecutionContextV1 = {
  device_id: string | null;
  adapter_type: string | null;
  device_type: string | null;
  required_capabilities: string[];
};

function asNonEmptyString(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeCapabilities(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((value) => String(value ?? "").trim()).filter(Boolean))).slice(0, 64);
}

function firstNonEmptyCapabilities(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    const normalized = normalizeCapabilities(candidate);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

/**
 * Resolve the execution identity used by approval capability preflight and
 * operation-plan materialization from one canonical source order.
 *
 * Boundary:
 * - existing operation-plan values win when already materialized;
 * - approval request and decision-body execution context are next;
 * - proposal metadata is a compatibility carrier only;
 * - irrigation_simulator is the pre-existing irrigation fallback;
 * - non-irrigation missing adapter stays null (fail-closed downstream).
 */
export function resolveApprovalExecutionContextV1(input: {
  requestPayload: any;
  requestBody?: any;
  operationPlanPayload?: any;
}): ApprovalExecutionContextV1 {
  const requestPayload = input.requestPayload ?? {};
  const requestBody = input.requestBody ?? {};
  const operationPlanPayload = input.operationPlanPayload ?? {};
  const proposal = requestPayload?.proposal ?? {};

  const required_capabilities = firstNonEmptyCapabilities(
    operationPlanPayload?.required_capabilities,
    requestPayload?.required_capabilities,
    requestPayload?.execution_context?.required_capabilities,
    requestPayload?.device_requirements?.required_capabilities,
    requestPayload?.operation_amount?.parameters?.required_capabilities,
    requestPayload?.operation_amount?.parameters?.metadata?.required_capabilities,
    requestBody?.required_capabilities,
    requestBody?.execution_context?.required_capabilities,
    requestBody?.device_requirements?.required_capabilities,
    proposal?.meta?.required_capabilities,
  );

  const operationTypeHint = String(
    proposal?.action_type
      ?? proposal?.task_type
      ?? requestPayload?.operation_type
      ?? requestPayload?.meta?.operation_type
      ?? "",
  ).trim().toUpperCase();

  const irrigationCapabilityMatched = required_capabilities.includes("device.irrigation.valve.open");
  const irrigationOperationHint = operationTypeHint.includes("IRRIGAT");

  let adapter_type = asNonEmptyString(operationPlanPayload?.adapter_type)
    ?? asNonEmptyString(requestPayload?.adapter_type)
    ?? asNonEmptyString(requestPayload?.execution_context?.adapter_type)
    ?? asNonEmptyString(requestPayload?.device_requirements?.adapter_type)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.adapter_type)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.metadata?.adapter_type)
    ?? asNonEmptyString(requestBody?.adapter_type)
    ?? asNonEmptyString(requestBody?.execution_context?.adapter_type)
    ?? asNonEmptyString(requestBody?.device_requirements?.adapter_type)
    ?? asNonEmptyString(proposal?.meta?.adapter_type);

  if (!adapter_type && (irrigationOperationHint || irrigationCapabilityMatched)) {
    adapter_type = "irrigation_simulator";
  }

  const device_type = asNonEmptyString(operationPlanPayload?.device_type)
    ?? asNonEmptyString(requestPayload?.device_type)
    ?? asNonEmptyString(requestPayload?.execution_context?.device_type)
    ?? asNonEmptyString(requestPayload?.device_requirements?.device_type)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.device_type)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.metadata?.device_type)
    ?? asNonEmptyString(requestBody?.device_type)
    ?? asNonEmptyString(requestBody?.execution_context?.device_type)
    ?? asNonEmptyString(requestBody?.device_requirements?.device_type)
    ?? asNonEmptyString(proposal?.meta?.device_type);

  const device_id = asNonEmptyString(operationPlanPayload?.device_id)
    ?? asNonEmptyString(requestPayload?.device_id)
    ?? asNonEmptyString(requestPayload?.execution_context?.device_id)
    ?? asNonEmptyString(requestPayload?.device_requirements?.device_id)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.device_id)
    ?? asNonEmptyString(requestPayload?.operation_amount?.parameters?.metadata?.device_id)
    ?? asNonEmptyString(requestBody?.device_id)
    ?? asNonEmptyString(requestBody?.execution_context?.device_id)
    ?? asNonEmptyString(requestBody?.device_requirements?.device_id)
    ?? asNonEmptyString(proposal?.meta?.device_id)
    ?? asNonEmptyString(proposal?.target?.id)
    ?? (typeof proposal?.target === "string" ? asNonEmptyString(proposal.target) : null);

  return {
    device_id,
    adapter_type,
    device_type,
    required_capabilities,
  };
}
