type CustomerEnumDomain = "status" | "acceptance" | "operation" | "source" | "risk" | "value" | "crop" | "generic" | string;

type CustomerNumberOptions = {
  fallback?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  unit?: string;
};

const REVIEW_REQUIRED = "需复核";

const ENUM_LABELS: Record<string, string> = {
  UNKNOWN: "未确认",
  NA: "暂无记录",
  N_A: "暂无记录",
  OBSERVED: "已接入观测",
  USER_DECLARED: "人工声明",
  SYSTEM_INFERRED: "系统推断",
  SENSOR_INFERRED: "监测推断",
  AVAILABLE: "已接入",
  UNAVAILABLE: "暂不可用",
  COMPLETE: "完整",
  COMPLETED: REVIEW_REQUIRED,
  DONE: REVIEW_REQUIRED,
  SUCCESS: REVIEW_REQUIRED,
  SUCCEEDED: REVIEW_REQUIRED,
  VALID: REVIEW_REQUIRED,
  PASS: REVIEW_REQUIRED,
  PASSED: REVIEW_REQUIRED,
  FAIL: "未通过",
  FAILED: "未通过",
  PENDING: "等待生成",
  PENDING_ACCEPTANCE: "等待验收",
  IN_PROGRESS: "执行中",
  RUNNING: "执行中",
  BASELINE_MISSING: "缺少收益基线",
  DEFAULT_ASSUMPTION: "默认假设，待证据验证",
  YIELD_LIFT_EXPECTED: "预期提升产量，待结果验证",
  HYPOTHESIS_ONLY: "仅形成价值假设，待后续证据验证",
  PROJECTED: "已有投入产出预测，待执行结果验证",
  IRRIGATE: "灌溉",
  FERTILIZE: "施肥",
  SPRAY: "喷药",
  INSPECT: "巡检",
  PEST_CONTROL: "病虫害处理",
  HARVEST: "采收",
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
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
};

const DOMAIN_LABELS: Record<string, Record<string, string>> = {
  status: { SUCCESS: REVIEW_REQUIRED, SUCCEEDED: REVIEW_REQUIRED, COMPLETED: REVIEW_REQUIRED, DONE: REVIEW_REQUIRED, VALID: REVIEW_REQUIRED, PASS: REVIEW_REQUIRED, PASSED: REVIEW_REQUIRED, FAIL: "未通过", FAILED: "未通过", PENDING: "等待生成", PENDING_ACCEPTANCE: "等待验收", UNKNOWN: "未确认" },
  acceptance: { PASS: REVIEW_REQUIRED, PASSED: REVIEW_REQUIRED, SUCCESS: REVIEW_REQUIRED, SUCCEEDED: REVIEW_REQUIRED, VALID: REVIEW_REQUIRED, FAIL: "未通过", FAILED: "未通过", PENDING: "等待验收", PENDING_ACCEPTANCE: "等待验收", UNKNOWN: "未确认" },
  operation: { IRRIGATE: "灌溉", FERTILIZE: "施肥", SPRAY: "喷药", INSPECT: "巡检", PEST_CONTROL: "病虫害处理", HARVEST: "采收" },
  risk: { HIGH: "高风险", MEDIUM: "中风险", LOW: "低风险", UNKNOWN: "未确认" },
  source: { USER_DECLARED: "人工声明", SYSTEM_INFERRED: "系统推断", SENSOR_INFERRED: "监测推断", REMOTE_SENSING: "遥感观测", MACHINERY: "农机作业记录" },
  value: { BASELINE_MISSING: "缺少收益基线", DEFAULT_ASSUMPTION: "默认假设，待证据验证", YIELD_LIFT_EXPECTED: "预期提升产量，待结果验证" },
};

const TECH_PREFIXES = ["rec_", "prc_", "apr_", "act_", "opl_", "ft_op_", "ft_field_"];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function replaceToken(value: string, from: string, to: string): string {
  return value.split(from).join(to);
}

function key(value: unknown): string {
  let result = text(value);
  result = replaceToken(result, "/", "_");
  result = replaceToken(result, "-", "_");
  result = replaceToken(result, " ", "_");
  return result.toUpperCase();
}

function isHex(value: string): boolean {
  return Boolean(value) && [...value].every((ch) => "0123456789abcdefABCDEF".includes(ch));
}

function isUuid(value: string): boolean {
  const parts = value.split("-");
  if (parts.length === 5 && [8, 4, 4, 4, 12].every((len, index) => parts[index]?.length === len)) return parts.every(isHex);
  return value.length === 32 && isHex(value);
}

function isTechnicalId(value: string): boolean {
  const lower = value.toLowerCase();
  return TECH_PREFIXES.some((prefix) => lower.startsWith(prefix) && lower.length > prefix.length);
}

export function isUnsafeCustomerText(value: unknown): boolean {
  const raw = text(value);
  if (!raw) return true;
  if (raw.includes("??????") || raw.includes("�")) return true;
  const enumKey = key(raw);
  if (["UNKNOWN", "N_A", "NA", "NULL", "UNDEFINED"].includes(enumKey)) return true;
  if (isUuid(raw)) return true;
  if (isTechnicalId(raw)) return true;
  return false;
}

export function mapCustomerEnum(value: unknown, domain: CustomerEnumDomain = "generic"): string {
  const raw = text(value);
  if (!raw) return "";
  const enumKey = key(raw);
  const domainMap = DOMAIN_LABELS[String(domain ?? "generic").toLowerCase()];
  if (domainMap?.[enumKey]) return domainMap[enumKey];
  if (ENUM_LABELS[enumKey]) return ENUM_LABELS[enumKey];
  let result = raw;
  result = replaceToken(result, "UNKNOWN", "未确认");
  result = replaceToken(result, "USER_DECLARED", "人工声明");
  result = replaceToken(result, "OBSERVED", "已接入观测");
  result = replaceToken(result, "BASELINE_MISSING", "缺少收益基线");
  result = replaceToken(result, "IRRIGATE", "灌溉");
  result = replaceToken(result, "remote_sensing", "遥感观测");
  result = replaceToken(result, "machinery", "农机作业记录");
  result = replaceToken(result, "geometry", "地块边界");
  result = replaceToken(result, "sha256", "文件校验信息");
  result = replaceToken(result, "manifest", "证据清单");
  result = replaceToken(result, "checksum", "校验信息");
  return result;
}

export function customerSafeName(value: unknown, fallback: string): string {
  return isUnsafeCustomerText(value) ? fallback : (mapCustomerEnum(value, "generic") || fallback);
}

export function customerSafeTitle(value: unknown, fallback: string): string {
  return isUnsafeCustomerText(value) ? fallback : (mapCustomerEnum(value, "generic") || fallback);
}

export function formatCustomerDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "暂无更新时间";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatCustomerNumber(value: unknown, options: CustomerNumberOptions = {}): string {
  const fallback = options.fallback ?? "暂无可信数值";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const formatted = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: options.maximumFractionDigits ?? 2, minimumFractionDigits: options.minimumFractionDigits ?? 0 }).format(n);
  return options.unit ? `${formatted}${options.unit}` : formatted;
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
