export type FormalScenarioTypeV1 = "FORMAL_IRRIGATION" | "DEVICE_ANOMALY" | "FORMAL_VARIABLE_OPERATION" | "FORMAL_FERTILIZATION";
export type FormalScenarioLaneV1 = "positive" | "negative" | "anomaly" | "partial";
export type FormalScenarioRunStatusV1 = "RUNNING" | "PASSED" | "FAILED";

export type FormalScenarioApiSnapshotV1 = {
  snapshot_id: string;
  method: string;
  path: string;
  ok: boolean;
  status_code?: number;
  created_at: number;
  label?: string;
  request?: unknown;
  response?: unknown;
};

export type FormalScenarioRunV1 = {
  run_id: string;
  scenario_type: FormalScenarioTypeV1;
  lane: FormalScenarioLaneV1;
  tenant_id: string;
  project_id: string;
  group_id: string;
  created_at: number;
  status: FormalScenarioRunStatusV1;
};

export type FormalScenarioManifestV1 = {
  run_id: string;
  field_id: string | null;
  device_id: string | null;
  credential_id: string | null;
  zone_ids: string[];
  operation_id: string | null;
  recommendation_id: string | null;
  prescription_id: string | null;
  approval_request_id: string | null;
  act_task_id: string | null;
  receipt_id: string | null;
  acceptance_id: string | null;
  evidence_refs: string[];
  api_snapshots: FormalScenarioApiSnapshotV1[];
};

function cleanString(input: unknown): string | null {
  const value = String(input ?? "").trim();
  return value ? value : null;
}

function uniqueStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean)));
}

function normalizeSnapshot(input: any): FormalScenarioApiSnapshotV1 | null {
  const snapshot_id = cleanString(input?.snapshot_id);
  const method = cleanString(input?.method)?.toUpperCase();
  const path = cleanString(input?.path);
  if (!snapshot_id || !method || !path) return null;
  const created_at = Number(input?.created_at ?? Date.now());
  return {
    snapshot_id,
    method,
    path,
    ok: Boolean(input?.ok),
    status_code: Number.isFinite(Number(input?.status_code)) ? Number(input.status_code) : undefined,
    created_at: Number.isFinite(created_at) ? created_at : Date.now(),
    label: cleanString(input?.label) ?? undefined,
    request: input?.request,
    response: input?.response,
  };
}

export function createFormalScenarioManifestV1(run_id: string): FormalScenarioManifestV1 {
  return {
    run_id,
    field_id: null,
    device_id: null,
    credential_id: null,
    zone_ids: [],
    operation_id: null,
    recommendation_id: null,
    prescription_id: null,
    approval_request_id: null,
    act_task_id: null,
    receipt_id: null,
    acceptance_id: null,
    evidence_refs: [],
    api_snapshots: [],
  };
}

export function sanitizeFormalScenarioManifestV1(input: any): FormalScenarioManifestV1 {
  const base = createFormalScenarioManifestV1(cleanString(input?.run_id) ?? "fsr_unknown");
  const snapshots = Array.isArray(input?.api_snapshots)
    ? input.api_snapshots.map(normalizeSnapshot).filter((x: FormalScenarioApiSnapshotV1 | null): x is FormalScenarioApiSnapshotV1 => Boolean(x))
    : [];
  return {
    ...base,
    field_id: cleanString(input?.field_id),
    device_id: cleanString(input?.device_id),
    credential_id: cleanString(input?.credential_id),
    zone_ids: uniqueStrings(input?.zone_ids),
    operation_id: cleanString(input?.operation_id),
    recommendation_id: cleanString(input?.recommendation_id),
    prescription_id: cleanString(input?.prescription_id),
    approval_request_id: cleanString(input?.approval_request_id),
    act_task_id: cleanString(input?.act_task_id),
    receipt_id: cleanString(input?.receipt_id),
    acceptance_id: cleanString(input?.acceptance_id),
    evidence_refs: uniqueStrings(input?.evidence_refs),
    api_snapshots: snapshots,
  };
}

export function mergeFormalScenarioManifestV1(
  current: FormalScenarioManifestV1,
  patch: Partial<FormalScenarioManifestV1>,
): FormalScenarioManifestV1 {
  return sanitizeFormalScenarioManifestV1({
    ...current,
    ...patch,
    zone_ids: Array.from(new Set([...(current.zone_ids ?? []), ...(patch.zone_ids ?? [])])),
    evidence_refs: Array.from(new Set([...(current.evidence_refs ?? []), ...(patch.evidence_refs ?? [])])),
    api_snapshots: [...(current.api_snapshots ?? []), ...(patch.api_snapshots ?? [])],
  });
}


export type FormalScenarioArtifactPathsV1 = {
  root_dir: string;
  run_dir: string;
  manifest_path: string;
  verify_path: string;
  snapshots_path: string;
};

export function createFormalScenarioArtifactPathsV1(run_id: string, root_dir = ".geox/formal_scenario_runs"): FormalScenarioArtifactPathsV1 {
  const safeRunId = cleanString(run_id) ?? "fsr_unknown";
  const run_dir = `${String(root_dir).replace(/\/$/, "")}/${safeRunId}`;
  return {
    root_dir: String(root_dir),
    run_dir,
    manifest_path: `${run_dir}/manifest.json`,
    verify_path: `${run_dir}/verify.json`,
    snapshots_path: `${run_dir}/snapshots.json`,
  };
}

export function buildFormalScenarioSnapshotsArtifactV1(manifest: FormalScenarioManifestV1): FormalScenarioApiSnapshotV1[] {
  return (manifest.api_snapshots ?? []).map((item) => ({ ...item }));
}