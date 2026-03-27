import { apiRequest, withQuery } from "./client";

export type EvidenceJob = {
  job_id: string;
  status: string;
  scope_type?: string | null;
  scope_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  artifact_sha256?: string | null;
};

export async function fetchEvidenceJobs(limit = 50): Promise<EvidenceJob[]> {
  const res = await apiRequest<{ ok?: boolean; items?: EvidenceJob[]; jobs?: EvidenceJob[] }>(withQuery("/api/v1/evidence-export/jobs", { limit }));
  if (Array.isArray(res.items)) return res.items;
  return Array.isArray(res.jobs) ? res.jobs : [];
}

export async function fetchRecentEvidenceControlPlane(limit = 30): Promise<any[]> {
  const res = await apiRequest<{ ok?: boolean; items?: any[] }>(withQuery("/api/v1/dashboard/evidence/recent", { limit }));
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchEvidenceControlPlane(params?: { limit?: number; program_id?: string; operation_plan_id?: string }): Promise<{ ok: boolean; item: any }> {
  return apiRequest<{ ok: boolean; item: any }>(withQuery("/api/v1/evidence/control-plane", params));
}
