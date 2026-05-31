import type { OperatorAlertItem, OperatorAlertStatus, OperatorCredentialStatus, OperatorDeviceItem, OperatorDeviceOnlineStatus, OperatorDevicesAlertsQuery, OperatorDevicesAlertsResponse } from "../api/operatorDevicesAlerts";
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

export type OperatorDeviceScopeVm = {
  globalDevicesText: string;
  visibleDevicesText: string;
  fieldDevicesText: string;
  offlineDevicesText: string;
  alertEventsText: string;
  sourceText: string;
  explanationText: string;
};

export type OperatorDeviceOfflineFocusVm = {
  active: boolean;
  title: string;
  description: string;
  deviceIdText: string;
  fieldText: string;
  lastHeartbeatText: string;
  lastTelemetryText: string;
  delayText: string;
  statusText: string;
  auditText: string;
  nextSteps: string[];
  matchedDevice?: OperatorDeviceRowVm | null;
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
  deviceScope: OperatorDeviceScopeVm;
  focus: OperatorDeviceOfflineFocusVm;
  onlineDevices: OperatorDeviceRowVm[];
  offlineDevices: OperatorDeviceRowVm[];
  delayedDevices: OperatorDeviceRowVm[];
  lowBatteryDevices: OperatorDeviceRowVm[];
  alerts: OperatorAlertRowVm[];
  overdueAlerts: OperatorAlertRowVm[];
  emptyTitle: string;
  emptyDescription: string;
};

const numberFmt = new Intl.NumberFormat("zh-CN");

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return replaceOperatorTerms(raw);
}

function countText(value: number | null | undefined, fallback = "未返回"): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFmt.format(Math.max(0, value)) : fallback;
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

function buildScopeVm(response: OperatorDevicesAlertsResponse): OperatorDeviceScopeVm {
  const scope = response.deviceScope;
  const global = countText(scope.global_devices_count);
  const visible = countText(scope.visible_devices_count);
  const field = countText(scope.field_devices_count);
  const offline = countText(scope.offline_devices_count);
  const alerts = countText(scope.alert_events_count);
  return {
    globalDevicesText: `全域设备：${global === "未返回" ? "后端未返回" : `${global} 台`}`,
    visibleDevicesText: `可见授权设备：${visible} 台`,
    fieldDevicesText: `当前地块设备：${field === "未返回" ? "需进入地块报告查看" : `${field} 台`}`,
    offlineDevicesText: `离线设备：${offline} 台`,
    alertEventsText: `告警事件：${alerts} 条`,
    sourceText: `设备口径来源：${text(scope.source_text, "设备范围来源待确认")}`,
    explanationText: `设备中心按统一 scope 展示：global_devices_count=${global}，visible_devices_count=${visible}，field_devices_count=${field}，offline_devices_count=${offline}，alert_events_count=${alerts}。`,
  };
}

function buildFocusVm(query: OperatorDevicesAlertsQuery | undefined, offlineDevices: OperatorDeviceRowVm[]): OperatorDeviceOfflineFocusVm {
  const active = text(query?.focus) === "device_offline" || Boolean(text(query?.deviceId) || text(query?.fieldId));
  const deviceId = text(query?.deviceId, "待确认");
  const fieldId = text(query?.fieldId, "待确认");
  const matchedDevice = offlineDevices.find((item) => (query?.deviceId ? item.deviceId === query.deviceId : true) && (query?.fieldId ? item.boundFieldText.includes(String(query.fieldId)) : true)) ?? null;
  return {
    active,
    title: "设备离线处理",
    description: active ? "从运营总队列进入的设备离线事项。先确认最近心跳与遥测，再安排现场复核或设备维护；此流程不生成正式作业成功结论。" : "未从设备离线队列进入，当前按设备与告警中心总览展示。",
    deviceIdText: matchedDevice?.deviceId ?? deviceId,
    fieldText: matchedDevice?.boundFieldText ?? fieldId,
    lastHeartbeatText: matchedDevice?.lastHeartbeatText ?? "待设备中心返回",
    lastTelemetryText: matchedDevice?.lastTelemetryText ?? "待设备中心返回",
    delayText: matchedDevice?.delayText ?? "数据延迟待确认",
    statusText: matchedDevice?.statusText ?? (active ? "离线状态待确认" : "未聚焦设备"),
    auditText: active ? "审计策略：只记录离线排查入口、设备/地块范围、后续人工处理建议；不伪造 ACK、验收、ROI 或 Field Memory。" : "未触发离线处理审计入口。",
    nextSteps: [
      "核对最近心跳与最近遥测时间，确认是否为通信中断、供电问题或设备维护状态。",
      "核对绑定地块，确认离线影响的观测范围与是否影响当前验收证据。",
      "需要现场处理时，转人工巡检或维护任务；未完成复核前不得对客户展示执行成功。",
    ],
    matchedDevice,
  };
}

export function buildOperatorDevicesAlertsVm(response: OperatorDevicesAlertsResponse, query?: OperatorDevicesAlertsQuery): OperatorDevicesAlertsVm {
  const devices = (response.devices ?? []).map(buildDeviceRow);
  const alerts = (response.alerts ?? []).map(buildAlertRow);
  const deviceScope = buildScopeVm(response);
  const onlineDevices = devices.filter((item) => item.statusText === "在线");
  const offlineDevices = devices.filter((item) => item.statusText === "离线");
  const delayedDevices = devices.filter((item) => item.statusText === "数据延迟");
  const lowBatteryDevices = devices.filter((item) => item.batteryText.startsWith("低电量"));
  return {
    title: "设备与告警中心",
    lead: "查看设备在线状态、心跳、遥测、凭证状态、告警事件、通知、确认与关闭状态。",
    generatedAtText: dateText(response.generated_at),
    dataScopeText: dataScopeText(response),
    dataScopeWarning: response.dataScope === "FALLBACK_LIMITED" || response.dataScope === "OFFICIAL_OPERATOR_API" ? text(response.message) : undefined,
    ackCloseReady: response.ackCloseReady,
    revokeVisible: response.revokeVisible,
    totalDevices: response.deviceScope.visible_devices_count,
    totalAlerts: response.deviceScope.alert_events_count,
    deviceScope,
    focus: buildFocusVm(query, offlineDevices),
    onlineDevices,
    offlineDevices,
    delayedDevices,
    lowBatteryDevices,
    alerts,
    overdueAlerts: alerts.filter((item) => item.overdueText === "已超时"),
    emptyTitle: "暂无设备或告警数据",
    emptyDescription: "当前没有设备状态、告警事件、通知、确认或关闭记录可展示。",
  };
}
