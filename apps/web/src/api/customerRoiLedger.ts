import { apiRequestWithPolicy, withQuery } from "./client";

export type CustomerRoiLedgerDataScope = "OFFICIAL_CUSTOMER_API" | "FALLBACK_EMBEDDED_REPORT" | "NO_ROI" | "ERROR_EMPTY";

export type CustomerRoiLedgerItem = {
  roi_id?: string | null;
  title?: string | null;
  value_type?: string | null;
  value_kind?: string | null;
  metric_name?: string | null;
  delta_value?: number | string | null;
  unit?: string | null;
  baseline_value?: number | string | null;
  actual_value?: number | string | null;
  calculation_method?: string | null;
  customer_text?: string | null;
  evidence_text?: string | null;
  confidence?: { score?: number | string | null; label?: string | null } | null;
  confidence_score?: number | string | null;
  generated_at?: string | null;
  updated_at?: string | null;
};

export type CustomerRoiLedgerResponse = {
  source: "customer_roi_ledger_api" | "embedded_report_fallback" | "no_roi" | "empty_error_state";
  dataScope: CustomerRoiLedgerDataScope;
  generated_at?: string | null;
  items: CustomerRoiLedgerItem[];
  message?: string;
};

type RoiLedgerApiEnvelope =
  | { ok?: boolean; items?: CustomerRoiLedgerItem[]; roi_items?: CustomerRoiLedgerItem[]; ledger?: CustomerRoiLedgerItem[]; generated_at?: string | null; data?: unknown }
  | CustomerRoiLedgerItem[];

function normalizeItems(payload: unknown): { items: CustomerRoiLedgerItem[]; generatedAt?: string | null } {
  if (Array.isArray(payload)) return { items: payload };
  if (!payload || typeof payload !== "object") return { items: [] };
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.items)) return { items: obj.items as CustomerRoiLedgerItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.roi_items)) return { items: obj.roi_items as CustomerRoiLedgerItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (Array.isArray(obj.ledger)) return { items: obj.ledger as CustomerRoiLedgerItem[], generatedAt: obj.generated_at as string | null | undefined };
  if (obj.data) return normalizeItems(obj.data);
  return { items: [] };
}

function cleanId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "暂无记录" || text === "待生成") return "";
  return text;
}

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function summaryItemFromValueSummary(obj: Record<string, unknown>): CustomerRoiLedgerItem | null {
  const total = toNum(obj.total_roi_items);
  const customerText = String(obj.customer_value_text ?? "").trim();
  if (total <= 0 && !customerText) return null;
  const lowConfidence = toNum(obj.low_confidence_items);
  const assumptions = toNum(obj.assumption_based_items);
  return {
    title: "价值记录摘要",
    value_type: assumptions > 0 ? "assumption_summary" : "estimate_summary",
    metric_name: "ROI 摘要",
    delta_value: total > 0 ? total : null,
    unit: total > 0 ? "条" : null,
    baseline_value: null,
    customer_text: customerText || `当前报告包含 ${total} 条价值记录摘要。`,
    evidence_text: `节水 ${toNum(obj.water_saved_items)} 条、节人工 ${toNum(obj.labor_saved_items)} 条、预警 ${toNum(obj.early_warning_items)} 条。`,
    confidence: { label: lowConfidence > 0 ? `低置信记录 ${lowConfidence} 条` : "可信度待补充" },
    generated_at: String(obj.generated_at ?? obj.updated_at ?? "") || null,
  };
}

function collectEmbeddedRoiItems(embeddedRoi: unknown): CustomerRoiLedgerItem[] {
  if (!embeddedRoi || typeof embeddedRoi !== "object") return [];
  const obj = embeddedRoi as Record<string, unknown>;
  const buckets = [
    obj.items,
    obj.water_saved,
    obj.labor_saved,
    obj.early_warning_lead_time,
    obj.first_pass_acceptance_rate,
    obj.roi_items,
    obj.ledger,
  ];
  const rows = buckets.flatMap((bucket) => Array.isArray(bucket) ? bucket : []).filter((item): item is CustomerRoiLedgerItem => Boolean(item && typeof item === "object"));
  const summaryItem = summaryItemFromValueSummary(obj);
  return rows.length ? rows : (summaryItem ? [summaryItem] : []);
}

export async function fetchCustomerRoiLedger(args: { fieldId?: unknown; operationId?: unknown; embeddedRoi?: unknown }): Promise<CustomerRoiLedgerResponse> {
  const fieldId = cleanId(args.fieldId);
  const operationId = cleanId(args.operationId);
  const query: Record<string, string> = {};
  if (fieldId) query.field_id = fieldId;
  if (operationId) query.operation_id = operationId;

  try {
    if (fieldId || operationId) {
      const direct = await apiRequestWithPolicy<RoiLedgerApiEnvelope>(
        withQuery("/api/v1/customer/roi-ledger", query),
        undefined,
        { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 }
      );
      if (direct.ok) {
        const normalized = normalizeItems(direct.data);
        return {
          source: "customer_roi_ledger_api",
          dataScope: normalized.items.length ? "OFFICIAL_CUSTOMER_API" : "NO_ROI",
          generated_at: normalized.generatedAt ?? new Date().toISOString(),
          items: normalized.items,
          message: normalized.items.length ? undefined : "暂无可量化价值记录。",
        };
      }
    }

    const embeddedItems = collectEmbeddedRoiItems(args.embeddedRoi);
    if (embeddedItems.length) {
      return {
        source: "embedded_report_fallback",
        dataScope: "FALLBACK_EMBEDDED_REPORT",
        generated_at: new Date().toISOString(),
        items: embeddedItems,
        message: "当前展示报告内嵌价值摘要，非完整 ROI 账本。",
      };
    }

    return {
      source: "no_roi",
      dataScope: "NO_ROI",
      generated_at: new Date().toISOString(),
      items: [],
      message: "暂无可量化价值记录。",
    };
  } catch {
    return {
      source: "empty_error_state",
      dataScope: "ERROR_EMPTY",
      generated_at: new Date().toISOString(),
      items: [],
      message: "价值记录暂不可用，请稍后刷新。",
    };
  }
}
