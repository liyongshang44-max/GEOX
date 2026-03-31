export type UiLocale = "zh" | "en";

export function getUiLocale(input?: string | null): UiLocale {
  if (input === "en" || input === "en-US") return "en";
  if (input === "zh" || input === "zh-CN") return "zh";
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem("geox.locale");
    if (raw === "en" || raw === "en-US") return "en";
  }
  return "zh";
}

export function localizeOperationType(
  value?: string | null,
  locale: UiLocale = "zh"
): string {
  const raw = String(value ?? "").trim().toUpperCase();

  const zhMap: Record<string, string> = {
    IRRIGATE: "灌溉",
    SEED: "播种",
    SOW: "播种",
    FERTILIZE: "施肥",
    SPRAY: "病虫防治",
    HARVEST: "收获",
    PLOW: "耕地",
  };

  const enMap: Record<string, string> = {
    IRRIGATE: "Irrigation",
    SEED: "Seeding",
    SOW: "Seeding",
    FERTILIZE: "Fertilization",
    SPRAY: "Crop Protection",
    HARVEST: "Harvest",
    PLOW: "Tillage",
  };

  if (!raw) return locale === "en" ? "Operation" : "作业";
  return locale === "en" ? enMap[raw] ?? raw : zhMap[raw] ?? raw;
}

export function localizeOperationStatus(
  value?: string | null,
  locale: UiLocale = "zh"
): string {
  const raw = String(value ?? "").trim().toUpperCase();

  const zhMap: Record<string, string> = {
    READY: "待执行",
    DISPATCHED: "已下发",
    ACKED: "执行中",
    SUCCEEDED: "已完成",
    SUCCESS: "已完成",
    FAILED: "异常",
    ERROR: "异常",
    PENDING: "待处理",
    PENDING_ACCEPTANCE: "待验收",
    INVALID_EXECUTION: "执行无效",
  };

  const enMap: Record<string, string> = {
    READY: "Ready",
    DISPATCHED: "Dispatched",
    ACKED: "In Progress",
    SUCCEEDED: "Completed",
    SUCCESS: "Completed",
    FAILED: "Failed",
    ERROR: "Failed",
    PENDING: "Pending",
    PENDING_ACCEPTANCE: "Pending Acceptance",
    INVALID_EXECUTION: "Invalid Execution",
  };

  if (!raw) return locale === "en" ? "Unknown" : "未知";
  return locale === "en" ? enMap[raw] ?? raw : zhMap[raw] ?? raw;
}

export function localizeFieldName(
  value?: string | null,
  locale: UiLocale = "zh"
): string {
  const raw = String(value ?? "").trim();

  if (!raw) return locale === "en" ? "Unassigned Field" : "未分配田块";
  if (raw === "field_c8_demo") {
    return locale === "en" ? "C8 Demo Field" : "C8 演示田块";
  }
  return raw;
}

export function localizeDeviceName(
  value?: string | null,
  locale: UiLocale = "zh"
): string {
  const raw = String(value ?? "").trim();

  if (!raw) return locale === "en" ? "Unassigned Device" : "未分配设备";
  if (raw === "dev_onboard_accept_001") {
    return locale === "en" ? "Device 001" : "接入设备 001";
  }
  return raw;
}

export function formatRelativeUpdateTime(
  value?: string | number | null,
  locale: UiLocale = "zh"
): string {
  if (value == null || value === "") return locale === "en" ? "Unknown" : "未知";

  const text = String(value).trim();
  if (!text) return locale === "en" ? "Unknown" : "未知";

  if (/^\d+$/.test(text)) {
    const ts = Number(text);
    if (!Number.isFinite(ts)) return text;

    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    const date = new Date(ts);

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    if (diffMin < 1) return locale === "en" ? "Just now" : "刚刚";
    if (diffMin < 60) return locale === "en" ? `${diffMin} min ago` : `${diffMin} 分钟前`;
    if (diffHour < 24) return locale === "en" ? `${diffHour} h ago` : `${diffHour} 小时前`;
    if (diffDay === 1) return locale === "en" ? `Yesterday ${hh}:${mm}` : `昨天 ${hh}:${mm}`;
    return locale === "en"
      ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${hh}:${mm}`
      : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
  }

  return text;
}

type BuildOperationSummaryInput = {
  type?: string | null;
  status?: string | null;
  fieldName?: string | null;
  deviceName?: string | null;
  locale?: UiLocale;
};

export function buildOperationSummary(input: BuildOperationSummaryInput): string;
export function buildOperationSummary(status?: string | null, type?: string | null, locale?: UiLocale): string;
export function buildOperationSummary(
  inputOrStatus?: BuildOperationSummaryInput | string | null,
  typeMaybe?: string | null,
  localeMaybe?: UiLocale
): string {
  if (typeof inputOrStatus === "object" && inputOrStatus !== null) {
    const locale = inputOrStatus.locale ?? "zh";
    const type = localizeOperationType(inputOrStatus.type, locale);
    const status = localizeOperationStatus(inputOrStatus.status, locale);
    const fieldName = localizeFieldName(inputOrStatus.fieldName, locale);
    const deviceName = localizeDeviceName(inputOrStatus.deviceName, locale);
    return `${type} · ${fieldName} · ${deviceName} · ${status}`;
  }

  const locale = localeMaybe ?? "zh";
  const type = localizeOperationType(typeMaybe, locale);
  const status = localizeOperationStatus(inputOrStatus, locale);
  return `${type} · ${status}`;
}

// 兼容旧页面导出名
export function mapFieldDisplayName(primary?: string | null, fallback?: string | null, locale: UiLocale = "zh"): string {
  return localizeFieldName(primary || fallback, locale);
}

export function mapDeviceDisplayName(primary?: string | null, fallback?: string | null, locale: UiLocale = "zh"): string {
  return localizeDeviceName(primary || fallback, locale);
}

export function mapOperationActionLabel(value?: string | null, locale: UiLocale = "zh"): string {
  return localizeOperationType(value, locale);
}

export function mapOperationStatusLabel(value?: string | null, locale: UiLocale = "zh"): string {
  return localizeOperationStatus(value, locale);
}
