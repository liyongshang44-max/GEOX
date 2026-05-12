const GENERIC_CODE_LABELS: Record<string, string> = {
  UNKNOWN: "未确认",
  USER_DECLARED: "人工申报",
  SYSTEM_INFERRED: "系统推断",
  SENSOR_INFERRED: "监测推断",
  AVAILABLE: "已接入",
  UNAVAILABLE: "暂不可用",
  UNOBSERVED: "暂无观测",
  OBSERVED: "已有观测",
  INSUFFICIENT: "信息不足",
  INSUFFICIENT_EVIDENCE: "证据不足，需复核",
  NOT_APPLICABLE: "不适用",
  PRE_PLANT: "播前阶段",
  FALLOW: "休耕",
  PLANTED_UNCONFIRMED: "已种植待确认",
  PENDING: "等待生成",
  MISSING: "暂无记录",
  DONE: "已形成",
  COMPLETE: "链路完整",
  COMPLETED: "已完成",
  SUCCESS: "已完成",
  FAILED: "未达到预期效果",
  PASS: "验收通过",
  FAIL: "未达到预期效果",
  VALID: "有效",
  INVALID_EXECUTION: "执行异常，建议复核作业证据",
  BASELINE_MISSING: "缺少收益基线，暂不形成可信收益结论",
  EVIDENCE_INSUFFICIENT: "证据不足，暂不能形成可信结论",
  HYPOTHESIS_ONLY: "仅形成价值假设，待后续证据验证",
  DEFAULT_ASSUMPTION: "默认假设，待证据验证",
  YIELD_LIFT_EXPECTED: "预期提升产量，待结果验证",
  PROJECTED: "已有投入产出预测，待执行结果验证",
  EXECUTED_PENDING_RESPONSE: "已执行，等待响应证据",
  INTERIM_SUPPORTED: "阶段性证据支持",
  INTERIM_NOT_SUPPORTED: "阶段性证据暂不支持",
  EXCLUDED_WEATHER: "受天气干扰，本次不进入效果学习",
  REALIZED: "收获后已形成结果记录",
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  IRRIGATE: "灌溉",
  FERTILIZE: "施肥",
  SPRAY: "喷药",
  INSPECT: "巡检",
};

const CROP_LABELS: Record<string, string> = {
  CORN: "玉米",
  MAIZE: "玉米",
  WHEAT: "小麦",
  SOYBEAN: "大豆",
  RICE: "水稻",
  COTTON: "棉花",
  TOMATO: "番茄",
  POTATO: "马铃薯",
};

const SOURCE_LABELS: Record<string, string> = {
  operation_report_v1: "作业报告摘要",
  customer_report_v1: "客户报告摘要",
  field_report_v1: "地块报告摘要",
  operation_plan_v1: "作业计划记录",
  ao_act_task_v0: "执行任务记录",
  ao_act_receipt_v0: "执行回执记录",
  approval_request_v1: "审批记录",
  roi_ledger_v1: "价值记录",
  field_memory_v1: "田块记忆记录",
  remote_sensing: "遥感观测",
  machinery: "农机作业记录",
  telemetry: "设备监测数据",
  sensor: "传感器监测数据",
  weather: "天气数据源",
  USER_DECLARED: "人工申报",
  SYSTEM_INFERRED: "系统推断",
  SENSOR_INFERRED: "监测推断",
};

const CHAIN_INTEGRITY_LABELS: Record<string, string> = {
  COMPLETE: "链路完整",
  PARTIAL: "链路不完整",
  LEGACY_OR_MANUAL: "历史/人工链路",
  MISSING: "链路记录不足",
};

function normalize(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeKey(raw: unknown): string {
  return normalize(raw).toUpperCase();
}

function isBlankText(raw: string): boolean {
  return !raw || raw === "--" || raw === "[object Object]" || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined";
}

function looksLikeMojibakeOrPlaceholder(text: string): boolean {
  const trimmed = text.trim();
  if (isBlankText(trimmed)) return true;
  if (/\?{2,}/.test(trimmed) || /�/.test(trimmed)) return true;
  if (/^\s*(地块名称待补充|未命名|unknown|UNKNOWN|null|undefined)\s*$/.test(trimmed)) return true;
  if (/^(field|fld|operation|op|rec|prc|apr|act|receipt|sha256)[_-][A-Za-z0-9_-]+$/.test(trimmed)) return true;
  if (/^[a-f0-9]{32,}$/i.test(trimmed)) return true;
  return false;
}

export function customerSemanticLabel(raw: unknown, fallback = "暂无记录"): string {
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  const key = normalizeKey(text);
  if (GENERIC_CODE_LABELS[key]) return GENERIC_CODE_LABELS[key];
  if (CROP_LABELS[key]) return CROP_LABELS[key];
  return text
    .replace(/\bUNKNOWN\b/gi, "未确认")
    .replace(/\bOBSERVED\b/g, "已有观测")
    .replace(/\bUSER_DECLARED\b/g, "人工申报")
    .replace(/\bPRE_PLANT\b/g, "播前阶段")
    .replace(/\bBASELINE_MISSING\b/g, "缺少收益基线，暂不形成可信收益结论")
    .replace(/\bDEFAULT_ASSUMPTION\b/g, "默认假设，待证据验证")
    .replace(/\bYIELD_LIFT_EXPECTED\b/g, "预期提升产量，待结果验证")
    .replace(/\bIRRIGATE\b/gi, "灌溉")
    .replace(/\bremote_sensing\b/gi, "遥感观测")
    .replace(/\bmachinery\b/gi, "农机作业记录")
    .replace(/\bgeometry\b/gi, "地块边界")
    .replace(/\bsha256\b/gi, "文件校验信息")
    .replace(/\bmanifest\b/gi, "证据清单")
    .replace(/\bchecksum\b/gi, "校验信息");
}

export function customerDisplayName(raw: unknown, fallback: string): string {
  const text = normalize(raw);
  if (looksLikeMojibakeOrPlaceholder(text)) return fallback;
  return customerSemanticLabel(text, fallback);
}

export function customerCropLabel(raw: unknown, fallback = "作物待确认"): string {
  return customerSemanticLabel(raw, fallback);
}

export function customerStageLabel(raw: unknown, fallback = "阶段待确认"): string {
  return customerSemanticLabel(raw, fallback);
}

export function customerSourceLabel(raw: unknown, fallback = "暂无数据来源"): string {
  const text = normalize(raw);
  if (isBlankText(text)) return fallback;
  if (/weather_unavailable/i.test(text)) return "天气源暂不可用";
  if (/^weather/i.test(text)) return "天气数据源";
  const key = normalizeKey(text);
  if (SOURCE_LABELS[text]) return SOURCE_LABELS[text];
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  if (/_v\d+$/i.test(text) || /^ao_act_/i.test(text)) return "系统记录摘要";
  return customerSemanticLabel(text, fallback);
}

export function customerChainIntegrityLabel(raw: unknown, fallback = "链路状态待确认"): string {
  const key = normalizeKey(raw);
  if (!key) return fallback;
  return CHAIN_INTEGRITY_LABELS[key] ?? customerSemanticLabel(raw, fallback);
}

export function isCustomerChainComplete(raw: unknown): boolean {
  return normalizeKey(raw) === "COMPLETE";
}

export function customerMissingInputsText(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "无";
  return raw.map((item) => customerSemanticLabel(item, "待补充输入")).filter(Boolean).join("、") || "无";
}
