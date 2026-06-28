// apps/web/src/api/twinKernelProductionWorkflow.ts
// Purpose: call TK15 production ingestion and TK14 operator workflow routes from the TK17 production UX shell.
// Boundary: this client only calls explicit operator workflow endpoints; it must not approve, dispatch, create AO-ACT tasks, create receipts, create acceptance records, or update models.

import { apiRequestWithPolicy } from "./client";

export type ProductionSourceRefs = {
  recommendation_ref_id?: string;
  approval_ref_id?: string;
  operation_plan_ref_id?: string;
  task_ref_id?: string;
  receipt_ref_id?: string;
  observation_ref_id?: string;
  acceptance_ref_id?: string;
  verification_ref_id?: string;
};

export type ProductionIngestionRequest = {
  field_learning_candidate_id: string;
  source_system: string;
  source_event_id?: string;
  occurred_at?: string;
  ingested_by: string;
  ingested_at: string;
  source_refs: ProductionSourceRefs;
};

export type OperatorSessionRequest = {
  decision_cycle_id: string;
  operator_id: string;
  opened_at?: string;
};

export type OperatorReviewRequest = {
  operator_session_id: string;
  reviewed_by: string;
  reviewed_at: string;
  review_status: "REVIEWED" | "NEEDS_FORMALIZATION" | "NO_ACTION";
  review_notes?: Record<string, unknown>;
};

export type OperatorFormalizationRequest = {
  operator_session_id: string;
  operator_review_id: string;
  formalized_by: string;
  formalized_at: string;
  roi_summary?: Record<string, unknown>;
  memory_statement?: Record<string, unknown>;
  evidence_refs?: Array<{ kind: string; ref_id: string }>;
};

export type TwinKernelWorkflowResponse = Record<string, unknown> & { ok?: boolean };

async function postJson<T extends TwinKernelWorkflowResponse>(path: string, body: unknown): Promise<T> {
  const response = await apiRequestWithPolicy<T>(
    path,
    { method: "POST", body: JSON.stringify(body) },
    { silent: true, timeoutMs: 15000 },
  );

  if (!response.ok || !response.data) throw new Error("TWIN_KERNEL_PRODUCTION_WORKFLOW_API_FAILED");

  return response.data;
}

export async function ingestProductionSourceRefs(body: ProductionIngestionRequest): Promise<TwinKernelWorkflowResponse> {
  return postJson<TwinKernelWorkflowResponse>("/api/v1/twin-kernel/production-ingestion/source-refs", body);
}

export async function fetchOperatorDecisionQueue(limit = 25): Promise<TwinKernelWorkflowResponse> {
  const response = await apiRequestWithPolicy<TwinKernelWorkflowResponse>(
    "/api/v1/twin-kernel/operator-workflow/decision-cycles?limit=" + encodeURIComponent(String(limit)),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 },
  );

  if (!response.ok || !response.data) throw new Error("OPERATOR_DECISION_QUEUE_API_FAILED");

  return response.data;
}

export async function createOperatorWorkflowSession(body: OperatorSessionRequest): Promise<TwinKernelWorkflowResponse> {
  return postJson<TwinKernelWorkflowResponse>("/api/v1/twin-kernel/operator-workflow/sessions", body);
}

export async function createOperatorWorkflowReview(body: OperatorReviewRequest): Promise<TwinKernelWorkflowResponse> {
  return postJson<TwinKernelWorkflowResponse>("/api/v1/twin-kernel/operator-workflow/reviews", body);
}

export async function createOperatorWorkflowRoiAction(body: OperatorFormalizationRequest): Promise<TwinKernelWorkflowResponse> {
  return postJson<TwinKernelWorkflowResponse>("/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", body);
}

export async function createOperatorWorkflowFieldMemoryAction(body: OperatorFormalizationRequest): Promise<TwinKernelWorkflowResponse> {
  return postJson<TwinKernelWorkflowResponse>("/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", body);
}

export async function fetchTwinKernelTrace(decisionCycleId: string): Promise<TwinKernelWorkflowResponse> {
  const safeDecisionCycleId = encodeURIComponent(String(decisionCycleId || "").trim());
  const response = await apiRequestWithPolicy<TwinKernelWorkflowResponse>(
    "/api/v1/twin-kernel/traces/" + safeDecisionCycleId,
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 },
  );

  if (!response.ok || !response.data) throw new Error("TWIN_KERNEL_TRACE_API_FAILED");

  return response.data;
}
