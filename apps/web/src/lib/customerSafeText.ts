type CustomerEnumDomain = "status" | "acceptance" | "operation" | "source" | "risk" | "value" | "crop" | "generic" | string;

type CustomerNumberOptions = {
  fallback?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  unit?: string;
};

const RAW_ENUM_LABELS: Record<string, string> = {
  UNKNOWN: "未确认",
  NA: "暂无记录",
  N_A: "暂无记录",
  NOT_APPLICABLE: "不适用",
  OBSERVED: "已接入观测",
  UNOBSERVED: "暂无观测",
  USER_DECLARED: "人工声明",
  SYSTEM_INFERRED: "系统推断",
  SENSOR_INFERRED: "监测推断",
  AVAILABLE: "已接入",
  UNAVAILABLE: "暂不可用",
  COMPLETE: "完整",
  COMPLETED: "已完成",
  DONE: "已完成",
  SUCCESS: "已完成",
  SUCCEEDED: "已完成",
  PASS: "已通过",
  FAIL: "未通过",
  FAILED: "未通过",
  PENDING: "等待生成",
  PENDING_ACCEPTANCE: "等待验收",
  WAIT_ACCEPTANCE: "等待验收",
  IN_PROGRESS: "执行中",
  RUNNING: "执行中",
  VALID: "有效",
  INVALID_EXECUTION: "执行异常，建议复核作业证据",
  EVIDENCE_MISSING: "证据不足，暂不能验收",
  INSUFFICIENT_EVIDENCE: "证据不足，需复核",
  BASELINE_MISSING: "缺少收益基线",
  HYPOTHESIS_ONLY: "仅形成价值假设，待后续证据验证",
  DEFAULT_ASSUMPTION: "默认假设，待证据验证",
  YIELD_LIFT_EXPECTED: "预期提升产量，待结果验证",
  PROJECTED: "已有投入产出预测，待执行结果验证",
  EXECUTED_PENDING_RESPONSE: "已执行，等待响应证据",
  INTERIM_SUPPORTED: "阶段性证据支持",
  INTERIM_NOT_SUPPORTED: "阶段性证据暂不支持",
  EXCLUDED_WEATHER: "受天气干扰，本次不进入效果学习",
  REALIZED: "收获后已形成结果记录",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
  IRRIGATE: "灌溉",
  FERTILIZE: "施肥",
  SPRAY: "喷药",
  INSPECT: "巡检",
  PEST_CONTROL: "病虫害处理",
  HARVEST: "采收",
  REMOTE_SENSING: "遥感观测",
  MACHINERY: "农机作业记录",
  TELEMETRY: "设备监测数据",
  SENSOR: "传感器监测数据",
  WEATHER: "天气数据源",
  CORN: "玉米",
  MAIZE: "玉米",
  WHEAT: "小麦",
  SOYBEAN: "大豆",
  RICE: "水稻",
  COTTON: "棉花",
  TOMATO: "番茄",
  POTATO: "马铃薯",
  PRE_PLANT: "播前阶段",
  FALLOW: "休耕",
  PLANTED_UNCONFIRMED: "已种植待确认",
};

const DOMAIN_ENUM_LABELS: Record<string, Record<string, string>> = {
  acceptance: {
    PASS: "已通过",
    SUCCESS: "已通过",
    SUCCEEDED: "已通过",
    APPROVED: "已通过",
    FAIL: "未通过",
    FAILED: "未通过",
    REJECTED: "未通过",
    PENDING: "等待验收",
    PENDING_ACCEPTANCE: "等待验收",
    UNKNOWN: "未确认",
  },
  operation: {
    IRRIGATE: "灌溉",
    FERTILIZE: "施肥",
    SPRAY: "喷药",
    INSPECT: "巡检",
    PEST_CONTROL: "病虫害处理",
    HARVEST: "采收",
  },
  risk: {
    HIGH: "高风险",
    MEDIUM: "中风险",
    LOW: "低风险",
    UNKNOWN: "未确认",
  },
  source: {
    USER_DECLARED: "人工声明",
    SYSTEM_INFERRED: "系统推断",
    SENSOR_INFERRED: "监测推断",
    REMOTE_SENSING: "遥感观测",
    MACHINERY: "农机作业记录",
    TELEMETRY: "设备监测数据",
    SENSOR: "传感器监测数据",
    WEATHER: "天气数据源",
  },
  value: {
    BASELINE_MISSING: "缺少收益基线",
    HYPOTHESIS_ONLY: "仅形成价值假设，待后续证据验证",
    DEFAULT_ASSUMPTION: "默认假设，待证据验证",
    YIELD_LIFT_EXPECTED: "预期提升产量，待结果验证",
    MEASURED: "实测值",
    ESTIMATED: "估算值",
    ASSUMPTION_BASED: "基于假设",
  },
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEnumKey(value: unknown): string {
  return normalizeText(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function stripChineseSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-f]{32}$/i.test(value);
}

function looksLikeTechnicalId(value: string): boolean {
  return /^(rec|prc|apr|act|opl|ft_op|ft_field)_[A-Za-z0-9_-]+$/.test(value)
    || /^(recommendation|prescription|approval|operation|receipt|field|task|sha256)_[A-Za-z0-9_-]+$/i.test(value);
}

export function isUnsafeCustomerText(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const text = normalizeText(value);
  if (!text) return true;
  if (/\?{2,}/.test(text)) return true;
  if (/�/.test(text)) return true;
  const key = normalizeEnumKey(text);
  if (["UNKNOWN", "N_A", "NA", "NULL", "UNDEFINED"].includes(key)) return true;
  if (looksLikeUuid(text)) return true;
  if (looksLikeTechnicalId(text)) return true;
  return false;
}

export function mapCustomerEnum(value: unknown, domain: CustomerEnumDomain = "generic"): string {
  const text = normalizeText(value);
  if (!text) return "";
  const key = normalizeEnumKey(text);
  const domainLabels = DOMAIN_ENUM_LABELS[String(domain ?? "generic").toLowerCase()];
  if (domainLabels?.[key]) return domainLabels[key];
  if (RAW_ENUM_LABELS[key]) return RAW_ENUM_LABELS[key];
  return text
    .replace(/\bUNKNOWN\b/gi, "未确认")
    .replace(/\bUSER_DECLARED\b/g, "人工声明")
    .replace(/\bOBSERVED\b/g, "已接入观测")
    .replace(/\bBASELINE_MISSING\b/g, "缺少收益基线")
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

export function customerSafeName(value: unknown, fallback: string): string {
  if (isUnsafeCustomerText(value)) return fallback;
  return stripChineseSpace(mapCustomerEnum(value, "generic")) || fallback;
}

export function customerSafeTitle(value: unknown, fallback: string): string {
  if (isUnsafeCustomerText(value)) return fallback;
  return stripChineseSpace(mapCustomerEnum(value, "generic")) || fallback;
}

export function formatCustomerDate(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "暂无更新时间";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatCustomerNumber(value: unknown, options: CustomerNumberOptions = {}): string {
  const fallback = options.fallback ?? "暂无可信数值";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const text = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(n);
  return options.unit ? `${text}${options.unit}` : text;
}

export function formatMoneyOrUnavailable(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "暂无可信金额";
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(n);
}

export function formatRatioOrUnavailable(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "暂无可信比例";
  const ratio = Math.abs(n) <= 1 ? n * 100 : n;
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(ratio)}%`;
}
