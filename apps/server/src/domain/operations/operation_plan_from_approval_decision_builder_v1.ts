// apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts

export type OperationPlanFromApprovalDecisionStatusV1 =
  | "OPERATION_PLAN_CREATED"
  | "REJECTED_APPROVAL_DECISION_NOT_FOUND"
  | "REJECTED_DECISION_NOT_APPROVED"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_NOT_RECOMMENDATION_DERIVED"
  | "REJECTED_DOWNSTREAM_ALREADY_CREATED"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type OperationPlanFromApprovalDecisionInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  submission_reason: string;
  sourceApprovalDecision: Record<string, unknown> | null;
  sourceApprovalDecisionFactId: string | null;
  sourceApprovalRequestTransition: Record<string, unknown> | null;
  sourceApprovalRequestFactId: string | null;
  submission_id: string;
  operation_plan_id: string;
  created_ts: number;
  created_at: string;
};

const BOUNDARY_RULES = [
  {
    rule_code: "H38_CREATED_PLAN_ONLY",
    label: "Create operation_plan_v1 in CREATED status only",
  },
  {
    rule_code: "H38_NO_DIRECT_EXECUTION",
    label: "No transition, AO-ACT task, dispatch, receipt, ROI, or Field Memory",
  },
  {
    rule_code: "H38_RECOMMENDATION_APPROVED_ONLY",
    label: "Only approved recommendation-derived decisions",
  },
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

function proposalOf(source: Record<string, unknown> | null): Record<string, unknown> {
  return asRecord(source?.proposal);
}

function metaOf(source: Record<string, unknown> | null): Record<string, unknown> {
  return asRecord(proposalOf(source).meta);
}

function sourceRequestId(
  decision: Record<string, unknown> | null,
  request: Record<string, unknown> | null,
): string | null {
  return nullableText(
    decision?.source_approval_request_id
      || decision?.approval_request_id
      || decision?.request_id
      || request?.request_id
      || request?.approval_request_id,
  );
}

function sourceRecommendationId(
  decision: Record<string, unknown> | null,
  request: Record<string, unknown> | null,
): string | null {
  const proposal = proposalOf(request);
  const meta = metaOf(request);

  return nullableText(
    decision?.source_recommendation_id
      || request?.source_recommendation_id
      || request?.recommendation_id
      || proposal.recommendation_id
      || meta.recommendation_id,
  );
}

function sourceRecommendationFactId(request: Record<string, unknown> | null): string | null {
  const meta = metaOf(request);
  return nullableText(request?.source_recommendation_fact_id || meta.source_recommendation_fact_id);
}

function sourceSubmissionId(request: Record<string, unknown> | null): string | null {
  const meta = metaOf(request);
  return nullableText(request?.source_submission_id || meta.source_submission_id);
}

function buildEvidenceRefs(input: OperationPlanFromApprovalDecisionInputV1): string[] {
  const refs = [
    input.sourceApprovalDecisionFactId ? `fact:${input.sourceApprovalDecisionFactId}` : null,
    input.sourceApprovalRequestFactId ? `fact:${input.sourceApprovalRequestFactId}` : null,
    sourceRecommendationFactId(input.sourceApprovalRequestTransition)
      ? `fact:${sourceRecommendationFactId(input.sourceApprovalRequestTransition)}`
      : null,
    sourceRequestId(input.sourceApprovalDecision, input.sourceApprovalRequestTransition)
      ? `approval_request:${sourceRequestId(input.sourceApprovalDecision, input.sourceApprovalRequestTransition)}`
      : null,
    sourceRecommendationId(input.sourceApprovalDecision, input.sourceApprovalRequestTransition)
      ? `recommendation:${sourceRecommendationId(input.sourceApprovalDecision, input.sourceApprovalRequestTransition)}`
      : null,
  ];

  return Array.from(new Set(refs.filter((ref): ref is string => Boolean(ref))));
}

function hasRequiredInput(input: OperationPlanFromApprovalDecisionInputV1): boolean {
  return [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.field_id,
    input.operator_id,
    input.idempotency_key,
    input.submission_reason,
    input.submission_id,
    input.operation_plan_id,
    input.created_at,
  ].every((value) => text(value).length > 0)
    && Number.isFinite(input.created_ts);
}

function baseSubmission(
  input: OperationPlanFromApprovalDecisionInputV1,
  status: OperationPlanFromApprovalDecisionStatusV1,
  operationPlan: Record<string, unknown> | null,
): Record<string, unknown> {
  const created = status === "OPERATION_PLAN_CREATED";
  const decision = input.sourceApprovalDecision;
  const request = input.sourceApprovalRequestTransition;

  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: text(input.submission_id),
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    field_id: text(input.field_id),
    zone_id: input.zone_id === null ? null : text(input.zone_id),
    operator_id: text(input.operator_id),
    idempotency_key: text(input.idempotency_key),
    submission_reason: text(input.submission_reason),
    source_approval_decision_id: text(decision?.decision_id),
    source_approval_decision_fact_id: input.sourceApprovalDecisionFactId,
    source_approval_request_id: sourceRequestId(decision, request),
    source_approval_request_fact_id: input.sourceApprovalRequestFactId,
    source_recommendation_id: sourceRecommendationId(decision, request),
    source_recommendation_fact_id: sourceRecommendationFactId(request),
    operation_plan_id: created ? text(input.operation_plan_id) : null,
    operation_plan_fact_id: null,
    status,
    operation_plan_created: created,
    operation_plan_transition_created: false,
    task_created: false,
    dispatch_created: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    no_direct_execution: true,
    human_review_completed: true,
    evidence_refs: buildEvidenceRefs(input),
    operation_plan_v1: operationPlan,
    boundary_rules: BOUNDARY_RULES,
    created_at: text(input.created_at),
  };
}

function scopeMatchesRecord(input: OperationPlanFromApprovalDecisionInputV1, source: Record<string, unknown>): boolean {
  return text(source.tenant_id) === text(input.tenant_id)
    && text(source.project_id) === text(input.project_id)
    && text(source.group_id) === text(input.group_id)
    && text(source.field_id) === text(input.field_id)
    && text(source.zone_id) === text(input.zone_id);
}

function scopeMatches(input: OperationPlanFromApprovalDecisionInputV1): boolean {
  const decision = input.sourceApprovalDecision;
  const request = input.sourceApprovalRequestTransition;
  return Boolean(decision && request)
    && scopeMatchesRecord(input, decision as Record<string, unknown>)
    && scopeMatchesRecord(input, request as Record<string, unknown>);
}

function hasNoDownstreamArtifacts(source: Record<string, unknown> | null): boolean {
  return Boolean(source)
    && source?.auto_task_issued !== true
    && source?.operation_plan_created === false
    && source?.operation_plan_transition_created !== true
    && source?.task_created === false
    && source?.dispatch_created === false
    && source?.receipt_created !== true
    && source?.roi_created === false
    && source?.field_memory_created === false
    && !nullableText(source?.operation_plan_id)
    && !nullableText(source?.operation_plan_fact_id)
    && !nullableText(source?.operation_plan_transition_id)
    && !nullableText(source?.operation_plan_transition_fact_id)
    && !nullableText(source?.act_task_id)
    && !nullableText(source?.receipt_fact_id);
}

function isApprovedRecommendationDecision(source: Record<string, unknown>): boolean {
  return text(source.decision) === "APPROVED"
    && text(source.source) === "RECOMMENDATION_APPROVAL_REQUEST_DECISION"
    && source.auto_task_issued === false;
}

function isRecommendationDerivedRequestTransition(source: Record<string, unknown> | null): boolean {
  const meta = metaOf(source);

  return Boolean(source)
    && text(source?.status) === "APPROVED"
    && text(meta.source) === "DECISION_RECOMMENDATION_V1"
    && text(meta.approval_intent) === "REQUEST_HUMAN_APPROVAL_ONLY"
    && meta.no_direct_execution === true
    && meta.skip_auto_task_issue === true
    && meta.allow_auto_task_issue === false
    && source?.approval_decision_created === true;
}

function buildOperationPlanPayload(input: OperationPlanFromApprovalDecisionInputV1): Record<string, unknown> {
  const request = input.sourceApprovalRequestTransition;
  const requestMeta = metaOf(request);

  return {
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    operation_plan_id: text(input.operation_plan_id),
    program_id: nullableText(request?.program_id || requestMeta.program_id),
    field_id: text(input.field_id),
    spatial_scope: {
      field_id: text(input.field_id),
      zone_id: input.zone_id === null ? null : text(input.zone_id),
    },
    season_id: nullableText(request?.season_id || requestMeta.season_id),
    recommendation_id: sourceRecommendationId(input.sourceApprovalDecision, request),
    recommendation_fact_id: sourceRecommendationFactId(request),
    approval_request_id: sourceRequestId(input.sourceApprovalDecision, request),
    approval_decision: "APPROVE",
    approval_decision_fact_id: input.sourceApprovalDecisionFactId,
    act_task_id: null,
    receipt_fact_id: null,
    status: "CREATED",
    created_ts: input.created_ts,
    updated_ts: input.created_ts,
  };
}

export function buildOperationPlanFromApprovalDecisionV1(
  input: OperationPlanFromApprovalDecisionInputV1,
): Record<string, unknown> {
  if (!hasRequiredInput(input)) {
    return baseSubmission(input, "REJECTED_INVALID_INPUT", null);
  }

  const decision = input.sourceApprovalDecision;
  const request = input.sourceApprovalRequestTransition;

  if (!decision || (text(decision.type) && text(decision.type) !== "approval_decision_v1")) {
    return baseSubmission(input, "REJECTED_APPROVAL_DECISION_NOT_FOUND", null);
  }

  if (text(decision.decision) !== "APPROVED") {
    return baseSubmission(input, "REJECTED_DECISION_NOT_APPROVED", null);
  }

  if (!scopeMatches(input)) {
    return baseSubmission(input, "REJECTED_SCOPE_MISMATCH", null);
  }

  if (!isApprovedRecommendationDecision(decision) || !isRecommendationDerivedRequestTransition(request)) {
    return baseSubmission(input, "REJECTED_NOT_RECOMMENDATION_DERIVED", null);
  }

  if (!hasNoDownstreamArtifacts(decision) || !hasNoDownstreamArtifacts(request)) {
    return baseSubmission(input, "REJECTED_DOWNSTREAM_ALREADY_CREATED", null);
  }

  return baseSubmission(input, "OPERATION_PLAN_CREATED", buildOperationPlanPayload(input));
}
