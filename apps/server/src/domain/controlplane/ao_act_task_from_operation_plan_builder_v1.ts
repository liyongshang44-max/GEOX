export type OperatorOperationPlanTaskProjectionStatusV1 =
  | "AO_ACT_TASK_PROJECTED"
  | "REJECTED_OPERATION_PLAN_NOT_FOUND"
  | "REJECTED_OPERATION_PLAN_NOT_READY"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_APPROVAL_REQUEST_NOT_FOUND"
  | "REJECTED_APPROVAL_REQUEST_NOT_APPROVED"
  | "REJECTED_TASK_ALREADY_CREATED"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type OperatorOperationPlanTaskProjectionSubmissionPayloadV1 = {
  version: "v1"; surface: "OPERATOR"; submission_id: string;
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  operator_id: string; idempotency_key: string; projection_reason: string;
  operation_plan_id: string; operation_plan_fact_id: string | null; operation_plan_index_source_fact_id: string | null;
  approval_request_id: string | null; approval_request_fact_id: string | null; approval_decision_fact_id: string | null; recommendation_id: string | null; recommendation_fact_id: string | null;
  act_task_id: string | null; ao_act_task_fact_id: string | null; status: OperatorOperationPlanTaskProjectionStatusV1;
  task_created: boolean; dispatch_created: false; receipt_created: false; acceptance_created: false; roi_created: false; field_memory_created: false;
  no_direct_dispatch: true; no_receipt_created: true; evidence_refs: string[]; ao_act_task_request_v1: Record<string, unknown> | null;
  boundary_rules: Array<{ rule_code: string; label: string }>; created_at: string;
};

export type AoActTaskFromReadyOperationPlanInputV1 = {
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  operator_id: string; idempotency_key: string; projection_reason: string;
  operationPlanIndexRecord: Record<string, unknown> | null; operationPlanFact: Record<string, unknown> | null; operationPlanFactId: string | null;
  approvalRequestTransition: Record<string, unknown> | null; approvalRequestFactId: string | null;
  submission_id: string; created_at: string;
};

const BOUNDARY_RULES = [
  { rule_code: "H40_TASK_PROJECTION_ONLY", label: "Project READY operation plan to AO-ACT task only" },
  { rule_code: "H40_NO_DIRECT_DISPATCH", label: "Do not dispatch or create receipt/acceptance/ROI/Field Memory" },
];

function s(v: unknown): string { return String(v ?? "").trim(); }
function obj(v: unknown): Record<string, unknown> | null { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null; }
function payload(f: Record<string, unknown> | null): Record<string, unknown> { return obj(f?.payload) ?? f ?? {}; }
function isEmpty(v: unknown): boolean { return s(v).length === 0; }

export function buildAoActTaskFromReadyOperationPlanV1(input: AoActTaskFromReadyOperationPlanInputV1): { submission: OperatorOperationPlanTaskProjectionSubmissionPayloadV1; aoActTaskRequest: Record<string, unknown> | null } {
  const idx = input.operationPlanIndexRecord;
  const op = payload(input.operationPlanFact);
  const ar = payload(input.approvalRequestTransition);
  const proposal = obj(ar.proposal);
  const operationPlanId = s(idx?.operation_plan_id ?? op.operation_plan_id);
  let status: OperatorOperationPlanTaskProjectionStatusV1 = "AO_ACT_TASK_PROJECTED";

  if (!idx) status = "REJECTED_OPERATION_PLAN_NOT_FOUND";
  else if (["tenant_id","project_id","group_id","field_id"].some((k) => s((idx as any)[k]) !== s((input as any)[k])) || s(idx.zone_id ?? "") !== s(input.zone_id ?? "") || s(idx.operation_plan_id) !== operationPlanId) status = "REJECTED_SCOPE_MISMATCH";
  else if (!isEmpty(idx.act_task_id) || !isEmpty(op.act_task_id)) status = "REJECTED_TASK_ALREADY_CREATED";
  else if (s(idx.status) !== "READY") status = "REJECTED_OPERATION_PLAN_NOT_READY";
  else if (!isEmpty(idx.receipt_fact_id) || !isEmpty(op.receipt_fact_id)) status = "REJECTED_INVALID_INPUT";
  else if (!input.operationPlanFact || s((input.operationPlanFact as any).type ?? "operation_plan_v1") !== "operation_plan_v1" || s(op.operation_plan_id) !== operationPlanId || s(op.approval_decision) !== "APPROVE" || isEmpty(op.approval_request_id) || isEmpty(op.approval_decision_fact_id)) status = "REJECTED_INVALID_INPUT";
  else if (!input.approvalRequestTransition) status = "REJECTED_APPROVAL_REQUEST_NOT_FOUND";
  else if (s((input.approvalRequestTransition as any).type ?? "approval_request_v1") !== "approval_request_v1" || s(ar.status) !== "APPROVED" || s(ar.request_id) !== s(op.approval_request_id)) status = "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  else if (!proposal || s(proposal.action_type) !== "IRRIGATE" || !obj(proposal.time_window) || !obj(proposal.parameter_schema) || !obj(proposal.parameters) || !obj(proposal.constraints) || obj(proposal.meta)?.no_direct_execution !== true || obj(proposal.meta)?.skip_auto_task_issue !== true || obj(proposal.meta)?.allow_auto_task_issue !== false) status = "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";

  const approvalRequestId = s(op.approval_request_id) || null;
  const taskRequest = status === "AO_ACT_TASK_PROJECTED" && proposal && approvalRequestId ? {
    tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id,
    operation_plan_id: operationPlanId, approval_request_id: approvalRequestId,
    program_id: op.program_id ?? idx?.program_id ?? null, field_id: input.field_id, season_id: op.season_id ?? idx?.season_id ?? null,
    issuer: { kind: "human", id: input.operator_id, namespace: "operator_operation_plan_task_projection_submission_v1" },
    action_type: "IRRIGATE", target: proposal.target ?? { kind: "field", ref: input.field_id },
    time_window: proposal.time_window, parameter_schema: proposal.parameter_schema, parameters: proposal.parameters, constraints: proposal.constraints,
    meta: { source: "OPERATION_PLAN_READY_V1", operation_plan_id: operationPlanId, operation_plan_fact_id: input.operationPlanFactId, approval_request_id: approvalRequestId, approval_request_fact_id: input.approvalRequestFactId, approval_decision_fact_id: s(op.approval_decision_fact_id) || null, recommendation_id: s(op.recommendation_id) || s(idx?.recommendation_id) || null, recommendation_fact_id: s(op.recommendation_fact_id) || s(idx?.recommendation_fact_id) || null, field_id: input.field_id, zone_id: input.zone_id, no_direct_dispatch: true, no_receipt_created: true, projected_from_ready_operation_plan: true }
  } : null;

  const submission: OperatorOperationPlanTaskProjectionSubmissionPayloadV1 = {
    version: "v1", surface: "OPERATOR", submission_id: input.submission_id,
    tenant_id: input.tenant_id, project_id: input.project_id, group_id: input.group_id, field_id: input.field_id, zone_id: input.zone_id,
    operator_id: input.operator_id, idempotency_key: input.idempotency_key, projection_reason: input.projection_reason,
    operation_plan_id: operationPlanId, operation_plan_fact_id: input.operationPlanFactId, operation_plan_index_source_fact_id: s(idx?.source_fact_id) || null,
    approval_request_id: approvalRequestId, approval_request_fact_id: input.approvalRequestFactId, approval_decision_fact_id: s(op.approval_decision_fact_id) || null, recommendation_id: s(op.recommendation_id) || s(idx?.recommendation_id) || null, recommendation_fact_id: s(op.recommendation_fact_id) || s(idx?.recommendation_fact_id) || null,
    act_task_id: null, ao_act_task_fact_id: null, status, task_created: false,
    dispatch_created: false, receipt_created: false, acceptance_created: false, roi_created: false, field_memory_created: false,
    no_direct_dispatch: true, no_receipt_created: true, evidence_refs: [input.operationPlanFactId, input.approvalRequestFactId, s(op.approval_decision_fact_id)].filter(Boolean) as string[], ao_act_task_request_v1: taskRequest,
    boundary_rules: BOUNDARY_RULES, created_at: input.created_at,
  };
  return { submission, aoActTaskRequest: taskRequest };
}
