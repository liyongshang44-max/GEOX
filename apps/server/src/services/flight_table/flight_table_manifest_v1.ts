export type FlightTableRunStatusV1 = "DRAFT" | "READY" | "RUNNING" | "PASS" | "FAIL" | "CLEANED";
export type FlightTableLaneV1 = "success" | "evidence_insufficient" | "weather_interference" | "skill_failure" | "all";
export type FlightTableStepStatusV1 = "PENDING" | "RUNNING" | "PASS" | "FAIL" | "SKIPPED";

export type FlightTableStepV1 = {
  step_key: string;
  label: string;
  status: FlightTableStepStatusV1;
  verify_result?: "PASS" | "FAIL" | "PENDING" | "SKIPPED";
  message?: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
};

export type FlightTableCredentialRefV1 = {
  credential_id: string;
  status: string;
  issued_at?: string;
  masked_secret: "****";
};

export type FlightTableApiSnapshotRefV1 = {
  snapshot_id: string;
  method: string;
  path: string;
  ok: boolean;
  status_code?: number;
  created_at: string;
  label?: string;
};

export type FlightTableManifestV1 = {
  field_id: string | null;
  season_id: string | null;
  crop: string | null;
  crop_stage: string | null;
  geometry_id: string | null;
  device_ids: string[];
  credential_ids: FlightTableCredentialRefV1[];
  skill_binding_ids: string[];
  skill_run_ids: string[];
  recommendation_ids: string[];
  prescription_ids: string[];
  approval_request_ids: string[];
  operation_plan_ids: string[];
  act_task_ids: string[];
  receipt_ids: string[];
  evidence_ids: string[];
  acceptance_ids: string[];
  evidence_export_job_ids: string[];
  roi_ids: string[];
  field_memory_ids: string[];
  api_snapshot_refs: FlightTableApiSnapshotRefV1[];
  ui_urls: string[];
};

export type FlightVerifySummaryV1 = {
  ok: boolean;
  status: "PENDING" | "PASS" | "FAIL";
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pending_steps: number;
  skipped_steps: number;
  errors: string[];
  warnings: string[];
  updated_at: string;
};

export type FlightTableRunV1 = {
  run_id: string;
  status: FlightTableRunStatusV1;
  lane: FlightTableLaneV1;
  tenant_id: string;
  project_id: string;
  group_id: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  current_step?: string;
  steps: FlightTableStepV1[];
  manifest: FlightTableManifestV1;
  verify_summary: FlightVerifySummaryV1;
};

export function createEmptyFlightTableManifestV1(): FlightTableManifestV1 {
  return {
    field_id: null,
    season_id: null,
    crop: null,
    crop_stage: null,
    geometry_id: null,
    device_ids: [],
    credential_ids: [],
    skill_binding_ids: [],
    skill_run_ids: [],
    recommendation_ids: [],
    prescription_ids: [],
    approval_request_ids: [],
    operation_plan_ids: [],
    act_task_ids: [],
    receipt_ids: [],
    evidence_ids: [],
    acceptance_ids: [],
    evidence_export_job_ids: [],
    roi_ids: [],
    field_memory_ids: [],
    api_snapshot_refs: [],
    ui_urls: [],
  };
}

export function sanitizeFlightCredentialRefV1(input: any): FlightTableCredentialRefV1 | null {
  const credential_id = typeof input?.credential_id === "string" ? input.credential_id.trim() : "";
  if (!credential_id) return null;
  return {
    credential_id,
    status: typeof input?.status === "string" && input.status.trim() ? input.status.trim() : "UNKNOWN",
    issued_at: typeof input?.issued_at === "string" && input.issued_at.trim() ? input.issued_at.trim() : undefined,
    masked_secret: "****",
  };
}

function stringArray(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((v) => String(v ?? "").trim()).filter(Boolean)));
}

function snapshotArray(input: any): FlightTableApiSnapshotRefV1[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      snapshot_id: String(item?.snapshot_id ?? "").trim(),
      method: String(item?.method ?? "GET").trim().toUpperCase(),
      path: String(item?.path ?? "").trim(),
      ok: Boolean(item?.ok),
      status_code: Number.isFinite(Number(item?.status_code)) ? Number(item.status_code) : undefined,
      created_at: typeof item?.created_at === "string" && item.created_at.trim() ? item.created_at.trim() : new Date().toISOString(),
      label: typeof item?.label === "string" && item.label.trim() ? item.label.trim() : undefined,
    }))
    .filter((item) => item.snapshot_id && item.path);
}

export function sanitizeFlightTableManifestV1(input: any): FlightTableManifestV1 {
  const credential_ids = Array.isArray(input?.credential_ids)
    ? input.credential_ids.map(sanitizeFlightCredentialRefV1).filter((item): item is FlightTableCredentialRefV1 => Boolean(item))
    : [];
  return {
    field_id: typeof input?.field_id === "string" && input.field_id.trim() ? input.field_id.trim() : null,
    season_id: typeof input?.season_id === "string" && input.season_id.trim() ? input.season_id.trim() : null,
    crop: typeof input?.crop === "string" && input.crop.trim() ? input.crop.trim() : null,
    crop_stage: typeof input?.crop_stage === "string" && input.crop_stage.trim() ? input.crop_stage.trim() : null,
    geometry_id: typeof input?.geometry_id === "string" && input.geometry_id.trim() ? input.geometry_id.trim() : null,
    device_ids: stringArray(input?.device_ids),
    credential_ids,
    skill_binding_ids: stringArray(input?.skill_binding_ids),
    skill_run_ids: stringArray(input?.skill_run_ids),
    recommendation_ids: stringArray(input?.recommendation_ids),
    prescription_ids: stringArray(input?.prescription_ids),
    approval_request_ids: stringArray(input?.approval_request_ids),
    operation_plan_ids: stringArray(input?.operation_plan_ids),
    act_task_ids: stringArray(input?.act_task_ids),
    receipt_ids: stringArray(input?.receipt_ids),
    evidence_ids: stringArray(input?.evidence_ids),
    acceptance_ids: stringArray(input?.acceptance_ids),
    evidence_export_job_ids: stringArray(input?.evidence_export_job_ids),
    roi_ids: stringArray(input?.roi_ids),
    field_memory_ids: stringArray(input?.field_memory_ids),
    api_snapshot_refs: snapshotArray(input?.api_snapshot_refs),
    ui_urls: stringArray(input?.ui_urls),
  };
}
