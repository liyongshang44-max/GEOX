// apps/web/src/lib/irrigationDecisionLabels.ts
// Purpose: map H17 irrigation decision report enums to customer-facing Chinese labels.
// Boundary: labels only; no decision calculation.

export function irrigationDecisionStateLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "NORMAL") return "正常";
  if (key === "LIGHT_DEFICIT") return "轻度缺水";
  if (key === "MODERATE_DEFICIT") return "中度缺水";
  return "待确认";
}

export function irrigationDecisionRiskDeltaLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "IMPROVED") return "风险降低";
  if (key === "UNCHANGED") return "风险未明显变化";
  if (key === "WORSENED") return "风险升高";
  return "待确认";
}

export function irrigationDecisionOptionLabel(value: unknown): string {
  const key = String(value ?? "").trim();
  if (key === "no_action") return "不处理";
  if (key === "irrigate_10mm") return "灌溉 10mm";
  if (key === "irrigate_20mm") return "灌溉 20mm";
  if (key === "irrigate_22mm") return "灌溉 22mm";
  if (key === "delay_3d") return "延迟 3 天";
  return "情景待确认";
}

export function irrigationDecisionConfidenceLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "HIGH") return "较高";
  if (key === "MEDIUM") return "中等";
  if (key === "LOW") return "较低";
  return "待确认";
}
