import { apiRequest } from "./client";

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

export type FlightTableApiSnapshotV1 = FlightTableApiSnapshotRefV1 & {
  run_id: string;
  request?: unknown;
  response?: unknown;
  error?: string;
};

export type CreateFlightTableRunRequestV1 = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  lane: FlightTableLaneV1;
};

export async function createFlightTableRun(body: CreateFlightTableRunRequestV1): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>("/api/v1/dev/flight-table/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.run;
}

export async function fetchFlightTableRuns(): Promise<FlightTableRunV1[]> {
  const res = await apiRequest<{ ok: boolean; runs: FlightTableRunV1[] }>("/api/v1/dev/flight-table/runs");
  return Array.isArray(res.runs) ? res.runs : [];
}

export async function fetchFlightTableRun(runId: string): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}`);
  return res.run;
}

export async function verifyFlightTableRun(runId: string): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/verify`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.run;
}

export async function cleanFlightTableRun(runId: string): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/clean`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.run;
}

export async function retryFlightTableStep(runId: string, stepKey: string): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepKey)}/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.run;
}

export async function fetchFlightTableManifest(runId: string): Promise<FlightTableManifestV1> {
  const res = await apiRequest<{ ok: boolean; manifest: FlightTableManifestV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/manifest`);
  return res.manifest;
}

export async function fetchFlightTableVerifyReport(runId: string): Promise<Record<string, unknown>> {
  const res = await apiRequest<{ ok: boolean; verify_report: Record<string, unknown> }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/verify-report`);
  return res.verify_report;
}

export async function fetchFlightTableApiSnapshots(runId: string): Promise<FlightTableApiSnapshotV1[]> {
  const res = await apiRequest<{ ok: boolean; snapshots: FlightTableApiSnapshotV1[] }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/api-snapshots`);
  return Array.isArray(res.snapshots) ? res.snapshots : [];
}
