// apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts

export type RecommendationApprovalDecision = "APPROVED" | "REJECTED";

export type RecommendationApprovalDecisionStatusV1 =
  | "DECISION_RECORDED"
  | "REJECTED_APPROVAL_REQUEST_NOT_FOUND"
  | "REJECTED_APPROVAL_REQUEST_NOT_PENDING"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_NOT_RECOMMENDATION_DERIVED"
  | "REJECTED_SELF_APPROVAL"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type RecommendationApprovalDecisionSubmissionInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;

  approver_id: string;
  approver_token_id: string;

  idempotency_key: string;
  decision_reason: string;
  decision: RecommendationApprovalDecision;

  sourceApprovalRequest: Record<string, unknown> | null;
  sourceApprovalRequestFactId: string | null;

  submission_id: string;
  approval_decision_id: string;
  created_at: string;
};

type SourceApprovalRequestV1 = Record<string, unknown>;

const BOUNDARY_RULES = [
  {
    rule_code: "H37_NO_DIRECT_EXECUTION",
    label: "Record human approval decision only",
  },
  {
    rule_code: "H37_NO_DOWNSTREAM_ARTIFACTS",
    label: "No operation plan, AO-ACT, dispatch, ROI, or Field Memory",
  },
  {
    rule_code: "H37_RECOMMENDATION_DERIVED_ONLY",
    label: "Only H36 recommendation-derived approval requests",
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

function proposalOf(source: SourceApprovalRequestV1): Record<string, unknown> {
  return asRecord(source.proposal);
}

function metaOf(source: SourceApprovalRequestV1): Record<string, unknown> {
  return asRecord(proposalOf(source).meta);
}

function sourceRecommendationId(source: SourceApprovalRequestV1): string | null {
  const proposal = proposalOf(source);
  const meta = metaOf(source);
  return nullableText(
    source.source_recommendation_id
      || source.recommendation_id
      || proposal.recommendation_id
      || meta.recommendation_id,
  );
}

function sourceRecommendationFactId(source: SourceApprovalRequestV1): string | null {
  return nullableText(
    source.source_recommendation_fact_id
      || metaOf(source).source_recommendation_fact_id,
  );
}

function sourceSubmissionId(source: SourceApprovalRequestV1): string | null {
  return nullableText(
    source.source_submission_id
      || metaOf(source).source_submission_id,
  );
}

function sourceRequestId(source: SourceApprovalRequestV1 | null): string {
  if (!source) return "";
  return text(source.request_id || source.approval_request_id);
}

function baseSubmission(
  input: RecommendationApprovalDecisionSubmissionInputV1,
  status: RecommendationApprovalDecisionStatusV1,
  source: SourceApprovalRequestV1 | null,
): Record<string, unknown> {
  const recorded = status === "DECISION_RECORDED";

  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: text(input.submission_id),

    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),
    field_id: text(input.field_id),
    zone_id: input.zone_id === null ? null : text(input.zone_id),

    approver_id: text(input.approver_id),
    idempotency_key: text(input.idempotency_key),
    decision_reason: text(input.decision_reason),

    source_approval_request_id: sourceRequestId(source),
    source_approval_request_fact_id: input.sourceApprovalRequestFactId,
    source_recommendation_id: source ? sourceRecommendationId(source) : null,
    source_recommendation_fact_id: source ? sourceRecommendationFactId(source) : null,

    approval_decision_id: recorded ? text(input.approval_decision_id) : null,
    approval_decision_fact_id: null,
    approval_request_transition_fact_id: null,

    decision: recorded ? input.decision : null,
    status,
    approval_request_status_after: recorded ? input.decision : null,
    approval_decision_created: recorded,

    operation_plan_created: false,
    operation_plan_transition_created: false,
    task_created: false,
    dispatch_created: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    no_direct_execution: true,

    evidence_refs: [],
    approval_decision_v1: null,
    approval_request_transition_v1: null,
    boundary_rules: BOUNDARY_RULES,
    created_at: text(input.created_at),
  };
}

function hasRequiredInput(input: RecommendationApprovalDecisionSubmissionInputV1): boolean {
  const required = [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.field_id,
    input.approver_id,
    input.approver_token_id,
    input.idempotency_key,
    input.decision_reason,
    input.submission_id,
    input.approval_decision_id,
    input.created_at,
  ];

  return required.every((value) => text(value).length > 0)
    && (input.decision === "APPROVED" || input.decision === "REJECTED");
}

function scopeMatches(
  input: RecommendationApprovalDecisionSubmissionInputV1,
  source: SourceApprovalRequestV1,
): boolean {
  return text(source.tenant_id) === text(input.tenant_id)
    && text(source.project_id) === text(input.project_id)
    && text(source.group_id) === text(input.group_id)
    && text(source.field_id) === text(input.field_id)
    && text(source.zone_id) === text(input.zone_id);
}

function isRecommendationDerivedApprovalRequest(source: SourceApprovalRequestV1): boolean {
  const meta = metaOf(source);

  return text(meta.source) === "DECISION_RECOMMENDATION_V1"
    && text(meta.approval_intent) === "REQUEST_HUMAN_APPROVAL_ONLY"
    && meta.no_direct_execution === true
    && meta.skip_auto_task_issue === true
    && meta.allow_auto_task_issue === false
    && meta.approval_decision_created === false
    && meta.operation_plan_created === false
    && meta.task_created === false
    && meta.dispatch_created === false
    && meta.roi_created === false
    && meta.field_memory_created === false;
}

function isSelfApproval(
  input: RecommendationApprovalDecisionSubmissionInputV1,
  source: SourceApprovalRequestV1,
): boolean {
  const issuer = asRecord(proposalOf(source).issuer);
  const sourceActorOrTokenIds = [
    source.actor_id,
    source.token_id,
    issuer.id,
  ].map(text).filter(Boolean);

  return sourceActorOrTokenIds.includes(text(input.approver_id))
    || sourceActorOrTokenIds.includes(text(input.approver_token_id));
}

function buildApprovalDecisionPayload(
  input: RecommendationApprovalDecisionSubmissionInputV1,
  source: SourceApprovalRequestV1,
): Record<string, unknown> {
  const requestId = sourceRequestId(source);

  return {
    tenant_id: text(input.tenant_id),
    project_id: text(input.project_id),
    group_id: text(input.group_id),

    decision_id: text(input.approval_decision_id),
    request_id: requestId,
    approval_request_id: requestId,
    approval_id: requestId,

    decision: input.decision,

    actor_id: text(input.approver_id),
    token_id: text(input.approver_token_id),

    source: "RECOMMENDATION_APPROVAL_REQUEST_DECISION",
    source_approval_request_id: requestId,
    source_recommendation_id: sourceRecommendationId(source),
    source_submission_id: sourceSubmissionId(source),

    act_task_id: null,
    ao_act_fact_id: null,
    operation_plan_id: null,

    auto_task_issued: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,

    reason: nullableText(input.decision_reason),
    created_at: text(input.created_at),
  };
}

function buildApprovalRequestTransitionPayload(
  input: RecommendationApprovalDecisionSubmissionInputV1,
  source: SourceApprovalRequestV1,
): Record<string, unknown> {
  return {
    ...source,
    request_id: sourceRequestId(source),
    status: input.decision,

    decided_at: text(input.created_at),
    decided_by_actor_id: text(input.approver_id),
    decided_by_token_id: text(input.approver_token_id),
    decision_id: text(input.approval_decision_id),
    decision_reason: nullableText(input.decision_reason),

    approval_decision_created: true,
    approval_decision_id: text(input.approval_decision_id),
    approval_decision_fact_id: null,

    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
  };
}

export function buildRecommendationApprovalDecisionSubmissionV1(
  input: RecommendationApprovalDecisionSubmissionInputV1,
): Record<string, unknown> {
  if (!hasRequiredInput(input)) {
    return baseSubmission(input, "REJECTED_INVALID_INPUT", null);
  }

  const source = input.sourceApprovalRequest;
  if (!source) {
    return baseSubmission(input, "REJECTED_APPROVAL_REQUEST_NOT_FOUND", null);
  }

  if (!scopeMatches(input, source)) {
    return baseSubmission(input, "REJECTED_SCOPE_MISMATCH", source);
  }

  if (text(source.status) !== "PENDING") {
    return baseSubmission(input, "REJECTED_APPROVAL_REQUEST_NOT_PENDING", source);
  }

  if (!isRecommendationDerivedApprovalRequest(source)) {
    return baseSubmission(input, "REJECTED_NOT_RECOMMENDATION_DERIVED", source);
  }

  if (isSelfApproval(input, source)) {
    return baseSubmission(input, "REJECTED_SELF_APPROVAL", source);
  }

  return {
    ...baseSubmission(input, "DECISION_RECORDED", source),
    approval_decision_v1: buildApprovalDecisionPayload(input, source),
    approval_request_transition_v1: buildApprovalRequestTransitionPayload(input, source),
  };
}
