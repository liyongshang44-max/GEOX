// apps/web/src/lib/productCopy/operatorLocale.ts
// Purpose: define bilingual Operator display copy for read-only runtime review surfaces.
// Boundary: this catalog does not create execution, dispatch, live-device, production-gateway, or model-mutation capability.

import { localizedText, type LocaleCode, type LocalizedCopy } from "../locale";

export const OPERATOR_COMMON_COPY = {
  readOnly: { zh: "只读", en: "Read-only" },
  reviewOnly: { zh: "仅审查", en: "Review Only" },
  available: { zh: "可用", en: "Available" },
  unavailable: { zh: "不可用", en: "Unavailable" },
  blocked: { zh: "已阻断", en: "Blocked" },
  degraded: { zh: "降级", en: "Degraded" },
  sourceMissing: { zh: "来源缺失", en: "Source Missing" },
  evidenceUnavailable: { zh: "证据不可用", en: "Evidence Unavailable" },
  loading: { zh: "正在加载", en: "Loading" },
  route: { zh: "路由", en: "Route" },
  mode: { zh: "模式", en: "Mode" },
  source: { zh: "来源", en: "Source" },
  field: { zh: "地块", en: "Field" },
  status: { zh: "状态", en: "Status" },
  updated: { zh: "更新时间", en: "Updated" },
  boundary: { zh: "边界", en: "Boundary" },
  summary: { zh: "摘要", en: "Summary" },
  noExecution: { zh: "不直接执行", en: "No Direct Execution" },
  noDispatch: { zh: "不下发", en: "No Dispatch" },
  noTaskCreation: { zh: "不创建任务", en: "No Task Creation" },
  noModelMutation: { zh: "不修改模型状态", en: "No Model State Mutation" },
  liveDeviceNotConnected: { zh: "实时设备未连接", en: "Live Device Not Connected" },
  productionGatewayNotOnline: { zh: "生产网关未上线", en: "Production Gateway Not Online" },
  fieldPilotNotStarted: { zh: "田间试点未开始", en: "Field Pilot Not Started" },
  safeUnavailable: { zh: "当前只读运行来源暂不可用。", en: "The read-only runtime source is temporarily unavailable." },
  safeMissing: { zh: "当前没有可显示的来源记录。", en: "No source record is currently available." },
} as const satisfies Record<string, LocalizedCopy>;

export const OPERATOR_TWIN_COPY = {
  aria: { zh: "Operator 运行总览审查界面", en: "Operator Runtime Overview review surface" },
  eyebrow: { zh: "Operator / 运行总览", en: "Operator / Runtime Overview" },
  title: { zh: "运行总览", en: "Runtime Overview" },
  lead: { zh: "只读运行审查：汇总状态、证据、预测、情景、校准、健康与审计来源。", en: "Read-only runtime review summarizing state, evidence, forecast, scenario, calibration, health, and audit sources." },
  loadingTitle: { zh: "正在加载运行总览", en: "Loading Runtime Overview" },
  loadingLead: { zh: "正在读取只读运行来源。", en: "Reading the read-only runtime sources." },
  unavailableTitle: { zh: "运行总览暂不可用", en: "Runtime Overview Unavailable" },
  nonclaim: { zh: "只读运行审查；不是执行、下发、实时设备连接、生产网关上线或田间试点启动。", en: "Read-only runtime review; not execution, dispatch, live-device connection, production-gateway online state, or field-pilot start." },
  boundaryTitle: { zh: "只读运行审查边界", en: "Read-only Runtime Review Boundary" },
  boundaryLead: { zh: "本页只汇总现有运行读模型，不创建推荐、任务、回执或控制动作。", en: "This page summarizes existing runtime read models only and creates no recommendation, task, receipt, or control action." },
  sourceInventory: { zh: "来源清单", en: "Source Inventory" },
  sourceInventoryLead: { zh: "正式运行读模型的来源身份、可用状态和更新时间。", en: "Source identity, availability state, and update time for formal runtime read models." },
  sourceTable: { zh: "运行来源清单", en: "Runtime Source Inventory" },
  sourceName: { zh: "来源名称", en: "Source Name" },
  sourceIdentity: { zh: "来源身份", en: "Source Identity" },
  openReview: { zh: "打开审查", en: "Open Review" },
  sections: { zh: "运行审查区域", en: "Runtime Review Sections" },
  sectionsLead: { zh: "进入各个只读运行审查界面。", en: "Open each read-only runtime review surface." },
  noSources: { zh: "暂无运行来源", en: "No Runtime Sources" },
  noSourcesLead: { zh: "当前没有可显示的运行来源记录。", en: "No runtime source record is currently available." },
  mobileNote: { zh: "在窄屏中可横向滚动查看来源字段。", en: "On narrow screens, scroll horizontally to review source fields." },
  health: { zh: "运行健康", en: "Runtime Health" },
  sourceCount: { zh: "来源数量", en: "Source Count" },
  availableCount: { zh: "可用来源", en: "Available Sources" },
  blockedCount: { zh: "阻断来源", en: "Blocked Sources" },
  fieldScope: { zh: "地块范围", en: "Field Scope" },
  generatedAt: { zh: "生成时间", en: "Generated At" },
  reviewSurface: { zh: "只读运行审查", en: "Read-only Runtime Review" },
} as const satisfies Record<string, LocalizedCopy>;

export const OPERATOR_SOURCE_COPY = {
  state: { label: { zh: "状态", en: "State" }, summary: { zh: "当前估计状态与可信度回查。", en: "Current estimated state and confidence readback." } },
  evidence: { label: { zh: "证据", en: "Evidence" }, summary: { zh: "来源证据与追踪引用回查。", en: "Source evidence and trace-reference readback." } },
  forecast: { label: { zh: "预测", en: "Forecast" }, summary: { zh: "只读预测窗口与不确定性回查。", en: "Read-only forecast-window and uncertainty review." } },
  scenario: { label: { zh: "情景", en: "Scenario" }, summary: { zh: "只读情景比较，不创建任务或下发。", en: "Read-only scenario comparison without task creation or dispatch." } },
  residual: { label: { zh: "残差", en: "Residual" }, summary: { zh: "预测与观测残差回查。", en: "Forecast-to-observation residual review." } },
  calibration: { label: { zh: "校准", en: "Calibration" }, summary: { zh: "校准评审，不修改模型状态。", en: "Calibration review without model-state mutation." } },
  health: { label: { zh: "健康", en: "Health" }, summary: { zh: "运行健康回查，不是实时监控。", en: "Runtime health readback, not live monitoring." } },
  audit: { label: { zh: "审计", en: "Audit" }, summary: { zh: "来源与事件审计回查，不修改运行状态。", en: "Source and event audit readback without runtime mutation." } },
} as const satisfies Record<string, { label: LocalizedCopy; summary: LocalizedCopy }>;

export function operatorText(copy: LocalizedCopy, locale: LocaleCode): string {
  return localizedText(copy, locale);
}

export function operatorSourceLabel(key: string, locale: LocaleCode): string {
  return operatorText(OPERATOR_SOURCE_COPY[key as keyof typeof OPERATOR_SOURCE_COPY]?.label ?? { zh: key, en: key }, locale);
}

export function operatorSourceSummary(key: string, locale: LocaleCode): string {
  return operatorText(OPERATOR_SOURCE_COPY[key as keyof typeof OPERATOR_SOURCE_COPY]?.summary ?? OPERATOR_COMMON_COPY.safeUnavailable, locale);
}

export function operatorStatusLabel(raw: unknown, locale: LocaleCode): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["available", "ready", "ok", "pass", "可用"].includes(value)) return operatorText(OPERATOR_COMMON_COPY.available, locale);
  if (["blocked", "failed", "阻断", "已阻断"].includes(value)) return operatorText(OPERATOR_COMMON_COPY.blocked, locale);
  if (["degraded", "stale", "降级", "已过期"].includes(value)) return operatorText(OPERATOR_COMMON_COPY.degraded, locale);
  if (["missing", "source_missing", "来源缺失"].includes(value)) return operatorText(OPERATOR_COMMON_COPY.sourceMissing, locale);
  return operatorText(OPERATOR_COMMON_COPY.unavailable, locale);
}

export function operatorSafeDisplay(raw: unknown, locale: LocaleCode, fallback: LocalizedCopy): string {
  const value = String(raw ?? "").trim();
  if (!value) return operatorText(fallback, locale);
  const hasCjk = /[\u3400-\u9fff]/.test(value);
  const hasWords = /[A-Za-z]{3,}/.test(value);
  if (locale === "en-US" && hasCjk) return operatorText(fallback, locale);
  if (locale === "zh-CN" && hasWords && !/\b(?:GEOX|API|URL|JSON|SHA-256|AO-ACT|ID|ROI|VWC|CAF|P\d+)\b/.test(value)) return operatorText(fallback, locale);
  return value;
}
