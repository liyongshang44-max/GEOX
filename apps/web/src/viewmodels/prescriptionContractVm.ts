import type { CustomerPrescriptionContract, CustomerPrescriptionResponse, CustomerPrescriptionDataScope } from "../api/customerPrescriptions";
import { labelRiskLevel, labelOperationType, sanitizeCustomerText } from "../lib/customerLabels";

export type PrescriptionContractVm = {
  dataScope: CustomerPrescriptionDataScope;
  title: string;
  statusText: string;
  generatedAtText: string;
  isAvailable: boolean;
  message?: string;
  rows: Array<{ label: string; value: string }>;
};

function toDateTimeText(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "暂无更新时间";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= 0) return "暂无更新时间";
  const date = new Date(ms);
  if (date.getUTCFullYear() <= 1970) return "暂无更新时间";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function text(value: unknown, fallback = "未填写"): string {
  if (Array.isArray(value)) {
    const joined = value.map((item) => sanitizeCustomerText(item, "")).filter(Boolean).join("、");
    return joined || fallback;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferred = obj.summary ?? obj.text ?? obj.name ?? obj.label ?? obj.value;
    if (preferred != null) return sanitizeCustomerText(preferred, fallback);
    const values = Object.values(obj).filter((item) => typeof item !== "object").map((item) => sanitizeCustomerText(item, "")).filter(Boolean);
    return values.join("、") || fallback;
  }
  return sanitizeCustomerText(value, fallback);
}

function yesNo(value: unknown): string {
  if (typeof value === "boolean") return value ? "需要审批" : "无需额外审批";
  const raw = String(value ?? "").trim();
  if (!raw) return "审批要求待确认";
  return sanitizeCustomerText(raw, "审批要求待确认");
}

function risk(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "风险待确认";
  return labelRiskLevel(raw);
}

function operationType(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "作业类型待确认";
  return labelOperationType(raw);
}

function buildRows(prescription: CustomerPrescriptionContract): Array<{ label: string; value: string }> {
  return [
    { label: "作业对象", value: text(prescription.operation_target ?? prescription.target) },
    { label: "地块范围", value: text(prescription.field_scope ?? prescription.spatial_scope ?? prescription.location) },
    { label: "推荐时间窗口", value: text(prescription.recommended_time_window ?? prescription.timing_window ?? prescription.timing) },
    { label: "禁止时间窗口", value: text(prescription.forbidden_time_window ?? prescription.avoid_window, "无明确禁止时间窗口") },
    { label: "作业类型", value: operationType(prescription.operation_type ?? prescription.action) },
    { label: "作业量", value: text(prescription.operation_amount ?? prescription.amount) },
    { label: "设备要求", value: text(prescription.device_requirements ?? prescription.equipment_requirements) },
    { label: "风险等级", value: risk(prescription.risk_level ?? prescription.risk) },
    { label: "审批要求", value: yesNo(prescription.approval_required ?? prescription.approval_requirements) },
    { label: "验收条件", value: text(prescription.acceptance_conditions) },
    { label: "依据摘要", value: text(prescription.basis_summary ?? prescription.evidence_summary) },
  ];
}

export function buildPrescriptionContractVm(response: CustomerPrescriptionResponse): PrescriptionContractVm {
  if (!response.prescription || response.dataScope !== "OFFICIAL_PRESCRIPTION_API") {
    return {
      dataScope: response.dataScope,
      title: "处方详情",
      statusText: response.dataScope === "ERROR_EMPTY" ? "暂不可用" : "未形成正式处方",
      generatedAtText: toDateTimeText(response.generated_at),
      isAvailable: false,
      message: response.message || "未形成正式处方。",
      rows: [],
    };
  }

  return {
    dataScope: response.dataScope,
    title: "处方详情",
    statusText: "正式处方",
    generatedAtText: toDateTimeText(response.generated_at ?? response.prescription.generated_at ?? response.prescription.updated_at),
    isAvailable: true,
    rows: buildRows(response.prescription),
  };
}
