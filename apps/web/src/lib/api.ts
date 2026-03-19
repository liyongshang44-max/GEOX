// GEOX/apps/web/src/lib/api.ts
import type { SensorGroupV1, SeriesResponseV1, OverlaySegment, ExplainOverlayV1, MarkerKind } from "./contracts";

export type GroupsResponse = { groups: SensorGroupV1[] };


export function withMediaBase(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

export class ApiError extends Error {
  public status: number;
  public bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`API ${status}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

const DEFAULT_AO_ACT_TOKEN = "geox_dev_MqF24b9NHfB6AkBNjKaxP_T0CnL0XZykhdmSyoQvg4"; // Default dev token for local acceptance and demo flows.

export function readStoredAoActToken(): string { // Read the AO-ACT token from shared browser storage with a safe dev fallback.
  try {
    const local = localStorage.getItem("geox_ao_act_token"); // Preferred persistent token location.
    if (typeof local === "string" && local.trim()) return local.trim(); // Return local token when present.
  } catch {}

  try {
    const session = sessionStorage.getItem("geox_ao_act_token"); // Session fallback for tabs that only persist session state.
    if (typeof session === "string" && session.trim()) return session.trim(); // Return session token when present.
  } catch {}

  return DEFAULT_AO_ACT_TOKEN; // Fall back to the built-in dev token for local commercial console usage.
}

export function persistAoActToken(next: string): string { // Persist the AO-ACT token into both local and session storage.
  const token = String(next ?? "").trim() || DEFAULT_AO_ACT_TOKEN; // Normalize empty input back to the default dev token.
  try { localStorage.setItem("geox_ao_act_token", token); } catch {}
  try { sessionStorage.setItem("geox_ao_act_token", token); } catch {}
  return token;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = readStoredAoActToken();
  const apiBase = "http://127.0.0.1:3000";
  const finalUrl = /^https?:\/\//i.test(url) ? url : `${apiBase}${url}`;

  const baseHeaders =
    init?.body instanceof FormData
      ? { ...(init?.headers ?? {}) }
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        };

  const headers: HeadersInit = {
    ...baseHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(finalUrl, {
    ...init,
    headers,
  });

  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function withQuery(path: string, params?: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) q.append(k, String(item));
      continue;
    }
    q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
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

function normalizeGroup(x: any): SensorGroupV1 | null {
  if (!x || typeof x !== "object") return null;

  if (typeof x.groupId === "string" && x.subjectRef && typeof x.subjectRef === "object" && Array.isArray(x.sensors)) {
    return {
      groupId: x.groupId,
      subjectRef: {
        projectId: String(x.subjectRef.projectId ?? "P_DEFAULT"),
        plotId: x.subjectRef.plotId ? String(x.subjectRef.plotId) : undefined,
        blockId: x.subjectRef.blockId ? String(x.subjectRef.blockId) : undefined,
      },
      displayName: typeof x.displayName === "string" && x.displayName.trim() ? x.displayName.trim() : String(x.groupId),
      sensors: uniqStrings(x.sensors),
      createdAt: typeof x.createdAt === "number" ? x.createdAt : 0,
    };
  }

  const groupId = typeof x.group_id === "string" ? x.group_id.trim() : "";
  if (!groupId) return null;

  const projectId = typeof x.project_id === "string" && x.project_id.trim() ? x.project_id.trim() : "P_DEFAULT";
  const plotId = typeof x.plot_id === "string" && x.plot_id.trim() ? x.plot_id.trim() : undefined;
  const blockId = typeof x.block_id === "string" && x.block_id.trim() ? x.block_id.trim() : undefined;

  const members = Array.isArray(x.members) ? x.members : [];
  const sensors = uniqStrings(
    members.map((m: any) =>
      typeof m?.sensor_id === "string"
        ? m.sensor_id
        : typeof m?.sensorId === "string"
          ? m.sensorId
          : "",
    ),
  );

  return {
    groupId,
    subjectRef: { projectId, plotId, blockId },
    displayName: typeof x.display_name === "string" && x.display_name.trim() ? x.display_name.trim() : groupId,
    sensors,
    createdAt: toMsMaybe(x.created_at),
  };
}

export async function fetchGroups(params: { projectId?: string; sensorId?: string }): Promise<GroupsResponse> {
  const raw = await requestJson<any>(withQuery(`/api/groups`, params));
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
  return requestJson<SeriesResponseV1>(
    withQuery(`/api/series`, {
      groupId: params.groupId,
      sensorId: params.sensorId,
      metrics: params.metrics.join(","),
      startTs: params.startTs,
      endTs: params.endTs,
      maxPoints: params.maxPoints,
    }),
  );
}

export async function postMarker(body: {
  ts: number;
  sensorId: string;
  type: MarkerKind;
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
  return requestJson<ExplainOverlayV1>(withQuery(`/api/overlays/explain`, { id }));
}

// -----------------------------
// Admin / bootstrap APIs
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

export async function fetchAdminHealthz(): Promise<AdminHealthzResponse> {
  return requestJson<AdminHealthzResponse>(`/api/admin/healthz`);
}

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
  return JSON.parse(text) as { ok: boolean; jobId: string; filePath: string };
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
// Judge APIs
// -----------------------------

export type JudgeSubjectRef = {
  projectId: string;
  groupId?: string;
  plotId?: string;
  blockId?: string;
};

export type JudgeWindow = {
  startTs: number;
  endTs: number;
};

export type JudgeConfigPatchOpV1 = {
  op: "replace";
  path: string;
  value: unknown;
};

export type JudgeConfigPatchV1 = {
  patch_version: "1.0.0";
  base: { ssot_hash: string };
  ops: JudgeConfigPatchOpV1[];
};

export type JudgeConfigManifestItemV1 = {
  path: string;
  type: "int" | "number" | "bool" | "enum_list";
  min?: number;
  max?: number;
  enum?: string[];
  conditional?: "exists_in_ssot";
  description?: string;
};

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

export type JudgeConfigPatchRequestV1 = {
  base: { ssot_hash: string };
  patch: JudgeConfigPatchV1;
  dryRun: boolean;
};

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

export type JudgeRunResponse = any;

export async function postJudgeRun(body: JudgeRunRequest): Promise<JudgeRunResponse> {
  return requestJson<JudgeRunResponse>(`/api/judge/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchJudgeConfigManifest(): Promise<JudgeConfigManifestResponseV1> {
  return requestJson<JudgeConfigManifestResponseV1>(`/api/judge/config`);
}

export async function postJudgeConfigPatch(req: JudgeConfigPatchRequestV1): Promise<JudgeConfigPatchResponseV1> {
  return requestJson<JudgeConfigPatchResponseV1>(`/api/judge/config/patch`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export type SimConfigManifestResponseV1 = any;
export type SimConfigPatchRequestV1 = any;
export type SimConfigPatchResponseV1 = any;

export async function fetchSimConfigManifest(): Promise<SimConfigManifestResponseV1> {
  return requestJson<SimConfigManifestResponseV1>(`/api/sim/config`);
}

export async function postSimConfigPatch(req: SimConfigPatchRequestV1): Promise<SimConfigPatchResponseV1> {
  return requestJson<SimConfigPatchResponseV1>(`/api/sim/config/patch`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchJudgeProblemStates(limit = 50): Promise<any> {
  return requestJson<any>(withQuery(`/api/judge/problem_states`, { limit }));
}

export async function fetchJudgeReferenceViews(limit = 50): Promise<any> {
  return requestJson<any>(withQuery(`/api/judge/reference_views`, { limit }));
}

export async function fetchJudgeAoSense(limit = 50): Promise<any> {
  return requestJson<any>(withQuery(`/api/judge/ao_sense`, { limit }));
}

// -----------------------------
// Common auth / settings types
// -----------------------------

export type AuthMe = {
  ok: boolean;
  actor_id: string;
  token_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role: string;
  scopes: string[];
};

export async function fetchAuthMe(token: string): Promise<AuthMe> {
  return requestJson<AuthMe>(`/api/v1/auth/me`, {
    headers: authHeaders(token),
  });
}

// -----------------------------
// Alerts APIs
// -----------------------------

export type AlertRuleStatus = "ACTIVE" | "DISABLED" | "ALL";
export type AlertEventStatus = "OPEN" | "ACKED" | "CLOSED" | "ALL";
export type AlertObjectType = "DEVICE" | "FIELD" | "TENANT" | "ALL";
export type AlertRuleItem = any;
export type AlertEventItem = any;
export type AlertNotificationItem = any;

export async function fetchAlertRules(token: string, params?: Record<string, unknown>): Promise<AlertRuleItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: AlertRuleItem[] }>(withQuery(`/api/v1/alerts/rules`, params), {
    headers: authHeaders(token),
  });
  return Array.isArray(res.items) ? res.items : [];
}

export async function createAlertRule(token: string, body: any): Promise<any> {
  return requestJson<any>(`/api/v1/alerts/rules`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function disableAlertRule(token: string, ruleId: string): Promise<any> {
  return requestJson<any>(`/api/v1/alerts/rules/${encodeURIComponent(ruleId)}/disable`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
}

export async function fetchAlertEvents(token: string, params?: Record<string, unknown>): Promise<AlertEventItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: AlertEventItem[] }>(
    withQuery(`/api/v1/alerts/events`, params),
    { headers: authHeaders(token) },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function ackAlertEvent(token: string, eventId: string, body?: any): Promise<any> {
  return requestJson<any>(`/api/v1/alerts/events/${encodeURIComponent(eventId)}/ack`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
}

export async function closeAlertEvent(token: string, eventId: string, body?: any): Promise<any> {
  return requestJson<any>(`/api/v1/alerts/events/${encodeURIComponent(eventId)}/close`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchAlertNotifications(token: string, params?: Record<string, unknown>): Promise<AlertNotificationItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: AlertNotificationItem[] }>(
    withQuery(`/api/v1/alerts/notifications`, params),
    { headers: authHeaders(token) },
  );
  return Array.isArray(res.items) ? res.items : [];
}

// -----------------------------
// Audit / export overview APIs
// -----------------------------

export type AuditOverviewObjectType = "ALL" | "EXPORT" | "ALERT" | "RECEIPT" | "APPROVAL" | "DISPATCH";
export type AuditExportOverview = any;

export async function fetchAuditExportOverview(token: string, params?: Record<string, unknown>): Promise<AuditExportOverview> {
  return requestJson<AuditExportOverview>(withQuery(`/api/v1/audit-export/overview`, params), {
    headers: authHeaders(token),
  });
}

// -----------------------------
// Field APIs
// -----------------------------

export type FieldListItem = any;
export type FieldBoundDevice = any;
export type FieldPolygon = any;
export type FieldSeason = any;
export type FieldDetail = any;

export async function fetchFields(token: string): Promise<FieldListItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: FieldListItem[]; fields?: FieldListItem[] }>(`/api/v1/fields`, {
    headers: authHeaders(token),
  });
  console.log("fetchFields raw res", res);
  if (Array.isArray(res.items)) {
    console.log("fetchFields return items", res.items.length, res.items);
    return res.items;
  }
  const out = Array.isArray(res.fields) ? res.fields : [];
  console.log("fetchFields return fields", out.length, out);
  return out;
}

export async function fetchFieldDetail(token: string, fieldId: string): Promise<FieldDetail> {
  return requestJson<FieldDetail>(`/api/v1/fields/${encodeURIComponent(fieldId)}`, {
    headers: authHeaders(token),
  });
}

export async function createFieldSeason(token: string, fieldId: string, body: any): Promise<any> {
  return requestJson<any>(`/api/v1/fields/${encodeURIComponent(fieldId)}/seasons`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

// -----------------------------
// Device / telemetry APIs
// -----------------------------

export type DeviceListItem = any;
export type DeviceDetail = any;
export type DeviceStatus = any;
export type DeviceConsoleView = any;
export type TelemetryLatestItem = any;
export type TelemetryMetricsItem = any;
export type TelemetrySeriesResponse = any;

export async function fetchDevices(token: string): Promise<DeviceListItem[]> {
  try {
    const res = await requestJson<{ ok?: boolean; items?: DeviceListItem[]; devices?: DeviceListItem[] }>(`/api/v1/devices`, {
      headers: authHeaders(token),
    });
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.devices)) return res.devices;
  } catch (e: unknown) {
    if (!isNotFoundApiError(e)) throw e;
  }

  const v1 = await requestJson<{ ok?: boolean; items?: DeviceListItem[]; devices?: DeviceListItem[] }>(`/api/v1/devices`, {
    headers: authHeaders(token),
  });
  if (Array.isArray(v1.items)) return v1.items;
  return Array.isArray(v1.devices) ? v1.devices : [];
}

export async function fetchDeviceDetail(token: string, deviceId: string): Promise<DeviceDetail> {
  return requestJson<DeviceDetail>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
    headers: authHeaders(token),
  });
}

export async function fetchDeviceStatus(token: string, deviceId: string): Promise<DeviceStatus> {
  return requestJson<DeviceStatus>(`/api/v1/devices/${encodeURIComponent(deviceId)}/status`, {
    headers: authHeaders(token),
  });
}

export async function fetchDeviceConsole(token: string, deviceId: string): Promise<DeviceConsoleView> {
  return requestJson<DeviceConsoleView>(`/api/v1/devices/${encodeURIComponent(deviceId)}/console`, {
    headers: authHeaders(token),
  });
}


export async function issueDeviceCredential(token: string, deviceId: string, body?: { credential_id?: string }): Promise<any> {
  return requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}/credentials`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
}

export async function revokeDeviceCredential(token: string, deviceId: string, credentialId: string): Promise<any> {
  return requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}/credentials/${encodeURIComponent(credentialId)}/revoke`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

function isNotFoundApiError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  return err.bodyText.includes('"statusCode":404') || err.bodyText.includes('NOT_FOUND') || err.bodyText.includes('Not Found');
}

export async function registerDeviceOnboarding(token: string, body: { device_id: string; display_name?: string; credential_id?: string }): Promise<any> {
  try {
    return await requestJson<any>(`/api/v1/devices/onboarding/register`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
  } catch (e: unknown) {
    if (!isNotFoundApiError(e)) throw e;
    try {
      return await requestJson<any>(`/api/v1/devices/register`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(body),
      });
    } catch (e2: unknown) {
      if (!isNotFoundApiError(e2)) throw e2;
    }
  }

  // Fallback for mixed backend versions: create device + issue credential via stable legacy endpoints.
    await requestJson<any>(`/api/v1/devices`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ device_id: body.device_id, display_name: body.display_name }),
  });

  const created = await requestJson<any>(`/api/v1/devices/${encodeURIComponent(body.device_id)}/credentials`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body.credential_id ? { credential_id: body.credential_id } : {}),
  });

  return {
    ok: true,
    device_id: body.device_id,
    display_name: body.display_name ?? null,
    credential_id: created?.credential_id ?? null,
    credential_secret: created?.credential_secret ?? null,
    credential_hash: created?.credential_hash ?? null,
    access_info: {
      mqtt_client_id: `geox-<tenant>-${body.device_id}`,
      telemetry_topic: `telemetry/<tenant>/${body.device_id}`,
      heartbeat_topic: `heartbeat/<tenant>/${body.device_id}`,
    },
  };
}

export async function fetchDeviceOnboardingStatus(token: string, deviceId: string): Promise<any> {
  try {
    return await requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}/onboarding-status`, {
      headers: authHeaders(token),
    });
  } catch (e: unknown) {
    if (!isNotFoundApiError(e)) throw e;
  }

  // Fallback for backends that do not yet expose onboarding-status.
  const [detail, consoleView] = await Promise.all([
    requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, { headers: authHeaders(token) }),
    requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}/console`, { headers: authHeaders(token) }).catch(() => null),
  ]);

  const device = detail?.device ?? {};
  return {
    ok: true,
    device_id: device.device_id ?? deviceId,
    display_name: device.display_name ?? null,
    registration_completed: !!device.device_id,
    credential_ready: typeof device.last_credential_id === "string" && (device.last_credential_status ?? "") === "ACTIVE",
    first_telemetry_uploaded: typeof device.last_telemetry_ts_ms === "number" && Number.isFinite(device.last_telemetry_ts_ms),
    created_ts_ms: device.created_ts_ms ?? null,
    last_credential_id: device.last_credential_id ?? null,
    last_credential_status: device.last_credential_status ?? null,
    last_heartbeat_ts_ms: device.last_heartbeat_ts_ms ?? null,
    last_telemetry_ts_ms: device.last_telemetry_ts_ms ?? null,
    access_info: consoleView?.access_info ?? null,
  };
}

export async function bindDeviceToField(token: string, deviceId: string, body: { field_id: string }): Promise<any> {
  return requestJson<any>(`/api/v1/devices/${encodeURIComponent(deviceId)}/bind-field`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function fetchTelemetryLatest(token: string, params?: Record<string, unknown>): Promise<TelemetryLatestItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: TelemetryLatestItem[] }>(
    withQuery(`/api/v1/telemetry/latest`, params),
    { headers: authHeaders(token) },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchTelemetryMetrics(token: string, params?: Record<string, unknown>): Promise<TelemetryMetricsItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: TelemetryMetricsItem[] }>(
    withQuery(`/api/v1/telemetry/metrics`, params),
    { headers: authHeaders(token) },
  );
  return Array.isArray(res.items) ? res.items : [];
}

export async function fetchTelemetrySeries(token: string, params?: Record<string, unknown>): Promise<TelemetrySeriesResponse> {
  return requestJson<TelemetrySeriesResponse>(withQuery(`/api/v1/telemetry/series`, params), {
    headers: authHeaders(token),
  });
}

// -----------------------------
// Evidence export APIs
// -----------------------------

export type EvidenceExportScopeType = "TENANT" | "FIELD" | "DEVICE";
export type EvidenceExportJob = any;

export async function fetchEvidenceExportJobs(token: string, params?: Record<string, unknown>): Promise<EvidenceExportJob[]> {
  const res = await requestJson<{ ok?: boolean; jobs?: EvidenceExportJob[] }>(
    withQuery(`/api/v1/evidence-export/jobs`, params),
    { headers: authHeaders(token) },
  );
  return Array.isArray(res.jobs) ? res.jobs : [];
}

export async function fetchEvidenceExportJob(token: string, jobId: string): Promise<EvidenceExportJob | null> {
  const res = await requestJson<{ ok?: boolean; job?: EvidenceExportJob }>(
    `/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(token) },
  );
  return res.job ?? null;
}

export async function createEvidenceExportJob(token: string, body: any): Promise<string> {
  const res = await requestJson<{ ok?: boolean; job_id?: string }>(`/api/v1/evidence-export/jobs`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return String(res.job_id ?? "");
}

// -----------------------------
// Approval / AO-ACT APIs
// -----------------------------

export type OperationApprovalItem = any;
export type OperationTaskItem = any;
export type OperationDispatchItem = any;
export type OperationReceiptItem = any;

export async function fetchApprovals(token: string): Promise<OperationApprovalItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: OperationApprovalItem[] }>(`/api/v1/approvals`, {
    headers: authHeaders(token),
  });
  return Array.isArray(res.items) ? res.items : [];
}

export async function createApproval(token: string, body: any): Promise<any> {
  return requestJson<any>(`/api/v1/approvals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function decideApproval(token: string, requestId: string, body: any): Promise<any> {
  return requestJson<any>(`/api/v1/approvals/${encodeURIComponent(requestId)}/decide`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function fetchAoActTasks(token: string): Promise<OperationTaskItem[]> {
  const res = await requestJson<{ ok?: boolean; items?: OperationTaskItem[] }>(`/api/v1/ao-act/tasks`, {
    headers: authHeaders(token),
  });
  return Array.isArray(res.items) ? res.items : [];
}

export async function dispatchAoActTask(token: string, actTaskId: string, body: any): Promise<any> {
  return requestJson<any>(`/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

// -----------------------------
// Dashboard APIs
// -----------------------------

export type DashboardSummary = {
  field_count: number;
  online_device_count: number;
  open_alert_count: number;
  running_task_count: number;
};

export type DashboardTrendPoint = {
  ts_ms: number;
  avg_value_num: number | null;
  sample_count: number;
};

export type DashboardTrendSeries = {
  metric: string;
  points: DashboardTrendPoint[];
};

export type DashboardAlertItem = {
  event_id: string;
  rule_id: string;
  object_type: string;
  object_id: string;
  metric: string;
  status: string;
  raised_ts_ms: number;
};

export type DashboardReceiptItem = {
  fact_id: string;
  act_task_id: string | null;
  device_id: string | null;
  status: string | null;
  occurred_at: string;
  occurred_ts_ms: number;
};

export type DashboardQuickAction = {
  key: string;
  label: string;
  to: string;
};

export type DashboardOverview = {
  window: {
    from_ts_ms: number;
    to_ts_ms: number;
  };
  summary: DashboardSummary;
  trend_series: DashboardTrendSeries[];
  latest_alerts: DashboardAlertItem[];
  latest_receipts: DashboardReceiptItem[];
  quick_actions: DashboardQuickAction[];
};

export async function fetchDashboardOverview(
  token: string,
  params?: { from_ts_ms?: number; to_ts_ms?: number },
): Promise<DashboardOverview> {
  return requestJson<{ ok: boolean } & DashboardOverview>(
    withQuery(`/api/v1/dashboard/overview`, params),
    { headers: authHeaders(token) },
  );
}

// -----------------------------
// Operations console APIs
// -----------------------------

export type OperationsConsoleApprovalDetail = {
  request_id: string | null;
  status: string;
  occurred_at: string;
  action_type: string;
  target: any;
  device_id: string | null;
  risk_hint: string;
  impact_scope: any;
  parameter_snapshot: any;
  proposal_hash: string;
  decision_present: boolean;
  act_task_id: string | null;
};

export type OperationsConsoleMonitoringItem = {
  act_task_id: string;
  state: string;
  action_type: string;
  target: any;
  device_id: string | null;
  parameters: any;
  parameters_hash: string;
  dispatch_fact_id: string | null;
  dispatch_occurred_at: string | null;
  receipt_fact_id: string | null;
  receipt_occurred_at: string | null;
  latest_receipt_status: string | null;
  retry_allowed: boolean;
};

export type OperationsConsoleResponse = {
  summary: {
    approvals_pending: number;
    approvals_decided: number;
    dispatch_queue: number;
    receipts: number;
    retryable_tasks: number;
  };
  approvals: OperationsConsoleApprovalDetail[];
  monitoring: OperationsConsoleMonitoringItem[];
  dispatches: OperationDispatchItem[];
  receipts: OperationReceiptItem[];
};

export type OperationStateTimelineItemV1 = {
  type: string;
  label: string;
  ts: number;
};

export type OperationStateItemV1 = {
  operation_id: string;
  recommendation_id?: string | null;
  approval_request_id?: string | null;
  approval_decision_id?: string | null;
  operation_plan_id?: string | null;
  task_id?: string | null;
  device_id?: string | null;
  field_id?: string | null;
  action_type?: string | null;
  dispatch_status: string;
  receipt_status: string;
  final_status: string;
  last_event_ts: number;
  timeline: OperationStateTimelineItemV1[];
};

export async function fetchOperationsConsole(token: string): Promise<OperationsConsoleResponse> {
  const res = await requestJson<{ ok: boolean } & OperationsConsoleResponse>(`/api/v1/operations/console`, {
    headers: authHeaders(token),
  });

  return {
    summary: res.summary,
    approvals: Array.isArray(res.approvals) ? res.approvals : [],
    monitoring: Array.isArray(res.monitoring) ? res.monitoring : [],
    dispatches: Array.isArray(res.dispatches) ? res.dispatches : [],
    receipts: Array.isArray(res.receipts) ? res.receipts : [],
  };
}

export async function fetchOperationStates(
  token: string,
  params?: { field_id?: string; device_id?: string; final_status?: string; limit?: number },
): Promise<{ ok: boolean; count: number; items: OperationStateItemV1[] }> {
  return requestJson<{ ok: boolean; count: number; items: OperationStateItemV1[] }>(
    withQuery(`/api/v1/operations`, params),
    { headers: authHeaders(token) },
  );
}

export async function retryAoActTask(
  token: string,
  actTaskId: string,
  body: {
    device_id?: string;
    downlink_topic?: string;
    retry_reason?: string;
    adapter_hint?: string;
  },
): Promise<any> {
  return requestJson<any>(`/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/retry`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

// --- compat exports for older UI code ---
export { fetchSeries as getSeries };
export type PostMarkerBody = Parameters<typeof postMarker>[0];

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

export async function fetchAgronomyRecommendations(params: {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  limit?: number;
  token?: string;
}): Promise<{ ok: boolean; items: AgronomyRecommendationItemV1[]; count: number }> {
  const token = params.token ?? readStoredAoActToken();
  return requestJson<{ ok: boolean; items: AgronomyRecommendationItemV1[]; count: number }>(withQuery('/api/v1/agronomy/recommendations', {
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    group_id: params.group_id,
    limit: params.limit ?? 50,
  }), { headers: authHeaders(token) });
}


export async function submitRecommendationApproval(params: {
  recommendation_id: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  rationale?: string;
  token?: string;
}): Promise<{ ok: boolean; recommendation_id: string; approval_request_id: string; operation_plan_id: string; operation_plan_fact_id: string }> {
  const token = params.token ?? readStoredAoActToken();
  return requestJson<{ ok: boolean; recommendation_id: string; approval_request_id: string; operation_plan_id: string; operation_plan_fact_id: string }>(
    withQuery(`/api/v1/recommendations/${encodeURIComponent(params.recommendation_id)}/submit-approval`, {
      tenant_id: params.tenant_id,
      project_id: params.project_id,
      group_id: params.group_id,
    }),
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        tenant_id: params.tenant_id,
        project_id: params.project_id,
        group_id: params.group_id,
        rationale: params.rationale ?? "Submitted from recommendations console",
      }),
    },
  );
}
export async function fetchAgronomyRecommendationDetail(params: {
  recommendation_id: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  token?: string;
}): Promise<{ ok: boolean; item: AgronomyRecommendationItemV1 }> {
  const token = params.token ?? readStoredAoActToken();
  return requestJson<{ ok: boolean; item: AgronomyRecommendationItemV1 }>(withQuery(`/api/v1/agronomy/recommendations/${encodeURIComponent(params.recommendation_id)}`, {
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    group_id: params.group_id,
  }), { headers: authHeaders(token) });
}
