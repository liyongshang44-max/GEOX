import { apiRequest, apiRequestOptional, apiRequestWithPolicy, request, withQuery } from "./client";
import { readStoredAoActToken } from "../lib/api";

export type ProgramStateItemV1 = any;
export type ProgramPortfolioItemV1 = any;
export type SchedulingConflictItemV1 = any;
export type SchedulingHintItemV1 = any;

export type ControlPlaneStatus = {
  code?: string | null;
  label?: string | null;
  tone?: "success" | "warning" | "neutral" | "danger" | "info" | null;
};

export type ProgramControlPlaneItem = {
  program?: {
    program_id?: string;
    title?: string;
    subtitle?: string;
    field_id?: string;
    season_id?: string;
    crop_code?: string;
    status?: ControlPlaneStatus;
    updated_ts_ms?: number;
    updated_at_label?: string;
  };
  summary?: {
    recommendation?: ControlPlaneStatus;
    approval?: ControlPlaneStatus;
    operation_plan?: ControlPlaneStatus;
    execution?: ControlPlaneStatus;
    receipt?: ControlPlaneStatus;
    evidence?: ControlPlaneStatus;
  };
  next_action?: { title?: string; description?: string; priority?: string };
  risk_summary?: Array<{ code?: string; label?: string; severity?: string; description?: string }>;
  decision_timeline?: Array<{ kind?: string; title?: string; status?: ControlPlaneStatus; ts_ms?: number; ts_label?: string; summary?: string; refs?: Record<string, string> }>;
  execution_timeline?: Array<{ kind?: string; title?: string; status?: ControlPlaneStatus; ts_ms?: number; ts_label?: string; summary?: string; refs?: Record<string, string> }>;
  evidence?: {
    status?: ControlPlaneStatus;
    recent_items?: Array<{ kind?: string; title?: string; summary?: string; ts_ms?: number; downloadable?: boolean }>;
    export_jobs?: Array<{ job_id?: string; status?: string; label?: string; download_url?: string | null }>;
  };
  resources?: { water_l?: number; electric_kwh?: number; fuel_l?: number; chemical_ml?: number };
  execution_result?: { result_label?: string; constraint_check?: { violated?: boolean; violations?: unknown[] }; observed_parameters?: Record<string, unknown> };
  technical_details?: Record<string, unknown>;
};

const unsupportedProgramControlPlaneIds = new Set<string>();


export type ProgramCreateInput = {
  program_name: string;
  field_id: string;
  season_id: string;
  crop_code: "corn" | "tomato";
  goal_quality: "low" | "medium" | "high";
  goal_yield: "low" | "medium" | "high";
  constraints_notes?: string;
};

export async function createProgram(input: ProgramCreateInput): Promise<{ ok: boolean; program_id: string; fact_id: string }> {
  const normalizedProgramName = String(input.program_name ?? "").trim();
  const body = {
    name: normalizedProgramName,
    field_id: input.field_id,
    season_id: input.season_id,
    crop_code: input.crop_code,
    status: "DRAFT",
    goal_profile: {
      yield_priority: input.goal_yield || "medium",
      quality_priority: input.goal_quality || "medium",
      residue_priority: "medium",
      water_saving_priority: "medium",
      cost_priority: "medium",
    },
    constraints: {
      forbid_pesticide_classes: [],
      forbid_fertilizer_types: [],
      manual_approval_required_for: [],
      allow_night_irrigation: false,
      max_irrigation_rounds_per_day: 3,
      notes: String(input.constraints_notes ?? ""),
      max_irrigation_mm_per_day: null,
    },
    budget: {
      max_cost_total: null,
      currency: "CNY",
    },
    execution_policy: {
      mode: "approval_required",
      auto_execute_allowed_task_types: [],
    },
  };
  return apiRequest<{ ok: boolean; program_id: string; fact_id: string }>("/api/v1/programs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchPrograms(params?: Record<string, unknown>): Promise<ProgramStateItemV1[]> {
  const res = await apiRequest<{ ok?: boolean; items?: ProgramStateItemV1[] }>(withQuery("/api/v1/programs", params));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchProgramPortfolio(params?: Record<string, unknown>): Promise<ProgramPortfolioItemV1[]> {
  const res = await apiRequest<{ ok?: boolean; items?: ProgramPortfolioItemV1[] }>(withQuery("/api/v1/program-portfolio", params));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchProgramDetail(programId: string): Promise<ProgramStateItemV1 | null> {
  const res = await apiRequestWithPolicy<{ ok?: boolean; item?: ProgramStateItemV1 }>(
    `/api/v1/programs/${encodeURIComponent(programId)}`,
    undefined,
    { allowedStatuses: [404], dedupe: true },
  );
  return res.ok ? (res.data?.item ?? null) : null;
}

export async function fetchProgramControlPlane(programId: string): Promise<ProgramControlPlaneItem | null> {
  if (unsupportedProgramControlPlaneIds.has(programId)) return null;
  const res = await request<{ ok?: boolean; item?: ProgramControlPlaneItem }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/control-plane`,
    undefined,
    { allow404: true, dedupe: true, silent: true },
  );
  if (!res.ok && res.status === 404) {
    unsupportedProgramControlPlaneIds.add(programId);
    return null;
  }
  return res.ok ? (res.data?.item ?? null) : null;
}

export async function fetchProgramTrajectories(programId: string): Promise<any[]> {
  const res = await apiRequestOptional<{ ok?: boolean; items?: any[] }>(`/api/v1/programs/${encodeURIComponent(programId)}/trajectories`);
  return Array.isArray(res?.items) ? res.items : [];
}

export async function fetchProgramCost(programId: string): Promise<any | null> {
  const res = await apiRequestOptional<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/cost`);
  return res?.item ?? null;
}

export async function fetchProgramSla(programId: string): Promise<any | null> {
  const res = await apiRequestOptional<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/sla`);
  return res?.item ?? null;
}

export async function fetchProgramEfficiency(programId: string): Promise<any | null> {
  const res = await apiRequestOptional<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/efficiency`);
  return res?.item ?? null;
}

export async function fetchSchedulingConflicts(): Promise<SchedulingConflictItemV1[]> {
  const res = await apiRequest<{ ok?: boolean; items?: SchedulingConflictItemV1[] }>("/api/v1/scheduling/conflicts");
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchSchedulingHints(): Promise<SchedulingHintItemV1[]> {
  const res = await apiRequest<{ ok?: boolean; items?: SchedulingHintItemV1[] }>("/api/v1/scheduling/hints");
  return Array.isArray(res.items) ? res.items : [];
}


export type AgronomyRecommendationItemV1 = {
  fact_id: string;
  occurred_at: string;
  recommendation_id: string;
  approval_request_id?: string | null;
  operation_plan_id?: string | null;
  act_task_id?: string | null;
  receipt_fact_id?: string | null;
  latest_status?: string | null;
  field_id: string | null;
  season_id: string | null;
  device_id: string | null;
  recommendation_type: string | null;
  status: string;
  reason_codes: string[];
  evidence_refs: string[];
  rule_hit: Array<{ rule_id: string; matched: boolean; threshold?: number | null; actual?: number | null }>;
  confidence: number | null;
  model_version: string | null;
  suggested_action: { action_type: string; summary: string; parameters: Record<string, unknown> } | null;
};

export async function fetchAgronomyRecommendations(params?: {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  limit?: number;
}): Promise<{ ok: boolean; items: AgronomyRecommendationItemV1[]; count: number }> {
  const token = readStoredAoActToken();
  return apiRequest<{ ok: boolean; items: AgronomyRecommendationItemV1[]; count: number }>(withQuery('/api/v1/agronomy/recommendations', {
    tenant_id: params?.tenant_id,
    project_id: params?.project_id,
    group_id: params?.group_id,
    limit: params?.limit ?? 50,
  }), { headers: { Authorization: `Bearer ${token}` } });
}

export async function fetchAgronomyRecommendationDetail(params: {
  recommendation_id: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
}): Promise<{ ok: boolean; item: AgronomyRecommendationItemV1 }> {
  const token = readStoredAoActToken();
  return apiRequest<{ ok: boolean; item: AgronomyRecommendationItemV1 }>(
    withQuery(`/api/v1/agronomy/recommendations/${encodeURIComponent(params.recommendation_id)}`, {
      tenant_id: params.tenant_id,
      project_id: params.project_id,
      group_id: params.group_id,
    }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export type AgronomyRecommendationControlPlaneListItem = any;
export type AgronomyRecommendationControlPlaneDetailItem = any;

export async function fetchAgronomyRecommendationsControlPlane(params?: {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  field_id?: string;
  limit?: number;
}): Promise<{ ok: boolean; summary: { total: number; pending: number; in_approval: number; receipted: number }; items: AgronomyRecommendationControlPlaneListItem[] }> {
  const token = readStoredAoActToken();
  return apiRequest<{ ok: boolean; summary: { total: number; pending: number; in_approval: number; receipted: number }; items: AgronomyRecommendationControlPlaneListItem[] }>(
    withQuery("/api/v1/agronomy/recommendations/control-plane", {
      tenant_id: params?.tenant_id,
      project_id: params?.project_id,
      group_id: params?.group_id,
      field_id: params?.field_id,
      limit: params?.limit ?? 50,
    }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function fetchAgronomyRecommendationDetailControlPlane(params: {
  recommendation_id: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
}): Promise<{ ok: boolean; item: AgronomyRecommendationControlPlaneDetailItem }> {
  const token = readStoredAoActToken();
  return apiRequest<{ ok: boolean; item: AgronomyRecommendationControlPlaneDetailItem }>(
    withQuery(`/api/v1/agronomy/recommendations/${encodeURIComponent(params.recommendation_id)}/control-plane`, {
      tenant_id: params.tenant_id,
      project_id: params.project_id,
      group_id: params.group_id,
    }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function submitRecommendationApproval(params: {
  recommendation_id: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  rationale?: string;
}): Promise<{ ok: boolean; recommendation_id: string; approval_request_id: string; operation_plan_id: string; operation_plan_fact_id: string }> {
  const token = readStoredAoActToken();
  return apiRequest<{ ok: boolean; recommendation_id: string; approval_request_id: string; operation_plan_id: string; operation_plan_fact_id: string }>(
    withQuery(`/api/v1/recommendations/${encodeURIComponent(params.recommendation_id)}/submit-approval`, {
      tenant_id: params.tenant_id,
      project_id: params.project_id,
      group_id: params.group_id,
    }),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tenant_id: params.tenant_id,
        project_id: params.project_id,
        group_id: params.group_id,
        rationale: params.rationale ?? "Submitted from recommendations console",
      }),
    }
  );
}
