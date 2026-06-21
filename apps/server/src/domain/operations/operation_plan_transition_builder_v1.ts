// apps/server/src/domain/operations/operation_plan_transition_builder_v1.ts

export type OperationPlanTransitionSourceStatusV1 = "CREATED" | "APPROVED";
export type OperationPlanTransitionTargetStatusV1 = "APPROVED" | "READY";

export type OperationPlanTransitionSubmissionStatusV1 =
  | "OPERATION_PLAN_TRANSITION_RECORDED"
  | "REJECTED_OPERATION_PLAN_NOT_FOUND"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_SOURCE_STATUS_MISMATCH"
  | "REJECTED_INVALID_TRANSITION"
  | "REJECTED_DOWNSTREAM_ALREADY_CREATED"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type OperationPlanTransitionInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  transition_reason: string;
  operationPlanIndexRecord: Record<string, unknown> | null;
  operationPlanFact: Record<string, unknown> | null;
  operationPlanFactId: string | null;
  source_status: OperationPlanTransitionSourceStatusV1;
  target_status: OperationPlanTransitionTargetStatusV1;
  submission_id: string;
  operation_plan_transition_id: string;
  created_ts: number;
  created_at: string;
};

const BOUNDARY_RULES = [
  { rule_code: "H39_ALLOWED_LIFECYCLE_ONLY", label: "Only CREATED to APPROVED and APPROVED to READY transitions" },
  { rule_code: "H39_NO_DIRECT_EXECUTION", label: "No AO-ACT task, dispatch, receipt, ROI, or Field Memory" },
  { rule_code: "H39_APPEND_TRANSITION_AND_UPDATE_INDEX", label: "Append operation_plan_transition_v1 and update operation_plan_index_v1" },
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function payloadOf(fact: Record<string, unknown> | null): Record<string, unknown> {
  return asRecord(asRecord(fact).payload ?? fact);
}

function zoneMatches(left: unknown, right: unknown): boolean {
  return (nullableText(left) ?? "") === (nullableText(right) ?? "");
}

function allowedTransition(from: string, to: string): boolean {
  return (from === "CREATED" && to === "APPROVED") || (from === "APPROVED" && to === "READY");
}

function hasRequiredInput(input: OperationPlanTransitionInputV1): boolean {
  return [input.tenant_id, input.project_id, input.group_id, input.field_id, input.operator_id, input.idempotency_key, input.transition_reason, input.submission_id, input.operation_plan_transition_id, input.created_at].every((v) => text(v).length > 0)
    && Number.isFinite(input.created_ts);
}

function base(input: OperationPlanTransitionInputV1, status: OperationPlanTransitionSubmissionStatusV1, transition: Record<string, unknown> | null) {
  const plan = payloadOf(input.operationPlanFact);
  const idx = asRecord(input.operationPlanIndexRecord);
  const created = status === "OPERATION_PLAN_TRANSITION_RECORDED";
  const operationPlanId = text(idx.operation_plan_id || plan.operation_plan_id);
  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: text(input.submission_id),
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    field_id: text(input.field_id),
    zone_id: input.zone_id,
    operator_id: text(input.operator_id),
    idempotency_key: text(input.idempotency_key),
    transition_reason: text(input.transition_reason),
    operation_plan_id: operationPlanId,
    operation_plan_fact_id: input.operationPlanFactId,
    source_status: input.source_status,
    target_status: input.target_status,
    operation_plan_transition_id: created ? text(input.operation_plan_transition_id) : null,
    operation_plan_transition_fact_id: null,
    status,
    operation_plan_transition_created: created,
    task_created: false,
    dispatch_created: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    no_direct_execution: true,
    evidence_refs: [input.operationPlanFactId ? `fact:${input.operationPlanFactId}` : null, operationPlanId ? `operation_plan:${operationPlanId}` : null].filter((v): v is string => Boolean(v)),
    operation_plan_transition_v1: transition,
    boundary_rules: BOUNDARY_RULES,
    created_at: text(input.created_at),
  };
}

export function buildOperationPlanTransitionV1(input: OperationPlanTransitionInputV1) {
  if (!hasRequiredInput(input)) return base(input, "REJECTED_INVALID_INPUT", null);
  if (!allowedTransition(text(input.source_status), text(input.target_status))) return base(input, "REJECTED_INVALID_TRANSITION", null);
  if (!input.operationPlanIndexRecord || !input.operationPlanFact) return base(input, "REJECTED_OPERATION_PLAN_NOT_FOUND", null);

  const idx = asRecord(input.operationPlanIndexRecord);
  const plan = payloadOf(input.operationPlanFact);
  const operationPlanId = text(idx.operation_plan_id || plan.operation_plan_id);
  if (!operationPlanId || text(plan.operation_plan_id) !== operationPlanId) return base(input, "REJECTED_OPERATION_PLAN_NOT_FOUND", null);

  const scopeOk = text(idx.tenant_id) === text(input.tenant_id) && text(idx.project_id) === text(input.project_id) && text(idx.group_id) === text(input.group_id) && text(idx.field_id) === text(input.field_id) && zoneMatches(idx.zone_id, input.zone_id)
    && text(plan.tenant_id) === text(input.tenant_id) && text(plan.project_id) === text(input.project_id) && text(plan.group_id) === text(input.group_id) && text(plan.field_id) === text(input.field_id) && zoneMatches((plan.spatial_scope as any)?.zone_id ?? plan.zone_id ?? idx.zone_id, input.zone_id);
  if (!scopeOk) return base(input, "REJECTED_SCOPE_MISMATCH", null);

  if (nullableText(idx.act_task_id) || nullableText(idx.receipt_fact_id) || nullableText(plan.act_task_id) || nullableText(plan.receipt_fact_id)) return base(input, "REJECTED_DOWNSTREAM_ALREADY_CREATED", null);
  if (text(idx.status) !== text(input.source_status) || text(plan.status) !== text(idx.status)) return base(input, "REJECTED_SOURCE_STATUS_MISMATCH", null);
  if (text(plan.approval_decision) !== "APPROVE" || !nullableText(plan.approval_decision_fact_id)) return base(input, "REJECTED_OPERATION_PLAN_NOT_FOUND", null);

  const transition = {
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    operation_plan_id: operationPlanId,
    program_id: nullableText(plan.program_id),
    field_id: text(input.field_id),
    spatial_scope: asRecord(plan.spatial_scope) as Record<string, unknown>,
    season_id: nullableText(plan.season_id),
    from_status: input.source_status,
    status: input.target_status,
    trigger: "OPERATOR_PLAN_TRANSITION",
    approval_request_id: nullableText(plan.approval_request_id),
    decision: "APPROVE",
    decision_fact_id: nullableText(plan.approval_decision_fact_id),
    act_task_id: null,
    receipt_fact_id: null,
    terminal_reason: null,
    created_ts: input.created_ts,
  };
  return base(input, "OPERATION_PLAN_TRANSITION_RECORDED", transition);
}
