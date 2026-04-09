import { apiRequest, apiRequestOptional, apiRequestWithPolicy, withQuery } from "./client";
import { resolveSkillClassification } from "./skills";

export type OperationStateTimelineItemV1 = { type: string; label: string; ts: number };
export type OperationSkillTraceEntryV1 = {
  skill_id: string | null;
  version: string | null;
  run_id: string | null;
  result_status: string | null;
  error_code: string | null;
};
export type OperationSkillTraceV1 = {
  crop_skill: OperationSkillTraceEntryV1;
  agronomy_skill: OperationSkillTraceEntryV1;
  device_skill: OperationSkillTraceEntryV1;
  acceptance_skill: OperationSkillTraceEntryV1;
};
export type OperationSkillTraceStageV2 = "sensing" | "agronomy" | "device" | "acceptance" | "unknown" | string;
export type OperationSkillTraceItemV2 = {
  stage: OperationSkillTraceStageV2;
  skill_id: string | null;
  status: string | null;
  explanation_codes: string[];
  run_id?: string | null;
  started_ts_ms?: number | null;
  finished_ts_ms?: number | null;
};
export type OperationStateItemV1 = {
  operation_id: string;
  recommendation_id?: string | null;
  program_id?: string | null;
  task_id?: string | null;
  device_id?: string | null;
  field_id?: string | null;
  action_type?: string | null;
  rule_id?: string | null;
  skill_id?: string | null;
  reason_codes?: string[] | null;
  dispatch_status: string;
  receipt_status: string;
  final_status: string;
  last_event_ts: number;
  timeline: OperationStateTimelineItemV1[];
  skill_trace?: OperationSkillTraceItemV2[] | null;
  legacy_skill_trace?: OperationSkillTraceV1 | null;
};

export type ApprovalRequestItem = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: any;
};

export async function fetchOperationStates(params?: { field_id?: string; device_id?: string; final_status?: string; limit?: number }): Promise<{ ok: boolean; count: number; items: OperationStateItemV1[] }> {
  const res = await apiRequest<{ ok: boolean; count: number; items: OperationStateItemV1[] }>(withQuery("/api/v1/operations", params));
  return {
    ...res,
    items: Array.isArray(res?.items)
      ? res.items.map((item) => ({
        ...item,
        skill_trace: normalizeSkillTrace((item as any)?.skill_trace, (item as any)?.legacy_skill_trace ?? null),
      }))
      : [],
  };
}

export type ManualOperationCreatePayload = {
  command_id: string;
  issuer: string;
  action_type: string;
  target: { kind: "field" | "device"; ref: string };
  request_device_id?: string;
  parameters: Record<string, unknown>;
};

export type ManualOperationCreateResponse = {
  ok?: boolean;
  operation_id?: string;
  operation_plan_id?: string;
  idempotent?: boolean;
  error?: string;
};

export async function createManualOperation(payload: ManualOperationCreatePayload): Promise<ManualOperationCreateResponse> {
  const commandId = String(payload?.command_id ?? "").trim();
  if (!commandId) throw new Error("command_id is required");
  const res = await apiRequestWithPolicy<ManualOperationCreateResponse>("/api/v1/operations/manual", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      command_id: commandId,
    }),
  }, {
    dedupe: true,
  });
  if (!res.ok) throw new Error("create manual operation failed");
  return res.data;
}

export type OperationDetailResponse = {
  operation_plan_id: string;
  field_id?: string | null;
  field_name?: string | null;
  program_id?: string | null;
  program_name?: string | null;
  final_status?: string | null;
  status_label?: string | null;
  recommendation?: any;
  approval?: any;
  plan?: any;
  task?: any;
  dispatch?: any;
  receipt?: any;
  manual_fallback?: {
    reason_code?: string | null;
    reason?: string | null;
    message?: string | null;
    assignment_id?: string | null;
  } | null;
  timeline?: any[];
  agronomy?: {
    crop_code?: string | null;
    crop_stage?: string | null;
    rule_id: string;
    rule_version: string;
    before_metrics?: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null } | null;
    after_metrics?: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null } | null;
    expected_effect?: { type?: string | null; value?: number | null } | null;
    actual_effect?: { type?: string | null; value?: number | null } | null;
  } | null;
  evidence_export?: any;
  links?: Record<string, string>;
  attempt_history?: Array<{
    attempt_no: number;
    execution_key: string;
    retry_of?: string;
    timestamp: number;
    result: "SUCCESS" | "FAILED" | "PENDING";
  }>;
  trace_gap?: {
    missing_receipt: boolean;
    missing_evidence: boolean;
  };
  skill_trace?: OperationSkillTraceItemV2[] | null;
  legacy_skill_trace?: OperationSkillTraceV1 | null;
  fallback_state?: {
    generated: boolean;
    executable: boolean;
    fallback_plan?: any;
  };
  value_attribution_v1?: {
    operation_plan_id: string;
    expected_effect?: any;
    actual_effect?: any;
    outcome?: { effect_verdict?: string; final_status?: string };
    attribution_basis?: { source_metrics: string[]; method: string };
  };
};

function normalizeSkillTraceItem(item: any): OperationSkillTraceItemV2 {
  const stage = resolveSkillClassification(item) as OperationSkillTraceStageV2;
  const status = String(item?.status ?? item?.result_status ?? item?.final_status ?? "").trim() || null;
  const rawCodes = item?.explanation_codes ?? item?.explain_codes ?? item?.reason_codes ?? [];
  const explanationCodes = Array.isArray(rawCodes)
    ? rawCodes.map((code: unknown) => String(code ?? "").trim()).filter(Boolean)
    : [];
  const startedTs = Number(item?.started_ts_ms ?? item?.started_at_ts_ms ?? item?.started_at ?? 0);
  const finishedTs = Number(item?.finished_ts_ms ?? item?.finished_at_ts_ms ?? item?.finished_at ?? 0);
  return {
    stage,
    skill_id: item?.skill_id ? String(item.skill_id) : null,
    status,
    explanation_codes: explanationCodes,
    run_id: item?.run_id ? String(item.run_id) : null,
    started_ts_ms: Number.isFinite(startedTs) && startedTs > 0 ? startedTs : null,
    finished_ts_ms: Number.isFinite(finishedTs) && finishedTs > 0 ? finishedTs : null,
  };
}

function normalizeSkillTrace(trace: any, legacy: OperationSkillTraceV1 | null | undefined): OperationSkillTraceItemV2[] {
  if (Array.isArray(trace) && trace.length > 0) return trace.map((item) => normalizeSkillTraceItem(item));
  if (!legacy) return [];
  const legacyRows: Array<{ stage: OperationSkillTraceStageV2; entry: OperationSkillTraceEntryV1 | null | undefined }> = [
    { stage: "sensing", entry: legacy.crop_skill },
    { stage: "agronomy", entry: legacy.agronomy_skill },
    { stage: "device", entry: legacy.device_skill },
    { stage: "acceptance", entry: legacy.acceptance_skill },
  ];
  return legacyRows.map(({ stage, entry }) => normalizeSkillTraceItem({
    stage,
    skill_id: entry?.skill_id ?? null,
    status: entry?.result_status ?? null,
    run_id: entry?.run_id ?? null,
    explanation_codes: entry?.error_code ? [entry.error_code] : [],
  }));
}

export type OperationEvidenceExportResponse = {
  has_bundle: boolean;
  latest_job_id?: string | null;
  latest_job_status?: string | null;
  latest_exported_at?: string | null;
  latest_bundle_name?: string | null;
  download_url?: string | null;
  jump_url?: string | null;
  missing_reason?: string | null;
};

export type OperationEvidencePackV1 = {
  operation_id: string;
  crop?: { crop_code?: string | null; crop_stage?: string | null } | null;
  decision?: { rule_id?: string | null; reason_codes?: string[] | null } | null;
  before?: { soil_moisture?: number | null } | null;
  after?: { soil_moisture?: number | null } | null;
  expected_effect?: { type?: string | null; value?: number | null } | null;
  actual_effect?: { value?: number | null } | null;
  effect_verdict?: "SUCCESS" | "PARTIAL" | "FAILED" | "NO_DATA" | string | null;
  timeline?: any[];
};

export type OperationEvidenceArtifactV1 = {
  artifact_id: string;
  act_task_id?: string | null;
  operation_plan_id?: string | null;
  kind?: string | null;
  evidence_level?: "DEBUG" | "FORMAL" | "STRONG" | string | null;
  url?: string | null;
  text?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  skill_id?: string | null;
  skill_version?: string | null;
  explanation_codes?: string[] | null;
  skill_source?: {
    source?: "skill_run_v1" | "acceptance_skill_meta" | "none" | string;
    trigger_stage?: string | null;
    run_id?: string | null;
    matched_at?: string | null;
  } | null;
};

export type OperationEvidenceBundleV1 = {
  operation_plan_id: string;
  act_task_id?: string | null;
  artifacts: OperationEvidenceArtifactV1[];
  evidence_summary?: {
    artifact_count?: number;
    level_counts?: Partial<Record<"DEBUG" | "FORMAL" | "STRONG", number>>;
  } | null;
};

export async function fetchOperationDetail(operationPlanId: string): Promise<OperationDetailResponse | null> {
  const id = String(operationPlanId ?? "").trim();
  if (!id) return null;
  const res = await apiRequest<{ ok?: boolean; item?: OperationDetailResponse; operation?: OperationDetailResponse }>(`/api/v1/operations/${encodeURIComponent(id)}/detail`);
  const detail = res?.operation ?? res?.item ?? null;
  if (!detail) return null;
  return {
    ...detail,
    skill_trace: normalizeSkillTrace((detail as any)?.skill_trace, (detail as any)?.legacy_skill_trace ?? null),
  };
}

export type OperationHandoffItem = {
  operation_plan_id: string;
  act_task_id: string;
  source_dispatch_id?: string | null;
  assignment_id: string;
  assignment_status?: string | null;
  executor_id?: string | null;
  origin_type?: string | null;
  origin_ref_id?: string | null;
  fallback_context?: any;
  created_ts_ms: number;
  updated_ts_ms: number;
};

export async function fetchOperationHandoff(operationPlanId: string): Promise<OperationHandoffItem[]> {
  const id = String(operationPlanId ?? "").trim();
  if (!id) return [];
  const res = await apiRequestOptional<{ ok?: boolean; items?: OperationHandoffItem[] }>(`/api/v1/operations/${encodeURIComponent(id)}/handoff`);
  return Array.isArray(res?.items) ? res.items : [];
}

export async function fetchOperationEvidenceExport(operationPlanId: string): Promise<OperationEvidenceExportResponse | null> {
  const id = String(operationPlanId ?? "").trim();
  if (!id) return null;
  const res = await apiRequestOptional<{ ok?: boolean; item?: OperationEvidenceExportResponse }>(`/api/v1/operations/${encodeURIComponent(id)}/evidence-export`);
  return res?.item ?? null;
}

export async function fetchOperationEvidencePack(operationId: string): Promise<OperationEvidencePackV1 | null> {
  const id = String(operationId ?? "").trim();
  if (!id) return null;
  return apiRequestOptional<OperationEvidencePackV1>(`/api/v1/operations/${encodeURIComponent(id)}/evidence`);
}

export async function fetchOperationEvidenceBundle(operationPlanId: string): Promise<OperationEvidenceBundleV1 | null> {
  const id = String(operationPlanId ?? "").trim();
  if (!id) return null;
  const res = await apiRequestOptional<{ ok?: boolean; item?: OperationEvidenceBundleV1 }>(`/api/v1/operations/${encodeURIComponent(id)}/evidence-bundle`);
  return res?.item ?? null;
}

export async function fetchTaskTrajectory(actTaskId: string): Promise<any | null> {
  const res = await apiRequestOptional<{ ok?: boolean; trajectory?: any }>(`/api/v1/tasks/${encodeURIComponent(actTaskId)}/trajectory`);
  return res?.trajectory ?? null;
}

export async function fetchOperationBilling(operationId: string): Promise<OperationBillingResponse | null> {
  const id = String(operationId ?? "").trim();
  if (!id) return null;
  return apiRequestOptional<OperationBillingResponse>(`/api/v1/billing/operation/${encodeURIComponent(id)}`);
}

export type OperationBillingResponse = { billable: boolean; charge: number };
export type ExecutionPlanV1 = {
  action_type: string;
  target: { kind: "field" | "device"; ref: string };
  parameters: Record<string, unknown>;
  execution_mode: "AUTO" | "MANUAL";
  safe_guard: { requires_approval: boolean };
  failure_strategy: { retryable: boolean; max_retries: number; fallback_action?: string };
  device_capability_check?: { supported: boolean; reason?: string };
  time_window?: { start_ts?: number; end_ts?: number };
  idempotency_key: string;
};

export async function executeOperationAction(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  operation_id: string;
  execution_plan: ExecutionPlanV1;
}): Promise<{ ok?: boolean; act_task_id?: string; idempotent?: boolean; error?: string; fallback_state?: any; fallback_action?: string }> {
  return apiRequest<{ ok?: boolean; act_task_id?: string; idempotent?: boolean; error?: string; fallback_state?: any; fallback_action?: string }>("/api/v1/actions/execute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type EvidenceReportCreateResponse = { ok?: boolean; job_id?: string };
export type EvidenceReportStatusResponse = { ok?: boolean; status?: "PENDING" | "DONE" | "FAILED"; download_url?: string | null; error?: string | null };

export async function createEvidenceReport(operationPlanId: string): Promise<EvidenceReportCreateResponse> {
  return apiRequest<EvidenceReportCreateResponse>("/api/v1/evidence-reports", {
    method: "POST",
    body: JSON.stringify({ operation_plan_id: operationPlanId }),
  });
}

export async function fetchEvidenceReportStatus(jobId: string): Promise<EvidenceReportStatusResponse> {
  return apiRequest<EvidenceReportStatusResponse>(`/api/v1/evidence-reports/${encodeURIComponent(jobId)}`);
}

export async function fetchApprovalRequests(params: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  limit?: number;
}): Promise<ApprovalRequestItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: ApprovalRequestItem[] }>(
    withQuery("/api/control/approval_request/v1/requests", params),
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function createApprovalRequest(body: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  issuer: string;
  action_type: string;
  target: string;
  time_window: { start_ts: number; end_ts: number };
  parameter_schema: { keys: string[] };
  parameters: Record<string, unknown>;
  constraints: Record<string, unknown>;
  meta: Record<string, unknown>;
}): Promise<{ ok?: boolean; request_id?: string; error?: string }> {
  return apiRequest<{ ok?: boolean; request_id?: string; error?: string }>("/api/control/approval_request/v1/request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approveApprovalRequest(requestId: string): Promise<{ ok?: boolean; act_task_id?: string; error?: string }> {
  return apiRequest<{ ok?: boolean; act_task_id?: string; error?: string }>("/api/control/approval_request/v1/approve", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
}
