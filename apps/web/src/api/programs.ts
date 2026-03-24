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
