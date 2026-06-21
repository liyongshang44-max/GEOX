// apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts
// Purpose: purely transform an H35 decision recommendation candidate into an operator submission payload and approval request body.
// Boundary: no database access, fact writes, routes, environment reads, wall-clock reads, random values, or downstream execution artifacts.

export type RecommendationApprovalRequestSubmissionStatusV1 =
  | "SUBMITTED_TO_APPROVAL_REQUEST"
  | "REJECTED_RECOMMENDATION_NOT_FOUND"
  | "REJECTED_RECOMMENDATION_NOT_CANDIDATE"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_NOT_HUMAN_APPROVAL_REQUIRED"
  | "REJECTED_DIRECT_EXECUTION_FORBIDDEN"
  | "REJECTED_DOWNSTREAM_ALREADY_CREATED"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type RecommendationApprovalRequestSubmissionInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  submission_reason: string;
  sourceRecommendation: Record<string, unknown> | null;
  sourceRecommendationFactId: string | null;
  submission_id: string;
  approval_request_id: string;
  created_at: string;
  time_window: { start_ts: number; end_ts: number };
};

export type OperatorRecommendationApprovalRequestSubmissionPayloadV1 = {
  version: "v1";
  surface: "OPERATOR";
  submission_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string | null;
  operator_id: string;
  idempotency_key: string;
  submission_reason: string;
  source_recommendation_id: string;
  source_recommendation_fact_id: string | null;
  source_recommendation_type: "decision_recommendation_v1";
  approval_request_id: string | null;
  approval_request_fact_id: string | null;
  status: RecommendationApprovalRequestSubmissionStatusV1;
  human_approval_required: true;
  no_direct_execution: true;
  approval_request_created: boolean;
  approval_decision_created: false;
  operation_plan_created: false;
  task_created: false;
  dispatch_created: false;
  roi_created: false;
  field_memory_created: false;
  evidence_refs: string[];
  approval_request_v1: Record<string, unknown> | null;
  boundary_rules: Array<{ rule_code: string; label: string }>;
  created_at: string;
};

const BOUNDARY_RULES = [
  { rule_code: "REQUEST_ONLY", label: "Creates an approval request only." },
  { rule_code: "NO_APPROVAL_DECISION", label: "Does not create an approval decision." },
  { rule_code: "NO_DOWNSTREAM_EXECUTION", label: "Does not create plan, task, dispatch, ROI, or field memory." },
];

function text(v: unknown): string { return String(v ?? "").trim(); }
function primitive(v: unknown): number | boolean | string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean" || typeof v === "string") return v;
  return undefined;
}
function primitiveMap(v: unknown): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v)) {
    const p = primitive(val);
    if (text(k) && p !== undefined) out[k] = p;
  }
  return out;
}
function evidence(v: unknown): string[] { return Array.isArray(v) ? v.map(text).filter(Boolean) : []; }
function base(input: RecommendationApprovalRequestSubmissionInputV1, status: RecommendationApprovalRequestSubmissionStatusV1): OperatorRecommendationApprovalRequestSubmissionPayloadV1 {
  const rec = input.sourceRecommendation ?? {};
  return {
    version: "v1", surface: "OPERATOR", submission_id: text(input.submission_id),
    tenant_id: text(input.tenant_id), project_id: text(input.project_id), group_id: text(input.group_id), field_id: text(input.field_id), zone_id: input.zone_id === null ? null : text(input.zone_id),
    operator_id: text(input.operator_id), idempotency_key: text(input.idempotency_key), submission_reason: text(input.submission_reason),
    source_recommendation_id: text(rec.recommendation_id), source_recommendation_fact_id: input.sourceRecommendationFactId ? text(input.sourceRecommendationFactId) : null, source_recommendation_type: "decision_recommendation_v1",
    approval_request_id: null, approval_request_fact_id: null, status,
    human_approval_required: true, no_direct_execution: true, approval_request_created: false,
    approval_decision_created: false, operation_plan_created: false, task_created: false, dispatch_created: false, roi_created: false, field_memory_created: false,
    evidence_refs: evidence(rec.evidence_refs), approval_request_v1: null, boundary_rules: BOUNDARY_RULES, created_at: text(input.created_at),
  };
}

export function buildRecommendationApprovalRequestSubmissionV1(input: RecommendationApprovalRequestSubmissionInputV1): OperatorRecommendationApprovalRequestSubmissionPayloadV1 {
  const required = [input.tenant_id, input.project_id, input.group_id, input.field_id, input.operator_id, input.idempotency_key, input.submission_reason, input.submission_id, input.approval_request_id, input.created_at];
  const win = input.time_window;
  if (!required.every(text) || !win || !Number.isFinite(Number(win.start_ts)) || !Number.isFinite(Number(win.end_ts)) || Number(win.start_ts) >= Number(win.end_ts)) return base(input, "REJECTED_INVALID_INPUT");
  const rec = input.sourceRecommendation;
  if (!rec) return base(input, "REJECTED_RECOMMENDATION_NOT_FOUND");
  if (["tenant_id", "project_id", "group_id", "field_id"].some((k) => text((rec as any)[k]) !== text((input as any)[k])) || text((rec as any).zone_id) !== text(input.zone_id)) return base(input, "REJECTED_SCOPE_MISMATCH");
  if (text(rec.status) !== "CANDIDATE") return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");
  if (rec.human_approval_required !== true) return base(input, "REJECTED_NOT_HUMAN_APPROVAL_REQUIRED");
  if (rec.no_direct_execution !== true) return base(input, "REJECTED_DIRECT_EXECUTION_FORBIDDEN");
  if (["approval_created", "operation_plan_created", "task_created", "dispatch_created", "roi_created", "field_memory_created"].some((k) => (rec as any)[k] === true)) return base(input, "REJECTED_DOWNSTREAM_ALREADY_CREATED");
  if (text(rec.source) !== "ROOT_ZONE_SCENARIO_SELECTION" || text(rec.recommendation_kind) !== "IRRIGATION_CANDIDATE_FROM_SCENARIO") return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");
  if (!text(rec.source_option_id) || evidence(rec.evidence_refs).length < 1) return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");

  const proposed = (rec.proposed_action && typeof rec.proposed_action === "object") ? rec.proposed_action as Record<string, unknown> : {};
  const actionType = text(proposed.action_type);
  const amount = Number(proposed.total_irrigation_mm);
  const effectiveAmount = Number(proposed.total_effective_irrigation_mm);
  if (!["IRRIGATE", "DELAYED_IRRIGATION"].includes(actionType)) return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");
  if (!Number.isFinite(amount) || amount <= 0) return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");
  if (!Number.isFinite(effectiveAmount) || effectiveAmount < 0) return base(input, "REJECTED_RECOMMENDATION_NOT_CANDIDATE");
  const parameters = { irrigation_mm: amount, effective_irrigation_mm: effectiveAmount, source_option_id: text(rec.source_option_id) };
  const approvalBody = {
    tenant_id: text(input.tenant_id), project_id: text(input.project_id), group_id: text(input.group_id), field_id: text(input.field_id), zone_id: input.zone_id,
    issuer: { kind: "human", id: text(input.operator_id), namespace: "operator_recommendation_approval_request_submission_v1" },
    action_type: "IRRIGATE", target: { kind: input.zone_id ? "area" : "field", ref: input.zone_id ? text(input.zone_id) : text(input.field_id) },
    time_window: { start_ts: Number(win.start_ts), end_ts: Number(win.end_ts) },
    parameter_schema: { keys: [{ name: "irrigation_mm", type: "number", min: 0 }, { name: "source_option_id", type: "enum", enum: [text(rec.source_option_id) || "UNKNOWN"] }] },
    parameters: { ...parameters, ...primitiveMap((rec as any).parameters) }, constraints: primitiveMap((rec as any).constraints),
    meta: { source: "DECISION_RECOMMENDATION_V1", source_recommendation_id: text(rec.recommendation_id), source_recommendation_fact_id: input.sourceRecommendationFactId, source_submission_id: text(rec.source_submission_id) || null, approval_intent: "REQUEST_HUMAN_APPROVAL_ONLY", no_direct_execution: true, approval_decision_created: false, operation_plan_created: false, task_created: false, dispatch_created: false, roi_created: false, field_memory_created: false, skip_auto_task_issue: true, allow_auto_task_issue: false },
  };
  return { ...base(input, "SUBMITTED_TO_APPROVAL_REQUEST"), approval_request_id: text(input.approval_request_id), approval_request_created: true, approval_request_v1: approvalBody };
}
