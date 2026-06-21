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
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  approver_id: string; approver_token_id: string; idempotency_key: string; decision_reason: string; decision: RecommendationApprovalDecision;
  sourceApprovalRequest: Record<string, unknown> | null; sourceApprovalRequestFactId: string | null;
  submission_id: string; approval_decision_id: string; created_at: string;
};

const text = (v: unknown) => String(v ?? "").trim();
const rec = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const bool = (v: unknown) => v === true;
const sourceRecommendationId = (p: Record<string, unknown>): string | null => text(p.source_recommendation_id || p.recommendation_id || rec(p.proposal).recommendation_id || rec(rec(p.proposal).meta).recommendation_id) || null;
const sourceRecommendationFactId = (p: Record<string, unknown>): string | null => text(p.source_recommendation_fact_id || rec(rec(p.proposal).meta).source_recommendation_fact_id) || null;
const sourceSubmissionId = (p: Record<string, unknown>): string | null => text(p.source_submission_id || rec(rec(p.proposal).meta).source_submission_id) || null;

export function buildRecommendationApprovalDecisionSubmissionV1(input: RecommendationApprovalDecisionSubmissionInputV1): Record<string, unknown> {
  const boundary_rules = [
    { rule_code: "H37_NO_DIRECT_EXECUTION", label: "Record human approval decision only" },
    { rule_code: "H37_NO_DOWNSTREAM_ARTIFACTS", label: "No operation plan, AO-ACT, dispatch, ROI, or Field Memory" },
    { rule_code: "H37_RECOMMENDATION_DERIVED_ONLY", label: "Only H36 recommendation-derived approval requests" },
  ];
  const base = (status: RecommendationApprovalDecisionStatusV1, source: Record<string, unknown> | null = null) => ({
    version: "v1", surface: "OPERATOR", submission_id: text(input.submission_id), tenant_id: text(input.tenant_id), project_id: text(input.project_id), group_id: text(input.group_id), field_id: text(input.field_id), zone_id: input.zone_id === null ? null : text(input.zone_id),
    approver_id: text(input.approver_id), idempotency_key: text(input.idempotency_key), decision_reason: text(input.decision_reason),
    source_approval_request_id: text(source?.request_id || source?.approval_request_id), source_approval_request_fact_id: input.sourceApprovalRequestFactId,
    source_recommendation_id: source ? sourceRecommendationId(source) : null, source_recommendation_fact_id: source ? sourceRecommendationFactId(source) : null,
    approval_decision_id: null, approval_decision_fact_id: null, decision: status === "DECISION_RECORDED" ? input.decision : null, status,
    approval_request_status_after: status === "DECISION_RECORDED" ? input.decision : null, approval_decision_created: status === "DECISION_RECORDED",
    operation_plan_created: false, operation_plan_transition_created: false, task_created: false, dispatch_created: false, receipt_created: false, roi_created: false, field_memory_created: false,
    no_direct_execution: true, evidence_refs: [] as string[], approval_decision_v1: null as Record<string, unknown> | null, approval_request_transition_v1: null as Record<string, unknown> | null, boundary_rules, created_at: text(input.created_at),
  });
  const required = [input.tenant_id,input.project_id,input.group_id,input.field_id,input.approver_id,input.approver_token_id,input.idempotency_key,input.decision_reason,input.submission_id,input.approval_decision_id,input.created_at];
  if (required.some((x) => !text(x)) || !["APPROVED","REJECTED"].includes(input.decision)) return base("REJECTED_INVALID_INPUT");
  const p = rec(input.sourceApprovalRequest);
  if (!input.sourceApprovalRequest) return base("REJECTED_APPROVAL_REQUEST_NOT_FOUND");
  const requestId = text(p.request_id || p.approval_request_id);
  const meta = rec(rec(p.proposal).meta);
  const sameScope = text(p.tenant_id) === text(input.tenant_id) && text(p.project_id) === text(input.project_id) && text(p.group_id) === text(input.group_id) && text(p.field_id) === text(input.field_id) && text(p.zone_id) === text(input.zone_id);
  if (!sameScope) return base("REJECTED_SCOPE_MISMATCH", p);
  if (text(p.status) !== "PENDING") return base("REJECTED_APPROVAL_REQUEST_NOT_PENDING", p);
  const isDerived = text(meta.source) === "DECISION_RECOMMENDATION_V1" && text(meta.approval_intent) === "REQUEST_HUMAN_APPROVAL_ONLY" && bool(meta.no_direct_execution) && bool(meta.skip_auto_task_issue) && meta.allow_auto_task_issue === false && meta.approval_decision_created === false && meta.operation_plan_created === false && meta.task_created === false && meta.dispatch_created === false && meta.roi_created === false && meta.field_memory_created === false;
  if (!isDerived) return base("REJECTED_NOT_RECOMMENDATION_DERIVED", p);
  const issuer = rec(rec(p.proposal).issuer);
  const creatorIds = [p.actor_id, p.token_id, issuer.id].map(text).filter(Boolean);
  if (creatorIds.includes(text(input.approver_id)) || creatorIds.includes(text(input.approver_token_id))) return base("REJECTED_SELF_APPROVAL", p);
  const decision = { tenant_id: text(input.tenant_id), project_id: text(input.project_id), group_id: text(input.group_id), decision_id: text(input.approval_decision_id), request_id: requestId, approval_request_id: requestId, approval_id: requestId, decision: input.decision, actor_id: text(input.approver_id), token_id: text(input.approver_token_id), source: "RECOMMENDATION_APPROVAL_REQUEST_DECISION", source_approval_request_id: requestId, source_recommendation_id: sourceRecommendationId(p), source_submission_id: sourceSubmissionId(p), act_task_id: null, ao_act_fact_id: null, operation_plan_id: null, auto_task_issued: false, operation_plan_created: false, task_created: false, dispatch_created: false, roi_created: false, field_memory_created: false, reason: text(input.decision_reason) || null, created_at: text(input.created_at) };
  const transition = { ...p, request_id: requestId, status: input.decision, decided_at: text(input.created_at), decided_by_actor_id: text(input.approver_id), decided_by_token_id: text(input.approver_token_id), decision_id: text(input.approval_decision_id), decision_reason: text(input.decision_reason) || null, operation_plan_created: false, task_created: false, dispatch_created: false, roi_created: false, field_memory_created: false };
  return { ...base("DECISION_RECORDED", p), approval_decision_id: text(input.approval_decision_id), approval_decision_v1: decision, approval_request_transition_v1: transition };
}
