import type { OperatorAlertItem, OperatorAlertStatus, OperatorCredentialStatus, OperatorDeviceItem, OperatorDeviceOnlineStatus, OperatorDevicesAlertsQuery, OperatorDevicesAlertsResponse } from "../api/operatorDevicesAlerts";
import { mapOperatorStatusLabel, replaceOperatorTerms } from "../lib/operatorStatusLabels";

export type OperatorDeviceRowVm = {
  deviceId: string;
  fieldId?: string | null;
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
  highlighted: boolean;
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
  limitedSummaryText: string;
  detailFallbackText: string;
  visibleOfflineText: string;
};

export type OperatorDeviceOfflineFocusMode = "IDLE" | "DEVICE_MATCHED" | "AGGREGATE_ONLY" | "MISSING_LOCATION" | "DEVICE_NOT_FOUND";

export type OperatorDeviceOfflineFocusVm = {
  active: boolean;
  mode: OperatorDeviceOfflineFocusMode;
  title: string;
  description: string;
  deviceIdText: string;
  fieldText: string;
  lastHeartbeatText: string;
  lastTelemetryText: string;
  delayText: string;
  statusText: string;
  handlingStatusText: string;
  auditText: string;
  nextSteps: string[];
  matchedDevice?: OperatorDeviceRowVm | null;
  relatedFieldHref?: string | null;
  returnHref: string;
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
  if (value === "operator_devices_alerts_api") return "设备与告警明细接口";
  if (value === "devices_api") return "设备明细补充接口";
  if (value === "alerts_api") return "告警明细补充接口";
  return "报告聚合补充数据";
}

function batteryText(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "电量待确认";
  return value <= 20 ? `低电量 ${value}%` : `${value}%`;
}

function operationHref(operationId: unknown): string | null {
  const id = String(operationId ?? "").trim();
  return id ? `/customer/operations/${encodeURIComponent(id)}` : null;
}

function disabledReason(item: OperatorAlertItem): string {
  if (item.canAck || item.canClose) return "";
  if (item.source !== "operator_devices_alerts_api") return "当前记录只读，需等待设备与告警明细接口开放操作。";
  return text(item.permissionReason, "当前身份无确认或关闭权限。") || "当前身份无确认或关闭权限。";
}

function isTargetDevice(item: OperatorDeviceItem, query?: OperatorDevicesAlertsQuery): boolean {
  const deviceId = text(query?.deviceId);
  const fieldId = text(query?.fieldId);
  if (deviceId && item.deviceId !== deviceId) return false;
  if (fieldId && text(item.fieldId) !== fieldId) return false;
  return Boolean(deviceId);
}

function buildDeviceRow(item: OperatorDeviceItem, query?: OperatorDevicesAlertsQuery): OperatorDeviceRowVm {
  const title = text(item.displayName, item.deviceId);
  return {
    deviceId: item.deviceId,
    fieldId: item.fieldId ?? null,
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
    highlighted: isTargetDevice(item, query),
  };
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
  if (response.dataScope === "FALLBACK_LIMITED") return "当前显示有限设备状态摘要";
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
    explanationText: `设备中心按统一统计口径展示：全域 ${global}，可见 ${visible}，当前地块 ${field}，离线 ${offline}，告警 ${alerts}。`,
    limitedSummaryText: "当前显示有限设备状态摘要",
    detailFallbackText: "设备明细接口尚未返回完整列表，当前以统一统计口径展示",
    visibleOfflineText: `当前可见设备 ${visible} 台，其中 ${offline} 台离线`,
  };
}

function handlingStatusText(mode: OperatorDeviceOfflineFocusMode): string {
  if (mode === "DEVICE_MATCHED") return "OPEN";
  if (mode === "AGGREGATE_ONLY") return "READ_ONLY";
  if (mode === "MISSING_LOCATION") return "READ_ONLY";
  if (mode === "DEVICE_NOT_FOUND") return "FOLLOWUP_REQUIRED";
  return "READ_ONLY";
}

function buildFocusVm(query: OperatorDevicesAlertsQuery | undefined, offlineDevices: OperatorDeviceRowVm[]): OperatorDeviceOfflineFocusVm {
  const focus = text(query?.focus);
  const deviceId = text(query?.deviceId);
  const fieldId = text(query?.fieldId);
  const source = text(query?.source);
  const active = focus === "device_offline" || Boolean(deviceId || fieldId || source === "aggregate");
  const matchedDevice = deviceId ? offlineDevices.find((item) => item.deviceId === deviceId && (!fieldId || item.fieldId === fieldId || item.boundFieldText.includes(fieldId))) ?? null : null;
  const mode: OperatorDeviceOfflineFocusMode = !active ? "IDLE" : (matchedDevice ? "DEVICE_MATCHED" : (source === "aggregate" && !deviceId ? "AGGREGATE_ONLY" : (!deviceId ? "MISSING_LOCATION" : "DEVICE_NOT_FOUND")));
  const relatedFieldHref = fieldId ? `/customer/fields/${encodeURIComponent(fieldId)}` : null;
  const title = mode === "DEVICE_MATCHED" ? "正在处理：设备离线" : (mode === "MISSING_LOCATION" ? "缺少设备定位信息" : "设备离线处理");
  const aggregateDescription = "该待办来自聚合统计，当前没有设备明细。";
  const missingDescription = "缺少设备定位信息，无法定位目标设备。请返回运营总队列查看原始待办来源。";
  const deviceDescription = "已定位目标离线设备。先确认最近心跳与遥测，再安排现场复核或设备维护。";
  const notFoundDescription = "操作未完成：缺少权限 / 后端接口未开放 / 设备不存在 / 设备明细不可用";
  return {
    active,
    mode,
    title,
    description: mode === "DEVICE_MATCHED" ? deviceDescription : (mode === "AGGREGATE_ONLY" ? aggregateDescription : (mode === "MISSING_LOCATION" ? missingDescription : notFoundDescription)),
    deviceIdText: matchedDevice?.deviceId ?? (deviceId || "未定位到设备"),
    fieldText: matchedDevice?.boundFieldText ?? (fieldId || "地块待确认"),
    lastHeartbeatText: matchedDevice?.lastHeartbeatText ?? "待设备中心返回",
    lastTelemetryText: matchedDevice?.lastTelemetryText ?? "待设备中心返回",
    delayText: matchedDevice?.delayText ?? "数据延迟待确认",
    statusText: matchedDevice?.statusText ?? (mode === "AGGREGATE_ONLY" ? "聚合统计" : (mode === "MISSING_LOCATION" ? "缺少定位" : "设备明细不可用")),
    handlingStatusText: handlingStatusText(mode),
    auditText: mode === "DEVICE_MATCHED" ? "审计状态：已定位设备，允许记录离线确认。" : "审计状态：只记录排查入口、设备/地块范围、后续人工核查建议。",
    nextSteps: [
      "核对最近心跳与最近遥测时间，确认是否为通信中断、供电问题或设备维护状态。",
      "核对绑定地块，确认离线影响的观测范围与是否影响当前验收证据。",
      "需要现场处理时，先记录需人工核查；未完成复核前不得对客户展示执行成功。",
    ],
    matchedDevice,
    relatedFieldHref,
    returnHref: "/operator/workbench",
  };
}

export function buildOperatorDevicesAlertsVm(response: OperatorDevicesAlertsResponse, query?: OperatorDevicesAlertsQuery): OperatorDevicesAlertsVm {
  const devices = (response.devices ?? []).map((item) => buildDeviceRow(item, query));
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
