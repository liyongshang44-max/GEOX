import { apiRequest, apiRequestOptional } from "./client";
import type { ControlPlaneStatus } from "./programs";

export type FieldListItem = any;
export type FieldDetail = any;

export type FieldControlPlaneItem = {
  field?: {
    field_id?: string;
    field_name?: string;
    area_ha?: number;
    status?: ControlPlaneStatus;
    subtitle?: string;
  };
  current_context?: {
    season_id?: string;
    season_label?: string;
    active_program_id?: string;
    active_program_title?: string;
    crop_code?: string;
    updated_ts_ms?: number;
    updated_at_label?: string;
  };
  summary?: {
    device_count?: number;
    latest_operation?: { title?: string; status?: ControlPlaneStatus; updated_at_label?: string };
    alert_count?: number;
    risk_state?: { code?: string; label?: string; tone?: string };
  };
  overview?: {
    field_name?: string;
    area_ha?: number;
    current_season?: string;
    active_program?: { program_id?: string; title?: string };
    status?: ControlPlaneStatus;
    device_count?: number;
    latest_operation?: string;
    alert_count?: number;
    risk_label?: string;
  };
  map?: {
    geojson?: any;
    device_tracks?: any[];
    operation_tracks?: any[];
    heatmap_points?: any[];
  };
  operations?: Array<{ operation_plan_id?: string; title?: string; status?: ControlPlaneStatus; program_id?: string; act_task_id?: string; updated_ts_ms?: number; updated_at_label?: string }>;
  alerts?: Array<{ alert_id?: string; title?: string; severity?: string; status?: string; ts_label?: string }>;
  devices?: Array<{ device_id?: string; display_name?: string; connection_status?: ControlPlaneStatus; last_heartbeat_label?: string; last_telemetry_label?: string }>;
  season_program_summary?: { title?: string; items?: Array<{ program_id?: string; title?: string; status?: ControlPlaneStatus }> };
  technical_details?: Record<string, unknown>;
};

export async function fetchFields(): Promise<FieldListItem[]> {
  const res = await apiRequest<{ ok?: boolean; items?: FieldListItem[]; fields?: FieldListItem[] }>("/api/v1/fields");
  if (Array.isArray(res.items)) return res.items;
  return Array.isArray(res.fields) ? res.fields : [];
}

export async function fetchFieldDetail(fieldId: string): Promise<FieldDetail | null> {
  return apiRequestOptional<FieldDetail>(`/api/v1/fields/${encodeURIComponent(fieldId)}`, undefined, {
    allowedStatuses: [404],
    dedupe: true,
  });
}

export async function fetchFieldControlPlane(fieldId: string): Promise<FieldControlPlaneItem | null> {
  const res = await apiRequestOptional<{ ok?: boolean; item?: FieldControlPlaneItem }>(
    `/api/v1/fields/${encodeURIComponent(fieldId)}/control-plane`,
    undefined,
    { allowedStatuses: [404], dedupe: true },
  );
  return res?.item ?? null;
}

export async function fetchFieldGeometry(fieldId: string): Promise<any> {
  const res = await apiRequestOptional<any>(
    `/api/v1/fields/${encodeURIComponent(fieldId)}/geometry`,
    undefined,
    { allowedStatuses: [404, 422], dedupe: true },
  );
  return res;
}

export async function fetchFieldProgramsBySeason(fieldId: string): Promise<Array<{ season_id: string; count: number; programs: any[] }>> {
  const res = await apiRequest<{ ok?: boolean; seasons?: Array<{ season_id: string; count: number; programs: any[] }> }>(`/api/v1/fields/${encodeURIComponent(fieldId)}/programs/by-season`);
  return Array.isArray(res.seasons) ? res.seasons : [];
}

export async function fetchFieldCurrentProgram(fieldId: string): Promise<any | null> {
  const res = await apiRequestOptional<{ ok?: boolean; item?: any }>(
    `/api/v1/fields/${encodeURIComponent(fieldId)}/current-program`,
    undefined,
    { allowedStatuses: [404], dedupe: true },
  );
  return res?.item ?? null;
}
