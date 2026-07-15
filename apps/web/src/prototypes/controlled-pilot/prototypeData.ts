export type PrototypeSection = "overview" | "twin" | "scenarios" | "execution" | "audit";

export type FieldStatus = "stable" | "observe" | "action";

export interface FieldSnapshot {
  id: string;
  name: string;
  crop: string;
  area: string;
  moisture: number;
  status: FieldStatus;
  statusLabel: string;
  evidenceCount: number;
  lastObserved: string;
}

export interface ScenarioOption {
  id: string;
  label: string;
  subtitle: string;
  waterMm: number;
  startWindow: string;
  projectedMoisture: number;
  confidence: number;
  resourceIndex: number;
  note: string;
  recommended?: boolean;
}

export interface EvidenceRecord {
  id: string;
  source: string;
  observedAt: string;
  kind: string;
  status: "verified" | "pending";
}

export interface WorkflowStep {
  id: string;
  label: string;
  detail: string;
  state: "complete" | "active" | "waiting";
}

export const prototypeSections: Array<{ id: PrototypeSection; label: string; eyebrow: string }> = [
  { id: "overview", label: "运行总览", eyebrow: "OPERATIONS" },
  { id: "twin", label: "田块孪生", eyebrow: "FIELD TWIN" },
  { id: "scenarios", label: "情景推演", eyebrow: "SCENARIOS" },
  { id: "execution", label: "执行闭环", eyebrow: "AO-ACT" },
  { id: "audit", label: "证据审计", eyebrow: "TRACEABILITY" },
];

export const fields: FieldSnapshot[] = [
  {
    id: "field-n17",
    name: "北区 17 号田块",
    crop: "夏玉米 · V8",
    area: "42.6 ha",
    moisture: 31,
    status: "action",
    statusLabel: "进入人工复核",
    evidenceCount: 128,
    lastObserved: "2 分钟前",
  },
  {
    id: "field-e04",
    name: "东区 04 号田块",
    crop: "夏玉米 · V7",
    area: "35.2 ha",
    moisture: 46,
    status: "stable",
    statusLabel: "状态稳定",
    evidenceCount: 94,
    lastObserved: "4 分钟前",
  },
  {
    id: "field-s09",
    name: "南区 09 号田块",
    crop: "大豆 · R1",
    area: "28.8 ha",
    moisture: 38,
    status: "observe",
    statusLabel: "持续观察",
    evidenceCount: 76,
    lastObserved: "6 分钟前",
  },
];

export const scenarios: ScenarioOption[] = [
  {
    id: "hold",
    label: "保持现状",
    subtitle: "未来 24 小时不执行灌溉",
    waterMm: 0,
    startWindow: "—",
    projectedMoisture: 22,
    confidence: 81,
    resourceIndex: 100,
    note: "预计根区含水率继续下降，36 小时后可能越过当前管理阈值。",
  },
  {
    id: "targeted",
    label: "分区补水",
    subtitle: "仅处理证据支持的低含水区域",
    waterMm: 18,
    startWindow: "今晚 22:00–01:00",
    projectedMoisture: 39,
    confidence: 88,
    resourceIndex: 78,
    note: "用水量最低，预测可将主要根区恢复至目标区间；仍需人工确认设备可用性。",
    recommended: true,
  },
  {
    id: "uniform",
    label: "全田灌溉",
    subtitle: "按统一参数覆盖全部作业区",
    waterMm: 28,
    startWindow: "明日 00:00–04:00",
    projectedMoisture: 48,
    confidence: 91,
    resourceIndex: 51,
    note: "状态恢复更充分，但对当前已满足区域存在额外用水。",
  },
];

export const evidenceRecords: EvidenceRecord[] = [
  { id: "fact_8f31a", source: "CAF009 / 20 cm VWC", observedAt: "20:18:00", kind: "原始传感事实", status: "verified" },
  { id: "fact_8f32c", source: "北区气象站 / 降雨", observedAt: "20:15:00", kind: "原始传感事实", status: "verified" },
  { id: "weather_v17", source: "Weather Forecast v17", observedAt: "20:00:00", kind: "预测版本", status: "verified" },
  { id: "estimate_2d41", source: "Water State Estimate v1", observedAt: "20:19:14", kind: "系统派生对象", status: "verified" },
  { id: "scenario_set_07", source: "Irrigation Scenario Set", observedAt: "20:19:31", kind: "系统派生对象", status: "verified" },
  { id: "approval_pending", source: "Operator review", observedAt: "—", kind: "人工授权", status: "pending" },
];

export const workflow: WorkflowStep[] = [
  { id: "capture", label: "现实证据", detail: "128 条事实已进入 append-only 事实链", state: "complete" },
  { id: "estimate", label: "状态估计", detail: "根区含水状态已形成，置信度 86%", state: "complete" },
  { id: "scenario", label: "情景集合", detail: "3 个方案已完成同源比较", state: "complete" },
  { id: "approval", label: "人工复核", detail: "等待操作员确认时间窗与设备可用性", state: "active" },
  { id: "dispatch", label: "正式执行", detail: "AO-ACT 任务尚未生成", state: "waiting" },
  { id: "receipt", label: "执行回执", detail: "等待事实发生", state: "waiting" },
];

export const moistureSeries = [42, 41, 40, 39, 38, 37, 36, 34, 33, 32, 31];
export const forecastSeries = [31, 30, 29, 27, 26, 24, 23, 22];
