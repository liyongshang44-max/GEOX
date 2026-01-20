// GEOX/apps/web/src/lib/api.ts
import type { SensorGroupV1, SeriesResponseV1, OverlaySegment, ExplainOverlayV1 } from "./contracts";
export type GroupsResponse = { groups: SensorGroupV1[] };

export class ApiError extends Error {
  public status: number;
  public bodyText: string;
  constructor(status: number, bodyText: string) {
    super(`API ${status}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text);
  return JSON.parse(text) as T;
}

function uniqStrings(xs: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function toMsMaybe(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

// 兼容后端两种形状：
// A) contracts 形状：{ groupId, subjectRef, sensors, createdAt }
// B) server.ts 当前形状：{ group_id, project_id, plot_id, block_id, members:[{sensor_id}], created_at }
function normalizeGroup(x: any): SensorGroupV1 | null {
  if (!x || typeof x !== "object") return null;

  // 已经是 contracts 形状
  if (typeof x.groupId === "string" && x.subjectRef && typeof x.subjectRef === "object" && Array.isArray(x.sensors)) {
    return {
      groupId: x.groupId,
      subjectRef: {
        projectId: String(x.subjectRef.projectId ?? "P_DEFAULT"),
        plotId: x.subjectRef.plotId ? String(x.subjectRef.plotId) : undefined,
        blockId: x.subjectRef.blockId ? String(x.subjectRef.blockId) : undefined,
      },
      sensors: uniqStrings(x.sensors),
      createdAt: typeof x.createdAt === "number" ? x.createdAt : 0,
    };
  }

  // server.ts 形状
  const groupId = typeof x.group_id === "string" ? x.group_id.trim() : "";
  if (!groupId) return null;

  const projectId = typeof x.project_id === "string" && x.project_id.trim() ? x.project_id.trim() : "P_DEFAULT";
  const plotId = typeof x.plot_id === "string" && x.plot_id.trim() ? x.plot_id.trim() : undefined;
  const blockId = typeof x.block_id === "string" && x.block_id.trim() ? x.block_id.trim() : undefined;

  const members = Array.isArray(x.members) ? x.members : [];
  const sensors = uniqStrings(
    members
      .map((m: any) => (typeof m?.sensor_id === "string" ? m.sensor_id : typeof m?.sensorId === "string" ? m.sensorId : ""))
  );

  return {
    groupId,
    subjectRef: { projectId, plotId, blockId },
    sensors,
    createdAt: toMsMaybe(x.created_at),
  };
}

export async function fetchGroups(params: { projectId?: string; sensorId?: string }): Promise<GroupsResponse> {
  const q = new URLSearchParams();
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.sensorId) q.set("sensorId", params.sensorId);

  const raw = await requestJson<any>(`/api/groups?${q.toString()}`);

  const arr = Array.isArray(raw?.groups) ? raw.groups : [];
  const groups: SensorGroupV1[] = arr.map(normalizeGroup).filter(Boolean) as SensorGroupV1[];

  return { groups };
}

export async function fetchSeries(params: {
  groupId?: string;
  sensorId?: string;
  metrics: string[];
  startTs: number;
  endTs: number;
  maxPoints?: number;
}): Promise<SeriesResponseV1> {
  const q = new URLSearchParams();
  if (params.groupId) q.set("groupId", params.groupId);
  if (params.sensorId) q.set("sensorId", params.sensorId);
  q.set("metrics", params.metrics.join(","));
  q.set("startTs", String(params.startTs));
  q.set("endTs", String(params.endTs));
  if (typeof params.maxPoints === "number") q.set("maxPoints", String(params.maxPoints));
  return requestJson<SeriesResponseV1>(`/api/series?${q.toString()}`);
}

export async function postMarker(body: {
  ts: number;
  sensorId: string;
  type: "device_fault" | "local_anomaly";
  note?: string | null;
  source: "device" | "gateway" | "system";
}): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/marker`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function stableOverlays(overlays: OverlaySegment[]): OverlaySegment[] {
  return overlays;
}

export async function fetchOverlayExplain(id: string): Promise<ExplainOverlayV1> {
  const q = new URLSearchParams();
  q.set("id", id);
  return requestJson<ExplainOverlayV1>(`/api/overlays/explain?${q.toString()}`);
}

// -----------------------------
// Admin / New-device bootstrap APIs
// -----------------------------

export type AdminHealthzResponse = {
  ok: boolean;
  db: { ok: boolean; now: string | null; version: string | null };
  bootstrap: {
    requiredTables: string[];
    requiredViews: string[];
    missingTables: string[];
    missingViews: string[];
  };
};

export async function fetchAdminHealthz(): Promise<AdminHealthzResponse> {
  return requestJson<AdminHealthzResponse>(`/api/admin/healthz`);
}

export type ImportJobState = "queued" | "running" | "done" | "error";
export type ImportJob = {
  jobId: string;
  state: ImportJobState;
  createdAt: number;
  updatedAt: number;
  filePath: string;
  args: string[];
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  error?: string;
};

export async function postAdminImportCafHourly(params: {
  file: File;
  projectId?: string;
  groupId?: string;
  writeRawSamples?: string;
  writeMarkers?: string;
}): Promise<{ ok: boolean; jobId: string; filePath: string }> {
  const fd = new FormData();
  fd.append("file", params.file);
  if (params.projectId) fd.append("projectId", params.projectId);
  if (params.groupId) fd.append("groupId", params.groupId);
  if (params.writeRawSamples) fd.append("writeRawSamples", params.writeRawSamples);
  if (params.writeMarkers) fd.append("writeMarkers", params.writeMarkers);

  const res = await fetch(`/api/admin/import/caf_hourly`, { method: "POST", body: fd });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text);
  return JSON.parse(text) as any;
}

export async function fetchAdminImportJob(jobId: string): Promise<{ ok: boolean; job: ImportJob }> {
  return requestJson<{ ok: boolean; job: ImportJob }>(`/api/admin/import/jobs/${encodeURIComponent(jobId)}`);
}

export async function postAdminAcceptanceCaf0091h(params?: {
  projectId?: string;
  groupId?: string;
  sensorId?: string;
}): Promise<any> {
  return requestJson<any>(`/api/admin/acceptance/caf009_1h/run`, {
    method: "POST",
    body: JSON.stringify({
      projectId: params?.projectId,
      groupId: params?.groupId,
      sensorId: params?.sensorId,
    }),
  });
}

// -----------------------------
// Apple II (Judge) APIs
// -----------------------------

export type JudgeSubjectRef = {
  projectId: string;
  groupId?: string;
  plotId?: string;
  blockId?: string;
};

export type JudgeWindow = { startTs: number; endTs: number };

// JudgeConfigPatchV1 是前端唯一允许提交的“受限 patch”结构（replace-only）。
export type JudgeConfigPatchOpV1 = {
  op: "replace";
  path: string;
  value: unknown;
};

// JudgeConfigPatchV1 必须携带 base.ssot_hash，用于后端静态拒绝（409）。
export type JudgeConfigPatchV1 = {
  patch_version: "1.0.0";
  base: { ssot_hash: string };
  ops: JudgeConfigPatchOpV1[];
};

// JudgeConfigManifestItemV1 是 manifest.editable[] 的单项定义（前端 UI 的唯一可编辑来源）。
export type JudgeConfigManifestItemV1 = {
  path: string;
  type: "int" | "number" | "bool" | "enum_list";
  min?: number;
  max?: number;
  enum?: string[];
  conditional?: "exists_in_ssot";
  description?: string;
};

// GET /api/judge/config 的响应结构（冻结规范 v1）。
export type JudgeConfigManifestResponseV1 = {
  ssot: {
    source: string;
    schema_version: string;
    ssot_hash: string;
    updated_at_ts: number;
  };
  patch: {
    patch_version: "1.0.0";
    op_allowed: Array<"replace">;
    unknown_keys_policy: "reject";
  };
  editable: JudgeConfigManifestItemV1[];
  defaults: Record<string, unknown>;
  read_only_hints: string[];
};

// POST /api/judge/config/patch 的请求结构（dryRun=true/false）。
export type JudgeConfigPatchRequestV1 = {
  base: { ssot_hash: string };
  patch: JudgeConfigPatchV1;
  dryRun: boolean;
};

// POST /api/judge/config/patch 的响应结构（preview/save 共用）。
export type JudgeConfigPatchResponseV1 = {
  ok: boolean;
  ssot_hash: string;
  effective_hash?: string;
  changed_paths?: string[];
  errors: Array<{ code: string; path?: string; message: string; meta?: any }>;
  saved?: boolean;
};

export type JudgeRunOptions = {
  persist?: boolean;
  include_reference_views?: boolean;
  include_lb_candidates?: boolean;
  config_profile?: string;
  config_patch?: JudgeConfigPatchV1;
};

export type JudgeRunRequest = {
  subjectRef: JudgeSubjectRef;
  scale: string;
  window: JudgeWindow;
  options?: JudgeRunOptions;
};

// Judge response schemas are owned by @geox/contracts, but the frontend can
// remain permissive and render JSON to avoid drift during freeze.
export type JudgeRunResponse = any;

export async function postJudgeRun(body: JudgeRunRequest): Promise<JudgeRunResponse> {
  return requestJson<JudgeRunResponse>(`/api/judge/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 获取 Judge Config Manifest（前端唯一可编辑来源）。
export async function fetchJudgeConfigManifest(): Promise<JudgeConfigManifestResponseV1> {
  return requestJson<JudgeConfigManifestResponseV1>(`/api/judge/config`);
}

// 提交 Judge Config Patch（dryRun=true 用于权威校验；dryRun=false 用于保存/确认）。
export async function postJudgeConfigPatch(req: JudgeConfigPatchRequestV1): Promise<JudgeConfigPatchResponseV1> {
  return requestJson<JudgeConfigPatchResponseV1>(`/api/judge/config/patch`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// -------------------- Simulator Config (manifest-driven) --------------------

export type SimConfigManifestResponseV1 = any;
export type SimConfigPatchRequestV1 = any;
export type SimConfigPatchResponseV1 = any;

// 获取 Simulator Config Manifest（前端唯一可编辑来源）。
export async function fetchSimConfigManifest(): Promise<SimConfigManifestResponseV1> {
  return requestJson<SimConfigManifestResponseV1>(`/api/sim/config`);
}

// 提交 Simulator Config Patch（dryRun=true 用于权威校验；dryRun=false 用于保存/确认）。
export async function postSimConfigPatch(req: SimConfigPatchRequestV1): Promise<SimConfigPatchResponseV1> {
  return requestJson<SimConfigPatchResponseV1>(`/api/sim/config/patch`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchJudgeProblemStates(limit = 50): Promise<any> {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  return requestJson<any>(`/api/judge/problem_states?${q.toString()}`);
}

export async function fetchJudgeReferenceViews(limit = 50): Promise<any> {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  return requestJson<any>(`/api/judge/reference_views?${q.toString()}`);
}

export async function fetchJudgeAoSense(limit = 50): Promise<any> {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  return requestJson<any>(`/api/judge/ao_sense?${q.toString()}`);
}

// --- compat exports for older UI code ---
export { fetchSeries as getSeries };
export type PostMarkerBody = Parameters<typeof postMarker>[0];