// apps/server/src/domain/water_response/water_response_verification_from_acceptance_v1.ts

export type WaterResponseVerdictV1 =
  | "RESPONDED"
  | "PARTIAL_RESPONSE"
  | "NO_RESPONSE_OBSERVED"
  | "NOT_VERIFIABLE"
  | "CONFLICTING_EVIDENCE";

export type WaterResponseVerificationInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  operator_id: string;
  idempotency_key: string;
  verification_reason: string;
  acceptanceResult: Record<string, unknown> | null;
  asExecutedRecord: Record<string, unknown> | null;
  preState: Record<string, unknown> | null;
  postState: Record<string, unknown> | null;
  acceptance_id: string;
  acceptance_result_fact_id: string;
  as_executed_id: string;
  task_id: string;
  receipt_id: string;
  operation_plan_id: string | null;
  pre_state_id: string;
  post_state_id: string;
  submission_id: string;
  verification_id: string;
  created_at: string;
  thresholds?: {
    min_available_water_fraction_delta_for_response?: number;
    min_matric_potential_kpa_delta_for_response?: number;
    min_post_delay_minutes?: number;
    max_post_delay_minutes?: number;
  };
};

const BOUNDARY_RULES = [
  { rule_code: "H45_RESPONSE_VERIFICATION_ONLY", label: "Creates water response verification only" },
  {
    rule_code: "H45_NO_ROI_FIELD_MEMORY_OPERATION_STATE_OR_CUSTOMER_DELIVERY",
    label: "Does not create ROI, Field Memory, operation_state, reports, or customer delivery",
  },
];

const DEFAULT_THRESHOLDS = {
  min_available_water_fraction_delta_for_response: 0.05,
  min_matric_potential_kpa_delta_for_response: 5,
  min_post_delay_minutes: 30,
  max_post_delay_minutes: 4320,
};

function payloadOf(record: any): any {
  return record?.payload ?? record ?? {};
}

function stringValue(record: any, key: string): string {
  const value = record?.[key] ?? record?.payload?.[key];
  return typeof value === "string" ? value : "";
}

function numberValue(record: any, key: string): number | null {
  const value = record?.[key] ?? record?.payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scopeMatches(input: WaterResponseVerificationInputV1, record: any, keys: string[]): boolean {
  const payload = payloadOf(record);
  return keys.every((key) => String(payload[key] ?? "") === String((input as any)[key] ?? ""));
}

function buildSubmission(
  input: WaterResponseVerificationInputV1,
  status: string,
  response_verdict: WaterResponseVerdictV1 | null,
  verificationPayload: Record<string, unknown> | null,
) {
  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: input.submission_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    operator_id: input.operator_id,
    idempotency_key: input.idempotency_key,
    verification_reason: input.verification_reason,
    acceptance_id: input.acceptance_id,
    acceptance_result_fact_id: input.acceptance_result_fact_id,
    as_executed_id: input.as_executed_id,
    task_id: input.task_id,
    receipt_id: input.receipt_id,
    operation_plan_id: input.operation_plan_id,
    pre_state_id: input.pre_state_id,
    post_state_id: input.post_state_id,
    verification_id: verificationPayload ? input.verification_id : null,
    water_response_verification_fact_id: null,
    status,
    response_verdict,
    water_response_verification_created: Boolean(verificationPayload),
    roi_created: false as false,
    field_memory_created: false as false,
    operation_state_created: false as false,
    customer_delivery_created: false as false,
    no_roi_created: true as true,
    no_field_memory_created: true as true,
    no_operation_state_created: true as true,
    no_customer_delivery_created: true as true,
    water_response_verification_v1: verificationPayload,
    boundary_rules: BOUNDARY_RULES,
    created_at: input.created_at,
  };
}

function rejection(input: WaterResponseVerificationInputV1, status: string) {
  return { submission: buildSubmission(input, status, null, null), verification: null };
}

function executionEndAtFromAsExecuted(asExecutedRecord: any): string | null {
  const payload = payloadOf(asExecutedRecord);
  const executed = payload.executed ?? {};
  const candidates = [
    executed.execution_end_at,
    executed.end_at,
    payload.execution_end_at,
    payload.end_at,
  ];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
  return typeof value === "string" ? value : null;
}

export function buildWaterResponseVerificationFromAcceptanceV1(input: WaterResponseVerificationInputV1) {
  if (!input.acceptanceResult) return rejection(input, "REJECTED_ACCEPTANCE_NOT_FOUND");

  const acceptancePayload = payloadOf(input.acceptanceResult);
  const formalGate = acceptancePayload.formal_gate ?? {};
  const acceptanceScopeMatches =
    scopeMatches(input, acceptancePayload, ["tenant_id", "project_id", "group_id", "field_id", "acceptance_id", "as_executed_id", "receipt_id"])
    && String(acceptancePayload.act_task_id ?? acceptancePayload.task_id) === input.task_id
    && (!input.operation_plan_id || String(acceptancePayload.operation_plan_id ?? "") === input.operation_plan_id)
    && formalGate.execution_effect_passed === false
    && acceptancePayload.customer_visible_eligible === false;

  if (!acceptanceScopeMatches) return rejection(input, "REJECTED_SCOPE_MISMATCH");
  if (String(acceptancePayload.verdict) !== "PASS") return rejection(input, "REJECTED_ACCEPTANCE_NOT_PASSED");
  if (!input.asExecutedRecord) return rejection(input, "REJECTED_AS_EXECUTED_NOT_FOUND");

  if (!scopeMatches(input, input.asExecutedRecord, ["tenant_id", "project_id", "group_id", "field_id", "as_executed_id", "task_id", "receipt_id"])) {
    return rejection(input, "REJECTED_SCOPE_MISMATCH");
  }

  if (!input.preState) return rejection(input, "REJECTED_PRE_STATE_NOT_FOUND");
  if (!input.postState) return rejection(input, "REJECTED_POST_STATE_NOT_FOUND");

  const stateScopeMatches =
    scopeMatches(input, input.preState, ["tenant_id", "project_id", "group_id", "field_id", "zone_id"])
    && stringValue(input.preState, "state_id") === input.pre_state_id
    && scopeMatches(input, input.postState, ["tenant_id", "project_id", "group_id", "field_id", "zone_id"])
    && stringValue(input.postState, "state_id") === input.post_state_id;

  if (!stateScopeMatches) return rejection(input, "REJECTED_SCOPE_MISMATCH");

  const preComputedAt = stringValue(input.preState, "computed_at");
  const postComputedAt = stringValue(input.postState, "computed_at");
  const preComputedMs = Date.parse(preComputedAt);
  const postComputedMs = Date.parse(postComputedAt);

  if (!Number.isFinite(preComputedMs) || !Number.isFinite(postComputedMs) || postComputedMs <= preComputedMs) {
    return rejection(input, "REJECTED_STATE_TIME_ORDER");
  }

  const executionEndAt = executionEndAtFromAsExecuted(input.asExecutedRecord);
  const executionEndMs = executionEndAt ? Date.parse(executionEndAt) : null;
  if (executionEndMs !== null && (!Number.isFinite(executionEndMs) || postComputedMs <= executionEndMs)) {
    return rejection(input, "REJECTED_STATE_TIME_ORDER");
  }

  const thresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds ?? {}) };
  const postDelayMinutes = executionEndMs !== null ? (postComputedMs - executionEndMs) / 60000 : (postComputedMs - preComputedMs) / 60000;

  const preAvailableWater = numberValue(input.preState, "root_zone_available_water_fraction");
  const postAvailableWater = numberValue(input.postState, "root_zone_available_water_fraction");
  const preMatricPotential = numberValue(input.preState, "weighted_matric_potential_kpa");
  const postMatricPotential = numberValue(input.postState, "weighted_matric_potential_kpa");

  const availableWaterDelta = preAvailableWater === null || postAvailableWater === null ? null : postAvailableWater - preAvailableWater;
  const matricPotentialDelta = preMatricPotential === null || postMatricPotential === null ? null : postMatricPotential - preMatricPotential;
  const preInputStatus = stringValue(input.preState, "input_status");
  const postInputStatus = stringValue(input.postState, "input_status");
  const blockingReasons: string[] = [];

  if (availableWaterDelta === null || matricPotentialDelta === null) blockingReasons.push("MISSING_NUMERIC_STATE_VALUES");
  if (!["OK", "VALID", "COMPLETE"].includes(preInputStatus)) blockingReasons.push("BAD_PRE_INPUT_STATUS");
  if (!["OK", "VALID", "COMPLETE"].includes(postInputStatus)) blockingReasons.push("BAD_POST_INPUT_STATUS");
  if (postDelayMinutes < thresholds.min_post_delay_minutes || postDelayMinutes > thresholds.max_post_delay_minutes) {
    blockingReasons.push("POST_STATE_OUTSIDE_ALLOWED_TIME_WINDOW");
  }

  const classTransition = `${stringValue(input.preState, "root_zone_water_potential_class") || "UNKNOWN"}->${stringValue(input.postState, "root_zone_water_potential_class") || "UNKNOWN"}`;
  let responseVerdict: WaterResponseVerdictV1 = "NOT_VERIFIABLE";

  if (blockingReasons.length === 0) {
    const responseObserved =
      (availableWaterDelta ?? 0) >= thresholds.min_available_water_fraction_delta_for_response
      || (matricPotentialDelta ?? 0) >= thresholds.min_matric_potential_kpa_delta_for_response;
    const strongWorsening =
      (availableWaterDelta !== null && availableWaterDelta <= -thresholds.min_available_water_fraction_delta_for_response)
      || (matricPotentialDelta !== null && matricPotentialDelta <= -thresholds.min_matric_potential_kpa_delta_for_response);

    responseVerdict = responseObserved && strongWorsening
      ? "CONFLICTING_EVIDENCE"
      : responseObserved
        ? "RESPONDED"
        : ((availableWaterDelta ?? 0) > 0 || (matricPotentialDelta ?? 0) > 0)
          ? "PARTIAL_RESPONSE"
          : "NO_RESPONSE_OBSERVED";
  }

  const asExecutedPayload = payloadOf(input.asExecutedRecord);
  const executed = asExecutedPayload.executed ?? {};
  const verificationPayload = {
    version: "v1",
    verification_id: input.verification_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    acceptance_id: input.acceptance_id,
    acceptance_result_fact_id: input.acceptance_result_fact_id,
    as_executed_id: input.as_executed_id,
    task_id: input.task_id,
    receipt_id: input.receipt_id,
    operation_plan_id: input.operation_plan_id,
    pre_state_id: input.pre_state_id,
    post_state_id: input.post_state_id,
    pre_computed_at: preComputedAt,
    post_computed_at: postComputedAt,
    execution_reference: {
      execution_start_at: executed.execution_start_at ?? executed.start_at ?? null,
      execution_end_at: executionEndAt,
      applied_amount_mm: typeof executed.applied_amount_mm === "number" ? executed.applied_amount_mm : null,
      action_type: executed.action_type ?? null,
    },
    pre_state: {
      root_zone_available_water_fraction: preAvailableWater,
      weighted_matric_potential_kpa: preMatricPotential,
      root_zone_water_potential_class: stringValue(input.preState, "root_zone_water_potential_class") || "UNKNOWN",
      input_status: preInputStatus,
    },
    post_state: {
      root_zone_available_water_fraction: postAvailableWater,
      weighted_matric_potential_kpa: postMatricPotential,
      root_zone_water_potential_class: stringValue(input.postState, "root_zone_water_potential_class") || "UNKNOWN",
      input_status: postInputStatus,
    },
    deltas: {
      available_water_fraction_delta: availableWaterDelta,
      weighted_matric_potential_kpa_delta: matricPotentialDelta,
      class_transition: classTransition,
    },
    thresholds,
    response_verdict: responseVerdict,
    confidence: {
      pre_state_available: true,
      post_state_available: true,
      sufficient_time_gap: !blockingReasons.includes("POST_STATE_OUTSIDE_ALLOWED_TIME_WINDOW"),
      pre_input_status: preInputStatus,
      post_input_status: postInputStatus,
      blocking_reasons: blockingReasons,
    },
    evidence_refs: Array.isArray(asExecutedPayload.evidence_refs) ? asExecutedPayload.evidence_refs : [],
    formal_chain: {
      acceptance_verdict: String(acceptancePayload.verdict),
      acceptance_source: "ACCEPTANCE_RESULT_V1" as const,
      as_executed_source: "AS_EXECUTED_RECORD_V1" as const,
      state_source: "ROOT_ZONE_SOIL_WATER_STATE_INDEX_V1" as const,
      response_verification_only: true,
    },
    roi_created: false as false,
    field_memory_created: false as false,
    operation_state_created: false as false,
    customer_delivery_created: false as false,
    no_roi_created: true as true,
    no_field_memory_created: true as true,
    no_operation_state_created: true as true,
    no_customer_delivery_created: true as true,
    created_at: input.created_at,
    created_by: input.operator_id,
  };

  return {
    submission: buildSubmission(input, "WATER_RESPONSE_VERIFICATION_RECORDED", responseVerdict, verificationPayload),
    verification: { type: "water_response_verification_v1" as const, payload: verificationPayload },
  };
}
