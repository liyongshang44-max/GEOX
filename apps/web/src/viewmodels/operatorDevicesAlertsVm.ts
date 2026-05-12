import type { OperatorAlertItem, OperatorAlertStatus, OperatorCredentialStatus, OperatorDeviceItem, OperatorDeviceOnlineStatus, OperatorDevicesAlertsResponse } from "../api/operatorDevicesAlerts";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorDeviceRowVm = {
  deviceId: string;
  title: string;
  statusText: string;
  statusTone: "success" | "warning" | "danger" | "neutral";
  lastHeartbeatText: string;
  lastTelemetryText: string;
  boundFieldText: string;
  capabilitiesText: string;
  credentialText: string;
  credentialIssuedText: string;
  credentialLastUsedText: string;
  revokeText: string;
  canRevoke: boolean;
  batteryText: string;
  delayText: string;
  sourceText: string;
};

export type OperatorAlertRowVm = {
  alertId: string;
  ruleText: string;
  eventText: string;
  notificationText: string;
  statusText: string;
  statusTone: "success" | "warning" | "danger" | "neutral";
  ackText: string;
  closeText: string;
  ownerText: string;
  objectText: string;
  prescriptionText: string;
  overdueText: string;
  createdAtText: string;
  updatedAtText: string;
  sourceText: string;
  canAck: boolean;
  canClose: boolean;
  disabledReason: string;
  auditText: string;
  statusSourceText: string;
  operationHref?: string | null;
};

export type OperatorDevicesAlertsVm = {
  title: string;
  lead: string;
  generatedAtText: string;
  dataScopeText: string;
  dataScopeWarning?: string;
  ackCloseReady: boolean;
  revokeVisible: boolean;
  totalDevices: number;
  totalAlerts: number;
  onlineDevices: OperatorDeviceRowVm[];
  offlineDevices: OperatorDeviceRowVm[];
  delayedDevices: OperatorDeviceRowVm[];
  lowBatteryDevices: OperatorDeviceRowVm[];
  alerts: OperatorAlertRowVm[];
  overdueAlerts: OperatorAlertRowVm[];
  emptyTitle: string;
  emptyDescription: string;
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return replaceOperatorTerms(raw);
}

function dateText(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无记录";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return raw;
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function onlineStatusText(value: OperatorDeviceOnlineStatus): string {
  if (value === "ONLINE") return "在线";
  if (value === "OFFLINE") return "离线";
  if (value === "DELAYED") return "数据延迟";
  return mapOperatorStatusLabel(value, "device", "状态待确认");
}

function onlineTone(value: OperatorDeviceOnlineStatus): OperatorDeviceRowVm["statusTone"] {
  if (value === "ONLINE") return "success";
  if (value === "OFFLINE") return "danger";
  if (value === "DELAYED") return "warning";
  return "neutral";
}

function credentialText(value: OperatorCredentialStatus): string {
  if (value === "ACTIVE") return "凭证有效";
  if (value === "REVOKED") return "凭证已撤销";
  if (value === "HIDDEN") return "凭证敏感信息已隐藏";
  return "凭证状态待确认";
}

function alertStatusText(value: OperatorAlertStatus): string {
  if (value === "OPEN") return "待处理";
  if (value === "ACKED") return "已确认";
  if (value === "CLOSED") return "已关闭";
  if (value === "OVERDUE") return "已超时";
  return mapOperatorStatusLabel(value, "generic", "状态待确认");
}

function alertTone(value: OperatorAlertStatus): OperatorAlertRowVm["statusTone"] {
  if (value === "CLOSED") return "success";
  if (value === "ACKED" || value === "OPEN") return "warning";
  if (value === "OVERDUE") return "danger";
  return "neutral";
}

function sourceText(value: OperatorDeviceItem["source"] | OperatorAlertItem["source"]): string {
  if (value === "operator_devices_alerts_api") return "运营设备告警接口";
  if (value === "devices_api") return "设备接口 fallback";
  if (value === "alerts_api") return "告警接口 fallback";
  return "报告聚合 fallback";
}

function batteryText(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "电量待确认";
  return value <= 20 ? `低电量 ${value}%` : `${value}%`;
}

function buildDeviceRow(item: OperatorDeviceItem): OperatorDeviceRowVm {
  const title = text(item.displayName, item.deviceId);
  return {
    deviceId: item.deviceId,
    title,
    statusText: onlineStatusText(item.onlineStatus),
    statusTone: onlineTone(item.onlineStatus),
    lastHeartbeatText: dateText(item.lastHeartbeatAt),
    lastTelemetryText: dateText(item.lastTelemetryAt),
    boundFieldText: text(item.fieldName, text(item.fieldId, "绑定地块待确认")),
    capabilitiesText: item.capabilities.length ? item.capabilities.map((item) => text(item)).join("、") : "能力待确认",
    credentialText: credentialText(item.credentialStatus),
    credentialIssuedText: dateText(item.credentialLastIssuedAt),
    credentialLastUsedText: dateText(item.credentialLastUsedAt),
    revokeText: text(item.revokeStatus, "撤销默认只读或管理员可见"),
    canRevoke: item.canRevoke,
    batteryText: batteryText(item.batteryPercent),
    delayText: text(item.dataDelayText, "数据延迟待确认"),
    sourceText: sourceText(item.source),
  };
}

function operationHref(operationId: unknown): string | null {
  const id = String(operationId ?? "").trim();
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function disabledReason(item: OperatorAlertItem): string {
  if (item.canAck || item.canClose) return "";
  if (item.source !== "operator_devices_alerts_api") return "fallback 数据只读，需运营告警接口才能操作。";
  return text(item.permissionReason, "当前身份无确认或关闭权限。") || "当前身份无确认或关闭权限。";
}

function buildAlertRow(item: OperatorAlertItem): OperatorAlertRowVm {
  const objectParts = [text(item.fieldName), text(item.operationId)].filter(Boolean);
  return {
    alertId: item.alertId,
    ruleText: text(item.ruleName, "告警规则待确认"),
    eventText: text(item.eventText, "告警事件待确认"),
    notificationText: text(item.notificationStatus, "通知状态待确认"),
    statusText: alertStatusText(item.status),
    statusTone: alertTone(item.status),
    ackText: text(item.ackStatus, "未确认"),
    closeText: text(item.closeStatus, "未关闭"),
    ownerText: text(item.ownerName, "责任人待确认"),
    objectText: objectParts.length ? objectParts.join(" · ") : "关联对象待确认",
    prescriptionText: item.prescriptionFormed === true ? "已形成处方" : (item.prescriptionFormed === false ? "未形成处方" : "处方状态待确认"),
    overdueText: item.overdue ? "已超时" : "未超时",
    createdAtText: dateText(item.createdAt),
    updatedAtText: dateText(item.updatedAt),
    sourceText: sourceText(item.source),
    canAck: item.canAck,
    canClose: item.canClose,
    disabledReason: disabledReason(item),
    auditText: text(item.auditText, "审计来源待确认"),
    statusSourceText: text(item.statusSource, "状态来源待确认"),
    operationHref: operationHref(item.operationId),
  };
}

function dataScopeText(response: OperatorDevicesAlertsResponse): string {
  if (response.dataScope === "OFFICIAL_OPERATOR_API") return "正式设备与告警中心";
  if (response.dataScope === "FALLBACK_LIMITED") return "有限 fallback 设备告警数据";
  if (response.dataScope === "ERROR_EMPTY") return "设备与告警中心暂不可用";
  return "暂无设备或告警数据";
}

export function buildOperatorDevicesAlertsVm(response: OperatorDevicesAlertsResponse): OperatorDevicesAlertsVm {
  const devices = (response.devices ?? []).map(buildDeviceRow);
  const alerts = (response.alerts ?? []).map(buildAlertRow);
  return {
    title: "设备与告警中心",
    lead: "查看设备在线状态、心跳、遥测、凭证状态、告警事件、通知、确认与关闭状态。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" || response.dataScope === "OFFICIAL_OPERATOR_API" ? text(response.message) : undefined,
    ackCloseReady: response.ackCloseReady,
    revokeVisible: response.revokeVisible,
    totalDevices: devices.length,
    totalAlerts: alerts.length,
    onlineDevices: devices.filter((item) => item.statusText === "在线"),
    offlineDevices: devices.filter((item) => item.statusText === "离线"),
    delayedDevices: devices.filter((item) => item.statusText === "数据延迟"),
    lowBatteryDevices: devices.filter((item) => item.batteryText.startsWith("低电量")),
    alerts,
    overdueAlerts: alerts.filter((item) => item.overdueText === "已超时"),
    emptyTitle: "暂无设备或告警数据",
    emptyDescription: "当前没有设备状态、告警事件、通知、确认或关闭记录可展示。",
  };
}
