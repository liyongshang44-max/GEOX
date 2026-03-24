import { apiRequest } from "./client";

export type FieldListItem = any;
export type FieldDetail = any;

export async function fetchFields(): Promise<FieldListItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: FieldListItem[]; fields?: FieldListItem[] }>("/api/v1/fields");
  if (Array.isArray(res.items)) return res.items;
  return Array.isArray(res.fields) ? res.fields : [];
}

export async function fetchFieldDetail(fieldId: string): Promise<FieldDetail> {
  return apiRequest<FieldDetail>(`/api/v1/fields/${encodeURIComponent(fieldId)}`);
}

export async function fetchFieldGeometry(fieldId: string): Promise<any> {
  return apiRequest<any>(`/api/v1/fields/${encodeURIComponent(fieldId)}/geometry`);
}

export async function fetchFieldProgramsBySeason(fieldId: string): Promise<Array<{ season_id: string; count: number; programs: any[] }>> {
  const res = await apiRequest<{ ok?: boolean; seasons?: Array<{ season_id: string; count: number; programs: any[] }> }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/programs/by-season`);
  return Array.isArray(res.seasons) ? res.seasons : [];
}

export async function fetchFieldCurrentProgram(fieldId: string): Promise<any | null> {
  const res = await apiRequest<{ ok?: boolean; item?: any }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/current-program`);
  return res.item ?? null;
}
