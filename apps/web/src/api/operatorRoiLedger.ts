import { apiRequestWithPolicy, withQuery } from "./client";
import { fetchOperationReport } from "./reports";

export type OperatorRoiLedgerDataScope = "OFFICIAL_OPERATOR_API" | "FALLBACK_LIMITED" | "EMPTY" | "ERROR_EMPTY";
export type OperatorRoiValueKind = "MEASURED" | "ESTIMATED" | "ASSUMPTION" | "UNKNOWN";

export type OperatorRoiLedgerItem = {
  roiId: string;
  fieldId?: string | null;
  operationId?: string | null;
  prescriptionId?: string | null;
  evidenceRef?: string | null;
  calculationMethod?: string | null;
  confidenceText?: string | null;
  assumptionText?: string | null;
  createdAt?: string | null;
  valueKind: OperatorRoiValueKind;
  baselinePresent: boolean;
  actualPresent: boolean;
  metricText?: string | null;
  valueText?: string | null;
  source: "operator_roi_ledger_api" | "customer_roi_ledger_api" | "operation_report_embedded";
};

export type OperatorRoiLedgerResponse = {
  source: "operator_roi_ledger_api" | "fallback_existing_sources" | "empty_error_state";
  dataScope: OperatorRoiLedgerDataScope;
  generated_at?: string | null;
  items: OperatorRoiLedgerItem[];
  filters: { fieldId?: string; operationId?: string };
  message?: string;
};

type AnyRecord = Record<string, any>;

const ENABLE_OPERATOR_ROI_LEDGER_API = String((import.meta as any)?.env?.VITE_ENABLE_OPERATOR_ROI_LEDGER_API ?? "").toLowerCase() === "true";
const ENABLE_CUSTOMER_ROI_LEDGER_FALLBACK = String((import.meta as any)?.env?.VITE_ENABLE_CUSTOMER_ROI_LEDGER_FALLBACK ?? "").toLowerCase() === "true";

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function arrayFrom(payload: unknown, keys: string[]): AnyRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as AnyRecord;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object"));
  }
  if (obj.data) return arrayFrom(obj.data, keys);
  if (obj.items) return arrayFrom(obj.items, keys);
  return [];
}

function normalizeValueKind(value: unknown): OperatorRoiValueKind {
  const raw = text(value, "UNKNOWN").toUpperCase();
  if (raw === "MEASURED") return "MEASURED";
  if (raw === "ESTIMATED") return "ESTIMATED";
  if (raw === "ASSUMPTION_BASED" || raw === "ASSUMPTION") return "ASSUMPTION";
  return "UNKNOWN";
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  return Boolean(raw && raw !== "--" && raw !== "null" && raw !== "undefined");
}

function confidenceText(row: AnyRecord): string {
  const confidence = row.confidence;
  if (confidence && typeof confidence === "object") {
    const level = text(confidence.level ?? confidence.label, "");
    const basis = text(confidence.basis, "");
    const reasons = Array.isArray(confidence.reasons) ? confidence.reasons.map((item) => text(item)).filter(Boolean).join("、") : "";
    return [level, basis, reasons].filter(Boolean).join(" · ") || "可信度待确认";
  }
  return text(row.confidence_text ?? row.confidence_label ?? row.confidence_score, "可信度待确认");
}

function assumptionText(row: AnyRecord): string {
  const assumptions = row.assumptions ?? row.assumption ?? row.uncertainty_notes;
  if (!assumptions) return "无假设记录";
  if (typeof assumptions === "string") return text(assumptions, "无假设记录");
  if (Array.isArray(assumptions)) return assumptions.map((item) => text(item)).filter(Boolean).join("；") || "无假设记录";
  if (typeof assumptions === "object") {
    const entries = Object.entries(assumptions).map(([key, value]) => `${key}: ${text(value)}`).filter(Boolean);
    return entries.length ? entries.slice(0, 6).join("；") : "无假设记录";
  }
  return "无假设记录";
}

function evidenceRef(row: AnyRecord): string {
  const refs = row.evidence_refs ?? row.evidence_ref ?? row.evidence_text;
  if (Array.isArray(refs)) return refs.map((item) => text(typeof item === "object" ? item.evidence_id ?? item.id ?? item.ref : item)).filter(Boolean).join("、") || "无证据引用";
  return text(refs, "无证据引用");
}

function valueText(row: AnyRecord): string {
  const delta = text(row.delta_value ?? row.delta?.value, "");
  const actual = text(row.actual_value ?? row.actual?.value, "");
  const unit = text(row.unit ?? row.delta?.unit ?? row.actual?.unit, "");
  const value = delta || actual;
  return value ? `${value}${unit ? ` ${unit}` : ""}` : "数值待确认";
}

function normalizeItem(row: AnyRecord, index: number, source: OperatorRoiLedgerItem["source"], filters: { fieldId?: string; operationId?: string }): OperatorRoiLedgerItem {
  const valueKind = normalizeValueKind(row.value_kind ?? row.valueKind ?? row.kind);
  const baselinePresent = hasValue(row.baseline_value ?? row.baseline?.value);
  const actualPresent = hasValue(row.actual_value ?? row.actual?.value);
  return {
    roiId: text(row.roi_ledger_id ?? row.roi_id ?? row.id, `roi-${index}`),
    fieldId: text(row.field_id ?? row.fieldId, filters.fieldId ?? ""),
    operationId: text(row.operation_id ?? row.operationId ?? row.operation_plan_id, filters.operationId ?? ""),
    prescriptionId: text(row.prescription_id ?? row.prescriptionId, ""),
    evidenceRef: evidenceRef(row),
    calculationMethod: text(row.calculation_method ?? row.method, "calculation method 待确认"),
    confidenceText: confidenceText(row),
    assumptionText: assumptionText(row),
    createdAt: text(row.created_at ?? row.generated_at ?? row.updated_at, ""),
    valueKind,
    baselinePresent,
    actualPresent,
    metricText: text(row.metric_name ?? row.roi_type ?? row.value_type ?? row.title, "ROI 指标待确认"),
    valueText: valueText(row),
    source,
  };
}

function normalizeRows(payload: unknown, source: OperatorRoiLedgerItem["source"], filters: { fieldId?: string; operationId?: string }): OperatorRoiLedgerItem[] {
  const rows = arrayFrom(payload, ["items", "roi_items", "ledger", "roi_ledger", "data"]);
  return rows.map((row, index) => normalizeItem(row, index, source, filters));
}

function embeddedItemsFromOperationReport(report: any, filters: { fieldId?: string; operationId?: string }): OperatorRoiLedgerItem[] {
  const roi = report?.roi_ledger;
  if (!roi || typeof roi !== "object") return [];
  return normalizeRows(roi, "operation_report_embedded", filters);
}

async function fetchOptional(path: string): Promise<unknown | null> {
  try {
    const result = await apiRequestWithPolicy<unknown>(path, undefined, { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export async function fetchOperatorRoiLedger(args: { fieldId?: unknown; operationId?: unknown } = {}): Promise<OperatorRoiLedgerResponse> {
  const fieldId = text(args.fieldId, "");
  const operationId = text(args.operationId, "");
  const filters = { ...(fieldId ? { fieldId } : {}), ...(operationId ? { operationId } : {}) };
  const query: Record<string, string> = {};
  if (fieldId) query.field_id = fieldId;
  if (operationId) query.operation_id = operationId;

  if (ENABLE_OPERATOR_ROI_LEDGER_API) {
    const official = await fetchOptional(withQuery("/api/v1/operator/roi-ledger", query));
    const officialItems = normalizeRows(official, "operator_roi_ledger_api", filters);
    if (officialItems.length > 0) {
      return {
        source: "operator_roi_ledger_api",
        dataScope: "OFFICIAL_OPERATOR_API",
        generated_at: new Date().toISOString(),
        items: officialItems,
        filters,
      };
    }
  }

  if (ENABLE_CUSTOMER_ROI_LEDGER_FALLBACK) {
    const customer = await fetchOptional(withQuery("/api/v1/customer/roi-ledger", query));
    const customerItems = normalizeRows(customer, "customer_roi_ledger_api", filters);
    if (customerItems.length > 0) {
      return {
        source: "fallback_existing_sources",
        dataScope: "FALLBACK_LIMITED",
        generated_at: new Date().toISOString(),
        items: customerItems,
        filters,
        message: "当前展示 customer roi-ledger 包装后的有限运营 ROI 明细，非完整 operator roi-ledger。",
      };
    }
  }

  if (operationId) {
    try {
      const report = await fetchOperationReport(operationId);
      const embedded = embeddedItemsFromOperationReport(report, filters);
      if (embedded.length > 0) {
        return {
          source: "fallback_existing_sources",
          dataScope: "FALLBACK_LIMITED",
          generated_at: new Date().toISOString(),
          items: embedded,
          filters,
          message: "当前展示 operation report 内嵌 ROI 摘要，非完整 ROI 明细账。",
        };
      }
    } catch {
      // keep formal empty state below
    }
  }

  return {
    source: "fallback_existing_sources",
    dataScope: "EMPTY",
    generated_at: new Date().toISOString(),
    items: [],
    filters,
    message: ENABLE_OPERATOR_ROI_LEDGER_API || ENABLE_CUSTOMER_ROI_LEDGER_FALLBACK ? "暂无 ROI 明细。" : "ROI 明细接口未接入，当前不探测未 ready API。",
  };
}
