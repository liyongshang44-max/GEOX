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

export type FlightTableWeatherLocationV1 = {
  lat: number;
  lng: number;
};

export type FlightTableDeviceTemplateV1 = {
  template_code: string;
  formal_template_code: string;
  device_type: string;
  capabilities: string[];
  required_observation_skills: string[];
  default_metrics: Array<{ metric: string; value: number | string | boolean; unit: string | null }>;
  default_mode: "simulator" | "physical";
};

export type FlightTableDeviceStepResultV1 = {
  step_key: string;
  status: "PASS" | "FAIL";
  source: "FORMAL_ROUTE_COMPAT" | "FORMAL_SERVICE" | "DEV_HELPER";
  message: string;
};

export type FlightTableDeviceSummaryV1 = {
  device_id: string;
  device_type: string;
  template_code: string;
  mode: "simulator" | "physical";
  credential_id: string;
  credential_status: string;
  masked_secret: "****";
  online_status: "ONLINE" | "OFFLINE";
  last_heartbeat: string | null;
  last_telemetry: string | null;
  field_binding: string | null;
  capabilities: string[];
  required_observation_skills: string[];
  last_telemetry_metrics: Array<{ metric: string; value: number | string | boolean | null; unit: string | null }>;
  projection_status: "READY" | "PARTIAL" | "FAIL";
  sources: string[];
  steps: FlightTableDeviceStepResultV1[];
};

export type FlightTableDevicesResponseV1 = {
  ok: boolean;
  field_id: string;
  devices: FlightTableDeviceSummaryV1[];
  templates: FlightTableDeviceTemplateV1[];
  verify: {
    raw_telemetry_visible: boolean;
    observation_visible: boolean;
    sensing_visible: boolean;
    source_notes: string[];
  };
  run: FlightTableRunV1;
};

export type FlightTableSkillFailureTypeV1 = "missing_sensing_skill" | "device_skill_disabled" | "acceptance_skill_failed";
export type FlightTableSkillClassificationV1 = "sensing" | "agronomy" | "device" | "acceptance";

export type FlightTableSkillAssemblyItemV1 = {
  skill_id: string;
  version: string;
  classification: FlightTableSkillClassificationV1;
  bind_target: string;
  scope_type: "TENANT" | "FIELD" | "DEVICE" | "OPERATION";
  trigger_stage: string;
  required_for: string;
  binding_id: string;
  status: "ACTIVE" | "DISABLED" | "MISSING" | "FAILED";
  binding_scope: string;
  missing_reason: string | null;
  source: "FORMAL_SKILL_BINDING" | "DEV_FAILURE_INJECTION";
};

export type FlightTableSkillAssemblyResponseV1 = {
  ok: boolean;
  operation_id: string;
  items: FlightTableSkillAssemblyItemV1[];
  binding_ids: string[];
  skill_run_ids: string[];
  missing_required_observation_skills: string[];
  failure?: {
    failure_type: FlightTableSkillFailureTypeV1;
    failure_reason: "binding_invalid" | "skill_run_failed" | "missing_required_observation_skill";
    failed_skill_id: string;
    trace_visible: boolean;
    performance_visible: boolean;
  };
  verify: {
    bindings_visible: boolean;
    trace_visible: boolean;
    performance_visible: boolean;
    operator_trace_url: string;
    operator_performance_url: string;
  };
  run: FlightTableRunV1;
};

export type CreateFlightTableRunRequestV1 = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  lane: FlightTableLaneV1;
};

export type CreateFlightTableFieldRequestV1 = {
  field_id: string;
  field_name: string;
  crop: string;
  crop_stage: string;
  season_id: string;
};

export type CreateFlightTableFieldResponseV1 = {
  ok: boolean;
  field_id: string;
  field_name: string;
  customer_visible: boolean;
  report_visible: boolean;
  customer_scope: "FALLBACK_OR_UNCONFIRMED" | "CONFIRMED";
  run: FlightTableRunV1;
};

export type CreateFlightTableGeometryRequestV1 = {
  field_id: string;
  geometry_format: "GEOJSON";
  geometry: unknown;
  weather_location?: FlightTableWeatherLocationV1 | null;
};

export type CreateFlightTableGeometryResponseV1 = {
  ok: boolean;
  field_id: string;
  geometry_id: string;
  geometry_status: "AVAILABLE" | "MISSING" | "INVALID";
  geometry_format: "GEOJSON";
  geometry: Record<string, unknown>;
  centroid: { lat: number; lng: number };
  area_m2: number | null;
  area_mu: number | null;
  weather_location: FlightTableWeatherLocationV1 | null;
  weather_provider_status: "UNAVAILABLE";
  weather_location_status: "LOCATION_RECORDED" | "LOCATION_UNAVAILABLE";
  run: FlightTableRunV1;
};

export type CreateFlightTableDevicesRequestV1 = {
  field_id: string;
  template_code: string;
  device_id?: string;
  mode?: "simulator" | "physical";
  telemetry_mode?: "fast" | "realistic";
};

export async function createFlightTableRun(body: CreateFlightTableRunRequestV1): Promise<FlightTableRunV1> {
  const res = await apiRequest<{ ok: boolean; run: FlightTableRunV1 }>("/api/v1/dev/flight-table/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.run;
}

export async function createFlightTableField(runId: string, body: CreateFlightTableFieldRequestV1): Promise<CreateFlightTableFieldResponseV1> {
  return apiRequest<CreateFlightTableFieldResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/field`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createFlightTableGeometry(runId: string, body: CreateFlightTableGeometryRequestV1): Promise<CreateFlightTableGeometryResponseV1> {
  return apiRequest<CreateFlightTableGeometryResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/field-geometry`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchFlightTableDeviceTemplates(): Promise<FlightTableDeviceTemplateV1[]> {
  const res = await apiRequest<{ ok: boolean; templates: FlightTableDeviceTemplateV1[] }>("/api/v1/dev/flight-table/device-templates");
  return Array.isArray(res.templates) ? res.templates : [];
}

export async function createFlightTableDevices(runId: string, body: CreateFlightTableDevicesRequestV1): Promise<FlightTableDevicesResponseV1> {
  return apiRequest<FlightTableDevicesResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/devices`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function bindFlightTableSkills(runId: string): Promise<FlightTableSkillAssemblyResponseV1> {
  return apiRequest<FlightTableSkillAssemblyResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/skills/bind`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function failOneFlightTableSkill(runId: string, failureType: FlightTableSkillFailureTypeV1): Promise<FlightTableSkillAssemblyResponseV1> {
  return apiRequest<FlightTableSkillAssemblyResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/skills/fail-one`, {
    method: "POST",
    body: JSON.stringify({ failure_type: failureType }),
  });
}

export async function restoreFlightTableSkills(runId: string): Promise<FlightTableSkillAssemblyResponseV1> {
  return apiRequest<FlightTableSkillAssemblyResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/skills/restore`, {
    method: "POST",
    body: JSON.stringify({}),
  });
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
