export type FieldLang = "zh" | "en";
export type RiskKey = "normal" | "alert" | "unknown";

export const FIELD_TEXT = {
  zh: {
    title: "田块运营视图",
    desc: "统一查看地块状态、作业执行、告警风险与地图轨迹",
    back: "返回列表",
    refresh: "刷新",
    overview: "概览",
    map: "地图",
    operations: "作业",
    alerts: "告警",
    area: "地块面积",
    crop: "当前作物",
    season: "当前季节",
    devices: "设备数量",
    lastOperation: "最近作业",
    riskStatus: "风险状态",
    fieldName: "地块名称",
    currentSeason: "当前季节",
    currentStage: "当前阶段",
    currentStatus: "当前状态",
    activeAlerts: "当前告警数量",
    operationType: "作业类型",
    executionTime: "执行时间",
    source: "来源",
    status: "状态",
    device: "设备",
    durationWindow: "持续时间 / 时间窗口",
    alertType: "告警类型",
    severity: "严重程度",
    targetObject: "关联对象",
    time: "时间",
    suggestedAction: "建议动作",
    selectedObject: "选中对象详情",
    noData: "暂无数据",
    mapLegendTitle: "地图图例",
    fieldBoundary: "地块边界",
    devicePosition: "设备位置",
    operationTrack: "设备/作业轨迹",
    alertLocation: "告警位置",
    normal: "正常",
    attention: "需关注",
    alerting: "有告警",
    unknown: "未知",
    fromReceipt: "执行回执",
    fromSchedule: "任务计划",
    sourceRecommendation: "来自农业建议",
    sourceManual: "人工创建",
    opPlanned: "计划中",
    opRunning: "执行中",
    opCompleted: "已完成",
    opFailed: "失败",
    alertOpen: "未处理",
    alertAck: "已确认",
    alertClosed: "已关闭",
    devDebug: "开发调试信息（原始字段）",
  },
  en: {
    title: "Field Operations View",
    desc: "Monitor field status, operations, alerts, and map activity in one workspace",
    back: "Back to List",
    refresh: "Refresh",
    overview: "Overview",
    map: "Map",
    operations: "Operations",
    alerts: "Alerts",
    area: "Area",
    crop: "Crop",
    season: "Season",
    devices: "Devices",
    lastOperation: "Last Operation",
    riskStatus: "Risk Status",
    fieldName: "Field Name",
    currentSeason: "Current Season",
    currentStage: "Stage",
    currentStatus: "Status",
    activeAlerts: "Active Alerts",
    operationType: "Operation Type",
    executionTime: "Execution Time",
    source: "Source",
    status: "Status",
    device: "Device",
    durationWindow: "Duration / Time Window",
    alertType: "Alert Type",
    severity: "Severity",
    targetObject: "Target Object",
    time: "Time",
    suggestedAction: "Suggested Action",
    selectedObject: "Selected Object",
    noData: "No data",
    mapLegendTitle: "Map Legend",
    fieldBoundary: "Field Boundary",
    devicePosition: "Device Position",
    operationTrack: "Device / Operation Track",
    alertLocation: "Alert Location",
    normal: "Normal",
    attention: "Attention Needed",
    alerting: "Alerting",
    unknown: "Unknown",
    fromReceipt: "Receipt",
    fromSchedule: "Task Schedule",
    sourceRecommendation: "From Recommendation",
    sourceManual: "Manual",
    opPlanned: "Planned",
    opRunning: "In Progress",
    opCompleted: "Completed",
    opFailed: "Failed",
    alertOpen: "Open",
    alertAck: "Acknowledged",
    alertClosed: "Closed",
    devDebug: "Developer Debug Fields",
  },
} as const;

export function mapFieldStatusToLabel(status: string | null | undefined, lang: FieldLang): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "ACTIVE") return lang === "zh" ? "正常" : "Active";
  if (s === "PLANNED") return lang === "zh" ? "计划中" : "Planned";
  return lang === "zh" ? "未知" : "Unknown";
}

export function mapOperationTypeToLabel(type: string | null | undefined, lang: FieldLang): string {
  const t = String(type ?? "").toUpperCase();
  if (t.includes("IRRIG")) return lang === "zh" ? "灌溉作业" : "Irrigation Operation";
  if (t.includes("FERT")) return lang === "zh" ? "施肥作业" : "Fertilization Operation";
  if (t.includes("INSPECT") || t.includes("巡")) return lang === "zh" ? "巡检作业" : "Inspection Operation";
  return lang === "zh" ? "未知作业" : "Unknown Operation";
}

export function mapAlertTypeToLabel(type: string | null | undefined, lang: FieldLang): string {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("soil_moisture")) return lang === "zh" ? "土壤湿度" : "Soil Moisture";
  if (t.includes("temperature")) return lang === "zh" ? "温度异常" : "Temperature Anomaly";
  if (t.includes("offline") || t.includes("heartbeat")) return lang === "zh" ? "设备离线" : "Device Offline";
  return lang === "zh" ? "未知告警" : "Unknown Alert";
}

export function mapSourceFieldToLabel(source: string | null | undefined, lang: FieldLang): string {
  const s = String(source ?? "").toLowerCase();
  if (s.includes("receipt")) return FIELD_TEXT[lang].fromReceipt;
  if (s.includes("task") || s.includes("window")) return FIELD_TEXT[lang].fromSchedule;
  if (s.includes("recommend")) return FIELD_TEXT[lang].sourceRecommendation;
  return FIELD_TEXT[lang].sourceManual;
}

export function riskKey(detail: any): RiskKey {
  const alertCount = Number(detail?.recent_alerts?.length ?? 0);
  const recCount = Number(detail?.summary?.recommendation_count ?? 0);
  if (alertCount > 0) return "alert";
  if (recCount > 0 || detail?.field) return "normal";
  return "unknown";
}

export function formatRiskStatus(detail: any, lang: FieldLang): string {
  const key = riskKey(detail);
  if (key === "alert") return FIELD_TEXT[lang].alerting;
  if (key === "normal") return FIELD_TEXT[lang].normal;
  return FIELD_TEXT[lang].unknown;
}

export function getRiskColor(status: RiskKey): string {
  if (status === "normal") return "#1d6b42";
  if (status === "alert") return "#b42318";
  return "#667085";
}

export function shortId(v: string | null | undefined): string {
  const id = String(v ?? "").trim();
  if (!id) return "-";
  return id.length <= 12 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}
