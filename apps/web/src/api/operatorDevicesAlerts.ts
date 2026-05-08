import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorDevicesAlertsDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorDeviceOnlineStatus = "ONLINE" | "OFFLINE" | "DELAYED" | "UNKNOWN";
export type OperatorCredentialStatus = "ACTIVE" | "REVOKED" | "UNKNOWN" | "HIDDEN";
export type OperatorAlertStatus = "OPEN" | "ACKED" | "CLOSED" | "OVERDUE" | "UNKNOWN";

export type OperatorDeviceItem = {
  deviceId: string;
  displayName?: string | null;
  onlineStatus: OperatorDeviceOnlineStatus;
  lastHeartbeatAt?: string | null;
  lastTelemetryAt?: string | null;
  fieldName?: string | null;
  fieldId?: string | null;
  capabilities: string[];
  credentialStatus: OperatorCredentialStatus;
  credentialLastIssuedAt?: string | null;
  credentialLastUsedAt?: string | null;
  revokeStatus?: string | null;
  canRevoke: boolean;
  batteryPercent?: number | null;
  dataDelayText?: string | null;
  source: "operator_devices_alerts_api" | "devices_api" | "reports_aggregate";
};

export type OperatorAlertItem = {
  alertId: string;
  ruleName?: string | null;
  eventText?: string | null;
  notificationStatus?: string | null;
  status: OperatorAlertStatus;
  ackStatus?: string | null;
  closeStatus?: string | null;
  ownerName?: string | null;
  fieldName?: string | null;
  operationId?: string | null;
  prescriptionFormed: boolean | null;
  overdue: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  canAck: boolean;
  canClose: boolean;
  permissionReason?: string | null;
  auditText?: string | null;
  statusSource?: string | null;
  source: "operator_devices_alerts_api" | "alerts_api" | "reports_aggregate";
};

export type OperatorDevicesAlertsResponse = {
  source: "operator_devices_alerts_api" | "fallback_existing_sources" | "empty_error_state";
  dataScope: OperatorDevicesAlertsDataScope;
  generated_at?: string | null;
  devices: OperatorDeviceItem[];
  alerts: OperatorAlertItem[];
  message?: string;
  ackCloseReady: boolean;
  revokeVisible: boolean;
};

export type OperatorAlertActionResult = {
  ok: boolean;
  message: string;
  auditText?: string | null;
};

type AnyRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as AnyRecord;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  }
  if (obj.data) return arrayFrom(obj.data, keys);
  if (obj.items) return arrayFrom(obj.items, keys);
  return [];
}

function sanitizeText(value: unknown, fallback = "未提供"): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  if (/secret|token|access[_-]?key|password|credential_payload/i.test(raw)) return "敏感凭据已隐藏";
  if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("/") || raw.includes("file://")) return "本地路径已隐藏";
  return raw.length > 96 ? `${raw.slice(0, 48)}...${raw.slice(-16)}` : raw;
}

function normalizeOnlineStatus(row: AnyRecord): OperatorDeviceOnlineStatus {
  const raw = text(row.online_status ?? row.status ?? row.health_status ?? row.connection_status).toUpperCase();
  if (raw.includes("OFFLINE") || raw.includes("离线")) return "OFFLINE";
  if (raw.includes("DELAY") || raw.includes("STALE") || raw.includes("延迟")) return "DELAYED";
  if (raw.includes("ONLINE") || raw.includes("ACTIVE") || raw.includes("在线")) return "ONLINE";
  return "UNKNOWN";
}

function normalizeCredentialStatus(row: AnyRecord): OperatorCredentialStatus {
  const raw = text(row.credential_status ?? row.credentials?.status ?? row.credential?.status).toUpperCase();
  if (/secret|token|access[_-]?key|password/i.test(`${row.credential_secret ?? ""} ${row.secret ?? ""} ${row.token ?? ""} ${row.credentials?.secret ?? ""} ${row.credentials?.token ?? ""}`)) return "HIDDEN";
  if (raw.includes("REVOKED")) return "REVOKED";
  if (raw.includes("ACTIVE") || raw.includes("ISSUED")) return "ACTIVE";
  return "UNKNOWN";
}

function normalizeCredentialIssuedAt(row: AnyRecord): string {
  return text(row.credential_last_issued_at ?? row.last_issued_at ?? row.credentials?.last_issued_at ?? row.credentials?.issued_at ?? row.credential?.last_issued_at ?? row.credential?.issued_at, "");
}

function normalizeCredentialLastUsedAt(row: AnyRecord): string {
  return text(row.credential_last_used_at ?? row.last_used_at ?? row.credentials?.last_used_at ?? row.credential?.last_used_at, "");
}

function normalizeCanRevoke(row: AnyRecord, source: OperatorDeviceItem["source"]): boolean {
  if (source !== "operator_devices_alerts_api") return false;
  if (typeof row.can_revoke === "boolean") return row.can_revoke;
  if (typeof row.credentials?.can_revoke === "boolean") return row.credentials.can_revoke;
  if (typeof row.permissions?.can_revoke_device_credential === "boolean") return row.permissions.can_revoke_device_credential;
  return false;
}

function normalizeAlertStatus(row: AnyRecord): OperatorAlertStatus {
  const raw = text(row.status ?? row.alert_status ?? row.state).toUpperCase();
  const overdue = Boolean(row.overdue) || /OVERDUE|TIMEOUT|超时/i.test(`${row.reason ?? ""} ${row.title ?? ""}`);
  if (overdue) return "OVERDUE";
  if (raw.includes("CLOSED") || raw.includes("RESOLVED")) return "CLOSED";
  if (raw.includes("ACK")) return "ACKED";
  if (raw.includes("OPEN") || raw.includes("ACTIVE") || raw.includes("PENDING")) return "OPEN";
  return "UNKNOWN";
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function capabilities(row: AnyRecord): string[] {
  const raw = row.capabilities ?? row.device_capabilities ?? row.skills;
  if (Array.isArray(raw)) return raw.map((item) => sanitizeText(item, "")).filter(Boolean).slice(0, 8);
  const single = sanitizeText(raw, "");
  return single ? [single] : [];
}

function normalizeDevice(row: AnyRecord, index: number, source: OperatorDeviceItem["source"]): OperatorDeviceItem {
  return {
    deviceId: sanitizeText(row.device_id ?? row.deviceId ?? row.id, `device-${index}`),
    displayName: sanitizeText(row.display_name ?? row.name ?? row.device_name, ""),
    onlineStatus: normalizeOnlineStatus(row),
    lastHeartbeatAt: text(row.last_heartbeat_at ?? row.last_heartbeat_ts ?? row.last_heartbeat_ts_ms, ""),
    lastTelemetryAt: text(row.last_telemetry_at ?? row.last_telemetry_ts ?? row.last_telemetry_ts_ms, ""),
    fieldName: sanitizeText(row.field_name ?? row.fieldName, ""),
    fieldId: sanitizeText(row.field_id ?? row.fieldId, ""),
    capabilities: capabilities(row),
    credentialStatus: normalizeCredentialStatus(row),
    credentialLastIssuedAt: normalizeCredentialIssuedAt(row),
    credentialLastUsedAt: normalizeCredentialLastUsedAt(row),
    revokeStatus: sanitizeText(row.revoke_status ?? row.credentials?.revoke_status ?? row.credential?.revoke_status, "只读或管理员可见"),
    canRevoke: normalizeCanRevoke(row, source),
    batteryPercent: numberOrNull(row.battery_percent ?? row.battery ?? row.power_percent),
    dataDelayText: sanitizeText(row.data_delay_text ?? row.telemetry_delay ?? row.delay_text, "延迟状态待确认"),
    source,
  };
}

function normalizeCanAck(row: AnyRecord, status: OperatorAlertStatus, source: OperatorAlertItem["source"]): boolean {
  if (source !== "operator_devices_alerts_api") return false;
  if (typeof row.can_ack === "boolean") return row.can_ack;
  if (typeof row.permissions?.can_ack === "boolean") return row.permissions.can_ack;
  return status === "OPEN" || status === "OVERDUE";
}

function normalizeCanClose(row: AnyRecord, status: OperatorAlertStatus, source: OperatorAlertItem["source"]): boolean {
  if (source !== "operator_devices_alerts_api") return false;
  if (typeof row.can_close === "boolean") return row.can_close;
  if (typeof row.permissions?.can_close === "boolean") return row.permissions.can_close;
  return status === "ACKED" || status === "OVERDUE" || status === "OPEN";
}

function normalizeAlert(row: AnyRecord, index: number, source: OperatorAlertItem["source"]): OperatorAlertItem {
  const status = normalizeAlertStatus(row);
  const operationId = sanitizeText(row.operation_id ?? row.operationId ?? row.linked_operation_id, "");
  const prescriptionRaw = row.prescription_formed ?? row.has_prescription ?? row.prescription_id;
  const canAck = normalizeCanAck(row, status, source);
  const canClose = normalizeCanClose(row, status, source);
  return {
    alertId: sanitizeText(row.alert_id ?? row.id, `alert-${index}`),
    ruleName: sanitizeText(row.rule_name ?? row.rule ?? row.alert_rule, "告警规则待确认"),
    eventText: sanitizeText(row.event_text ?? row.title ?? row.description ?? row.reason, "告警事件待确认"),
    notificationStatus: sanitizeText(row.notification_status ?? row.notification?.status, "通知状态待确认"),
    status,
    ackStatus: sanitizeText(row.ack_status ?? row.acked_at ?? (status === "ACKED" ? "已 ACK" : "未 ACK"), "未 ACK"),
    closeStatus: sanitizeText(row.close_status ?? row.closed_at ?? (status === "CLOSED" ? "已关闭" : "未关闭"), "未关闭"),
    ownerName: sanitizeText(row.owner_name ?? row.owner ?? row.assignee_name, "责任人待确认"),
    fieldName: sanitizeText(row.field_name ?? row.fieldName, ""),
    operationId,
    prescriptionFormed: typeof prescriptionRaw === "boolean" ? prescriptionRaw : (text(prescriptionRaw) ? true : null),
    overdue: status === "OVERDUE",
    createdAt: text(row.created_at ?? row.generated_at, ""),
    updatedAt: text(row.updated_at ?? row.resolved_at ?? row.generated_at, ""),
    canAck,
    canClose,
    permissionReason: sanitizeText(row.permission_reason ?? row.permissions?.reason ?? (!canAck && !canClose ? "当前不可操作" : ""), ""),
    auditText: sanitizeText(row.audit_id ?? row.audit_ref ?? row.audit?.id ?? row.status_source ?? row.source_of_status, "审计来源待确认"),
    statusSource: sanitizeText(row.status_source ?? row.source_of_status ?? row.state_source, "状态来源待确认"),
    source,
  };
}

function normalizeOfficialDevices(payload: unknown): OperatorDeviceItem[] {
  return arrayFrom(payload, ["devices", "device_items", "items"]).map((row, index) => normalizeDevice(row, index, "operator_devices_alerts_api"));
}

function normalizeOfficialAlerts(payload: unknown): OperatorAlertItem[] {
  return arrayFrom(payload, ["alerts", "alert_items", "events"]).map((row, index) => normalizeAlert(row, index, "operator_devices_alerts_api"));
}

function normalizeDeviceFallback(payload: unknown): OperatorDeviceItem[] {
  return arrayFrom(payload, ["devices", "items", "device_status", "data"]).map((row, index) => normalizeDevice(row, index, "devices_api"));
}

function normalizeAlertFallback(payload: unknown): OperatorAlertItem[] {
  return arrayFrom(payload, ["alerts", "items", "events", "data"]).map((row, index) => normalizeAlert(row, index, "alerts_api"));
}

function normalizeReportDeviceFallback(payload: unknown): OperatorDeviceItem[] {
  const riskFields = arrayFrom(payload, ["top_risk_fields", "risk_fields"]);
  return riskFields.slice(0, 8).flatMap((row, index) => {
    const reason = `${row.risk_reason ?? ""} ${Array.isArray(row.risk_reasons) ? row.risk_reasons.join(" ") : ""}`;
    if (!/offline|离线|device/i.test(reason)) return [];
    return [normalizeDevice({
      device_id: row.device_id ?? `field-device-${row.field_id ?? index}`,
      status: /offline|离线/i.test(reason) ? "OFFLINE" : "UNKNOWN",
      field_name: row.field_name,
      field_id: row.field_id,
      data_delay_text: "来自风险地块 fallback，设备明细未完整接入",
    }, index, "reports_aggregate")];
  });
}

async function fetchOptional(path: string): Promise<unknown | null> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

function parseActionFailure(status: number, bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { message?: string; error?: string; reason?: string; code?: string };
    return sanitizeText(parsed.message ?? parsed.reason ?? parsed.error ?? parsed.code, `操作失败：HTTP ${status}`);
  } catch {
    return sanitizeText(bodyText, `操作失败：HTTP ${status}`);
  }
}

async function postOperatorAlertAction(alertId: string, action: "ack" | "close"): Promise<OperatorAlertActionResult> {
  const safeAlertId = encodeURIComponent(text(alertId));
  if (!safeAlertId) return { ok: false, message: "alertId 缺失，无法操作。" };
  try {
    const result = await apiRequestWithPolicy<unknown>(`/api/v1/operator/alerts/${safeAlertId}/${action}`, { method: "POST", body: JSON.stringify({}) }, { allowedStatuses: [400, 401, 403, 404, 409, 422], silent: true, timeoutMs: 10000 });
    if (!result.ok) {
      return { ok: false, message: parseActionFailure(result.status, result.bodyText) };
    }
    const payload = result.data as AnyRecord;
    const auditText = sanitizeText(payload?.audit_id ?? payload?.audit_ref ?? payload?.audit?.id ?? payload?.status_source, "审计来源待确认");
    return { ok: true, message: action === "ack" ? "ACK 成功，列表已刷新。" : "关闭成功，列表已刷新。", auditText };
  } catch (error: any) {
    return { ok: false, message: sanitizeText(error?.message, "操作失败，请查看后端错误码。") };
  }
}

export async function ackOperatorAlert(alertId: string): Promise<OperatorAlertActionResult> {
  return postOperatorAlertAction(alertId, "ack");
}

export async function closeOperatorAlert(alertId: string): Promise<OperatorAlertActionResult> {
  return postOperatorAlertAction(alertId, "close");
}

export async function fetchOperatorDevicesAlerts(): Promise<OperatorDevicesAlertsResponse> {
  const official = await fetchOptional(withQuery("/api/v1/operator/devices-alerts"));
  const officialDevices = normalizeOfficialDevices(official);
  const officialAlerts = normalizeOfficialAlerts(official);
  if (officialDevices.length > 0 || officialAlerts.length > 0) {
    const ackCloseReady = officialAlerts.some((alert) => alert.canAck || alert.canClose);
    const revokeVisible = officialDevices.some((device) => device.canRevoke);
    return {
      source: "operator_devices_alerts_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      devices: officialDevices,
      alerts: officialAlerts,
      ackCloseReady,
      revokeVisible,
      message: ackCloseReady ? "ACK/close 操作由 operator alerts API 提供，状态变更应产生审计记录。" : "ACK/close 当前无可操作权限或后端未开放。",
    };
  }

  const [devices, alerts, aggregate] = await Promise.all([
    fetchOptional(withQuery("/api/v1/devices")),
    fetchOptional(withQuery("/api/v1/alerts")),
    fetchOptional(withQuery("/api/v1/reports/customer-dashboard/aggregate")),
  ]);

  const fallbackDevices = [
    ...normalizeDeviceFallback(devices),
    ...normalizeReportDeviceFallback(aggregate),
  ].filter((item, index, all) => all.findIndex((x) => x.deviceId === item.deviceId) === index);
  const fallbackAlerts = normalizeAlertFallback(alerts);

  if (fallbackDevices.length > 0 || fallbackAlerts.length > 0) {
    return {
      source: "fallback_existing_sources",
      dataScope: "FALLBACK_LIMITED",
      generated_at: new Date().toISOString(),
      devices: fallbackDevices,
      alerts: fallbackAlerts,
      ackCloseReady: false,
      revokeVisible: false,
      message: "当前展示 devices / alerts / reports aggregate 包装后的有限设备与告警中心，非完整 operator devices-alerts；ACK/close 只读。",
    };
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    devices: [],
    alerts: [],
    ackCloseReady: false,
    revokeVisible: false,
    message: "暂无设备或告警数据。",
  };
}
