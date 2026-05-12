export type RoiConfidenceLevelV1 = "LOW" | "MEDIUM" | "HIGH";
export type ValueHypothesisTypeV1 = "YIELD_LOSS_AVOIDED" | "YIELD_LIFT_EXPECTED" | "REVENUE_LOSS_AVOIDED" | "REVENUE_LIFT_EXPECTED";
export type RoiStatusV1 = "HYPOTHESIS_ONLY" | "PROJECTED" | "EXECUTED_PENDING_RESPONSE" | "INTERIM_SUPPORTED" | "INTERIM_NOT_SUPPORTED" | "BASELINE_MISSING" | "EVIDENCE_INSUFFICIENT" | "EXCLUDED_WEATHER" | "REALIZED";

export type RecommendationValueHypothesisV1 = {
  value_type: ValueHypothesisTypeV1;
  expected_yield_effect: { min?: number; max?: number; unit: "%" | "kg/ha" | "t/ha" } | null;
  expected_revenue_effect: { min?: number; max?: number; currency?: string } | null;
  baseline_source: "HISTORICAL_AVERAGE" | "SEASON_PLAN" | "DEFAULT_ASSUMPTION" | "CUSTOMER_PROVIDED";
  evidence_refs: string[];
  confidence: RoiConfidenceLevelV1;
  assumptions: Record<string, unknown>;
  uncertainty_notes: string | null;
};

export type PrescriptionValueProjectionV1 = {
  planned_cost: number | null;
  expected_benefit: number | null;
  expected_net_value: number | null;
  expected_roi_ratio: number | null;
  cost_items: Array<{ type: string; amount: number | null; unit: string | null; money_value: number | null }>;
  projection_basis: string;
  confidence: RoiConfidenceLevelV1;
  assumptions: Record<string, unknown>;
  uncertainty_notes: string | null;
};

export type OperationValueChainRoiV1 = {
  status: RoiStatusV1;
  hypothesis: RecommendationValueHypothesisV1 | null;
  projection: PrescriptionValueProjectionV1 | null;
  interim_evidence: Record<string, unknown> | null;
  ledger_items: unknown[];
  exclusion_reason: string | null;
  customer_safe_text: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function arrayText(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function confidenceFrom(value: unknown): RoiConfidenceLevelV1 {
  const raw = text(value).toUpperCase();
  if (raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  const n = Number(value);
  if (Number.isFinite(n)) return n >= 0.75 ? "HIGH" : n >= 0.45 ? "MEDIUM" : "LOW";
  return "LOW";
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plannedCostFrom(prescription: any): { planned_cost: number | null; cost_items: PrescriptionValueProjectionV1["cost_items"] } {
  const amount = num(prescription?.amount ?? prescription?.operation_amount?.amount ?? prescription?.planned_amount);
  const unit = text(prescription?.unit ?? prescription?.operation_amount?.unit);
  const money = num(prescription?.planned_cost ?? prescription?.cost?.estimated_total ?? prescription?.estimated_total);
  if (money != null) return { planned_cost: money, cost_items: [{ type: "planned_operation_cost", amount, unit: unit || null, money_value: money }] };
  const assumed = amount != null ? Number((amount * 0.12).toFixed(2)) : null;
  return { planned_cost: assumed, cost_items: [{ type: "default_assumption", amount, unit: unit || null, money_value: assumed }] };
}

export function buildRecommendationValueHypothesisV1(recommendation: any): RecommendationValueHypothesisV1 | null {
  if (!recommendation || typeof recommendation !== "object") return null;
  if (recommendation.value_hypothesis && typeof recommendation.value_hypothesis === "object") return recommendation.value_hypothesis;
  const action = text(recommendation?.suggested_action?.action_type ?? recommendation?.operation_type ?? recommendation?.action_type).toUpperCase();
  const riskReasons = arrayText(recommendation?.reason_codes ?? recommendation?.risk?.reasons);
  const confidence = confidenceFrom(recommendation?.confidence ?? recommendation?.skill_trace?.confidence?.level);
  const evidence_refs = arrayText(recommendation?.evidence_refs ?? recommendation?.skill_trace?.evidence_refs);
  const isIrrigation = action.includes("IRRIG") || text(recommendation?.rule_id).includes("irrigation");
  return {
    value_type: isIrrigation ? "YIELD_LOSS_AVOIDED" : "YIELD_LIFT_EXPECTED",
    expected_yield_effect: isIrrigation ? { min: 1, max: 4, unit: "%" } : { min: 0.5, max: 2, unit: "%" },
    expected_revenue_effect: null,
    baseline_source: "DEFAULT_ASSUMPTION",
    evidence_refs,
    confidence,
    assumptions: {
      basis: "recommendation_stage_value_hypothesis_v1",
      reason_codes: riskReasons,
      action_type: action || null,
      note: "pre-harvest value hypothesis only; not realized ROI",
    },
    uncertainty_notes: "缺少历史产量/价格基线时，该字段仅表示建议阶段价值假设，不形成可信收益结论。",
  };
}

export function enrichRecommendationValueHypothesisV1<T = any>(recommendation: T): T {
  if (!recommendation || typeof recommendation !== "object") return recommendation;
  const obj = recommendation as any;
  return { ...obj, value_hypothesis: buildRecommendationValueHypothesisV1(obj) };
}

export function buildPrescriptionValueProjectionV1(prescription: any, hypothesis?: RecommendationValueHypothesisV1 | null): PrescriptionValueProjectionV1 | null {
  if (!prescription || typeof prescription !== "object") return null;
  if (prescription.value_projection && typeof prescription.value_projection === "object") return prescription.value_projection;
  const { planned_cost, cost_items } = plannedCostFrom(prescription);
  const revenueMin = num(hypothesis?.expected_revenue_effect?.min);
  const revenueMax = num(hypothesis?.expected_revenue_effect?.max);
  const expected_benefit = revenueMin != null && revenueMax != null ? Number(((revenueMin + revenueMax) / 2).toFixed(2)) : null;
  const expected_net_value = expected_benefit != null && planned_cost != null ? Number((expected_benefit - planned_cost).toFixed(2)) : null;
  const expected_roi_ratio = expected_net_value != null && planned_cost != null && planned_cost > 0 ? Number((expected_net_value / planned_cost).toFixed(4)) : null;
  return {
    planned_cost,
    expected_benefit,
    expected_net_value,
    expected_roi_ratio,
    cost_items,
    projection_basis: expected_benefit == null ? "cost_projection_only_baseline_missing" : "hypothesis_benefit_minus_planned_cost_v1",
    confidence: hypothesis?.confidence ?? "LOW",
    assumptions: {
      baseline_source: hypothesis?.baseline_source ?? "DEFAULT_ASSUMPTION",
      prescription_id: prescription?.prescription_id ?? null,
      recommendation_id: prescription?.recommendation_id ?? null,
    },
    uncertainty_notes: expected_benefit == null ? "缺少历史产量/价格基线，当前仅展示价值假设和计划成本，不形成可信收益结论。" : null,
  };
}

function ledgerItemsFrom(report: any): unknown[] {
  const roi = report?.roi_ledger;
  if (!roi || typeof roi !== "object") return [];
  if (Array.isArray(roi.items)) return roi.items;
  return [
    ...(Array.isArray(roi.water_saved) ? roi.water_saved : []),
    ...(Array.isArray(roi.labor_saved) ? roi.labor_saved : []),
    ...(Array.isArray(roi.early_warning_lead_time) ? roi.early_warning_lead_time : []),
    ...(Array.isArray(roi.first_pass_acceptance_rate) ? roi.first_pass_acceptance_rate : []),
  ];
}

function detectWeatherExclusion(report: any): string | null {
  const candidates = [
    report?.learning_excluded_reason,
    report?.weather_learning_excluded_reason,
    report?.weather?.learning_excluded_reason,
    report?.environment?.learning_excluded_reason,
    report?.roi?.exclusion_reason,
    report?.acceptance?.failure_reason,
  ].map(text).filter(Boolean);
  const hit = candidates.find((item) => /weather|rainfall|interference|rain/i.test(item));
  return hit ?? null;
}

export function buildOperationValueChainRoiV1(report: any): OperationValueChainRoiV1 {
  const hypothesis = buildRecommendationValueHypothesisV1(report?.recommendation);
  const projection = buildPrescriptionValueProjectionV1(report?.prescription, hypothesis);
  const ledger_items = ledgerItemsFrom(report);
  const exclusion_reason = detectWeatherExclusion(report);
  const evidenceComplete = String(report?.evidence?.evidence_status ?? "").toUpperCase() === "COMPLETE" || report?.evidence?.receipt_present === true;
  const accepted = String(report?.acceptance?.verdict ?? report?.acceptance?.status ?? "").toUpperCase() === "PASS";
  const hasBaseline = hypothesis?.baseline_source && hypothesis.baseline_source !== "DEFAULT_ASSUMPTION";
  let status: RoiStatusV1 = "HYPOTHESIS_ONLY";
  if (exclusion_reason) status = "EXCLUDED_WEATHER";
  else if (!hasBaseline && !ledger_items.length) status = projection ? "BASELINE_MISSING" : "HYPOTHESIS_ONLY";
  else if (projection && !evidenceComplete) status = "PROJECTED";
  else if (projection && evidenceComplete && !accepted) status = "EXECUTED_PENDING_RESPONSE";
  else if (accepted && ledger_items.length) status = "INTERIM_SUPPORTED";
  else if (accepted && !ledger_items.length) status = "EVIDENCE_INSUFFICIENT";
  const interim_evidence = evidenceComplete ? {
    evidence_status: report?.evidence?.evidence_status ?? "COMPLETE",
    acceptance_verdict: report?.acceptance?.verdict ?? report?.acceptance?.status ?? null,
    ledger_count: ledger_items.length,
  } : null;
  const customer_safe_text = status === "EXCLUDED_WEATHER"
    ? "本次因天气干扰，不进入可信收益学习；仅记录执行成本和作业可靠性。"
    : status === "BASELINE_MISSING"
      ? "缺少历史产量/价格基线，当前仅展示价值假设，不形成可信收益结论。"
      : status === "INTERIM_SUPPORTED"
        ? "执行后证据已支持阶段性价值判断，最终收益仍需收获期验证。"
        : status === "EVIDENCE_INSUFFICIENT"
          ? "执行后证据不足，暂不形成可信收益结论。"
          : "当前展示建议阶段价值假设与处方阶段投入产出预测，最终收益待后续证据验证。";
  return { status, hypothesis, projection, interim_evidence, ledger_items, exclusion_reason, customer_safe_text };
}

export function enrichOperationReportValueChainRoiV1<T = any>(report: T): T {
  if (!report || typeof report !== "object") return report;
  const obj = report as any;
  const hypothesis = buildRecommendationValueHypothesisV1(obj.recommendation);
  const recommendation = obj.recommendation ? { ...obj.recommendation, value_hypothesis: hypothesis } : obj.recommendation;
  const projection = buildPrescriptionValueProjectionV1(obj.prescription, hypothesis);
  const prescription = obj.prescription ? { ...obj.prescription, value_projection: projection } : obj.prescription;
  const base = { ...obj, recommendation, prescription };
  return { ...base, roi: buildOperationValueChainRoiV1(base) };
}

export function enrichPayloadRecommendationsValueHypothesisV1(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map((item) => enrichPayloadRecommendationsValueHypothesisV1(item));
  const out: any = { ...payload };
  if (Array.isArray(out.recommendations)) out.recommendations = out.recommendations.map((item: any) => enrichRecommendationValueHypothesisV1(item));
  if (out.recommendation && typeof out.recommendation === "object") out.recommendation = enrichRecommendationValueHypothesisV1(out.recommendation);
  if (out.data && typeof out.data === "object") out.data = enrichPayloadRecommendationsValueHypothesisV1(out.data);
  return out;
}
