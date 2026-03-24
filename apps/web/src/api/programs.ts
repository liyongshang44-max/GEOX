import { requestJson, withQuery } from "./client";

export type ProgramStateItemV1 = any;
export type ProgramPortfolioItemV1 = any;
export type SchedulingConflictItemV1 = any;
export type SchedulingHintItemV1 = any;

export async function fetchPrograms(params?: Record<string, unknown>): Promise<ProgramStateItemV1[]> {
  const res = await requestJson<{ ok?: boolean; items?: ProgramStateItemV1[] }>(withQuery("/api/v1/programs", params));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchProgramPortfolio(params?: Record<string, unknown>): Promise<ProgramPortfolioItemV1[]> {
  const res = await requestJson<{ ok?: boolean; items?: ProgramPortfolioItemV1[] }>(withQuery("/api/v1/program-portfolio", params));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchProgramDetail(programId: string): Promise<ProgramStateItemV1 | null> {
  const res = await requestJson<{ ok?: boolean; item?: ProgramStateItemV1 }>(`/api/v1/programs/${encodeURIComponent(programId)}`);
  return res.item ?? null;
}

export async function fetchProgramTrajectories(programId: string): Promise<any[]> {
  const res = await requestJson<{ ok?: boolean; items?: any[] }>(`/api/v1/programs/${encodeURIComponent(programId)}/trajectories`);
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchProgramCost(programId: string): Promise<any | null> {
  const res = await requestJson<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/cost`);
  return res.item ?? null;
}

export async function fetchProgramSla(programId: string): Promise<any | null> {
  const res = await requestJson<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/sla`);
  return res.item ?? null;
}

export async function fetchProgramEfficiency(programId: string): Promise<any | null> {
  const res = await requestJson<{ ok?: boolean; item?: any }>(`/api/v1/programs/${encodeURIComponent(programId)}/efficiency`);
  return res.item ?? null;
}

export async function fetchSchedulingConflicts(): Promise<SchedulingConflictItemV1[]> {
  const res = await requestJson<{ ok?: boolean; items?: SchedulingConflictItemV1[] }>("/api/v1/scheduling/conflicts");
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchSchedulingHints(): Promise<SchedulingHintItemV1[]> {
  const res = await requestJson<{ ok?: boolean; items?: SchedulingHintItemV1[] }>("/api/v1/scheduling/hints");
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
  return requestJson<{ ok: boolean; items: AgronomyRecommendationItemV1[]; count: number }>(withQuery('/api/v1/agronomy/recommendations', {
    tenant_id: params?.tenant_id,
    project_id: params?.project_id,
    group_id: params?.group_id,
    limit: params?.limit ?? 50,
  }));
}
