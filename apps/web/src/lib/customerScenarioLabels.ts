export function scenarioTypeLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "FORMAL_IRRIGATION") return "正式灌溉";
  if (key === "DEVICE_ANOMALY") return "设备异常";
  if (key === "FORMAL_VARIABLE_OPERATION") return "变量作业";
  if (key === "FORMAL_SAMPLING") return "正式采样";
  if (key === "FORMAL_FERTILIZATION") return "正式施氮";
  if (key === "FORMAL_PEST_DISEASE_INSPECTION") return "病虫害巡检";
  return "正式场景待确认";
}

export function failSafeStatusLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "OPEN") return "Fail-safe 已触发";
  if (key === "ACKED") return "Fail-safe 已确认";
  if (key === "COMPLETED") return "Fail-safe 处置完成";
  if (key === "RESOLVED") return "Fail-safe 已解除";
  return "Fail-safe 未触发";
}

export function manualTakeoverStatusLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "REQUESTED") return "人工接管已请求";
  if (key === "ACKED") return "人工接管已确认";
  if (key === "COMPLETED") return "人工接管已完成";
  return "人工接管未触发";
}

const CUSTOMER_REASON_MAP: Record<string, string> = {
  "missing:diagnosis": "缺少正式诊断依据",
  "missing:recommendation": "缺少正式建议依据",
  "missing:prescription": "缺少正式处方记录",
  "missing:approval": "审批尚未完成",
  "missing:operation_plan": "作业计划尚未正式成立",
  "missing:execution": "执行任务尚未正式成立",
  "missing:receipt": "缺少正式执行回执",
  "missing:evidence": "缺少正式证据",
  "missing:acceptance": "验收尚未正式成立",
  "missing:roi": "价值结论暂不展示",
  "missing:field_memory": "田块记忆暂不展示",
  "stage-1 sensing summary": "缺少正式传感器触发摘要",
  "soil_moisture/threshold/deficit": "缺少土壤水分诊断依据",
  "simulated_dev_only": "模拟记录，不作为客户结论",
  "insufficient": "证据不足",
  "limited": "有限记录，需复核",
  "sampling_lab_invalid": "采样已完成，但实验室结果未通过质量校验 → 需复核",
  "sampling_simulated": "采样记录来自模拟链路 → 不作为客户结论",
  "sampling_missing_receipt": "实验室结果已导入，但缺少采样回执 → 证据不足",
  "sampling_passed": "采样与实验室结果均通过 → 可作为农艺判断依据",
  "fertilization_lab_low_n_formal": "实验室结果显示存在缺氮风险，已生成施氮建议。",
  "fertilization_sensing_review_only": "感知系统提示可能存在养分风险，建议先采样复核。",
  "fertilization_salinity_risk": "土壤电导率异常，可能存在盐分或水分干扰，暂不生成施氮建议。",
  "fertilization_warning_only": "当前仅为感知预警，不作为正式施肥结论。",
  "fertilization_prescription_approved": "施氮处方已批准，等待执行。",
  "fertilization_zone_deviation_large": "施氮作业部分分区偏差过大，需复核。",
  "missing:fertilization_assessment": "缺少施氮诊断记录",
  "missing:fertilization_recommendation": "缺少施氮建议记录",
  "missing:fertilization_prescription": "缺少施氮处方记录",
  "missing:fertilization_acceptance": "缺少施氮验收记录",
  "fertilization_not_customer_visible": "施氮结论暂不对客展示",
  "fertilization_acceptance_not_pass": "施氮验收未通过或需复核",
  "pest_disease_suspected_review_required": "发现疑似病虫害风险，已进入人工复核。",
  "pest_disease_inspection_confirmed_no_spray": "巡检结果已确认，但尚未进入补喷处方。",
  "pest_disease_missing_geo": "巡检缺少定位证据，需复核。",
  "pest_disease_missing_media": "巡检缺少图片证据，需复核。",
  "pest_disease_skill_signal_only": "当前仅为识别信号，不作为正式巡检结论。",
  "pest_disease_review_pending": "人工复核尚未完成。",
  "pest_disease_review_rejected": "人工复核未通过，暂不展示为正式结论。",
  "pest_disease_acceptance_pass_not_treatment": "巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。",
};

function normReason(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function customerReasonText(raw: unknown): string {
  const normalized = normReason(raw);
  if (!normalized) return "待补充";
  return CUSTOMER_REASON_MAP[normalized] ?? "需要补充正式链路后展示";
}

export function customerEvidenceGapText(raw: unknown): string {
  const mapped = customerReasonText(raw);
  if (mapped === "证据不足") return "证据不足：缺少正式传感器触发摘要";
  return mapped;
}

export function customerEvidenceGapCategory(raw: unknown): string {
  const normalized = normReason(raw);
  if (!normalized) return "需要补充正式链路后展示";
  if (normalized.startsWith("pest_disease") || normalized.includes("病虫害") || normalized.includes("巡检")) return "病虫害巡检证据需复核";
  if (normalized.startsWith("fertilization") || normalized.includes("施氮")) return "施氮诊断、处方与验收链路需复核";
  if (normalized === "missing:roi" || normalized === "missing:field_memory") return "价值和田块记忆暂不对客展示";
  if (normalized === "missing:diagnosis" || normalized.includes("sensing summary") || normalized.includes("soil_moisture") || normalized.includes("threshold") || normalized.includes("deficit")) return "正式诊断依据不足";
  if (["missing:recommendation", "missing:prescription", "missing:approval", "missing:operation_plan"].includes(normalized)) return "建议、处方与审批链路尚未闭合";
  if (["missing:execution", "missing:receipt", "missing:evidence"].includes(normalized)) return "正式执行回执与验收结果尚未成立";
  if (normalized === "missing:acceptance") return "正式验收未成立";
  return "需要补充正式链路后展示";
}

export function customerTrustLevelText(raw: unknown): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (key === "FORMAL") return "正式证据";
  if (key === "SIMULATED" || key === "SIMULATED_DEV_ONLY") return "执行未成立：当前记录来自模拟链路";
  if (key === "TECHNICAL_ONLY") return "验收未成立：回执成功不能作为验收结论";
  if (key === "LIMITED") return "有限记录，需复核";
  return "证据不足：缺少正式传感器触发摘要";
}

export function fertilizationCustomerSummaryText(input: any): string {
  const trigger = String(input?.trigger_source ?? "").toUpperCase();
  const evidence = String(input?.evidence_tier ?? "").toUpperCase();
  const acceptance = String(input?.acceptance_status ?? "").toUpperCase();
  const blocking = Array.isArray(input?.blocking_reasons) ? input.blocking_reasons.map((x: unknown) => normReason(x)) : [];
  if (blocking.includes("fertilization_salinity_risk")) return "土壤电导率异常，可能存在盐分或水分干扰，暂不生成施氮建议。";
  if (blocking.includes("fertilization_zone_deviation_large")) return "施氮作业部分分区偏差过大，需复核。";
  if (trigger === "SAMPLING_LAB" && evidence === "FORMAL") return "实验室结果显示存在缺氮风险，已生成施氮建议。";
  if (trigger === "SENSING_RISK") return "感知系统提示可能存在养分风险，建议先采样复核。";
  if (evidence === "WARNING") return "当前仅为感知预警，不作为正式施肥结论。";
  if (acceptance === "MISSING") return "施氮处方已批准，等待执行。";
  if (acceptance === "FAIL" || acceptance === "NEEDS_REVIEW") return "施氮作业部分分区偏差过大，需复核。";
  return "施氮链路已记录，等待正式复核。";
}

export function pestDiseaseInspectionCustomerSummaryText(input: any): string {
  const status = String(input?.assessment_status ?? "").toUpperCase();
  const acceptance = String(input?.acceptance_status ?? "").toUpperCase();
  const review = String(input?.review_status ?? "").toUpperCase();
  const blocking = Array.isArray(input?.blocking_reasons) ? input.blocking_reasons.map((x: unknown) => normReason(x)) : [];
  if (blocking.includes("pest_disease_missing_geo") || blocking.includes("pest_disease_missing_media")) return "巡检任务已完成，但缺少定位或图片证据，需复核。";
  if (blocking.includes("pest_disease_skill_signal_only")) return "当前仅为识别信号，不作为正式巡检结论。";
  if (review === "PENDING") return "发现疑似病虫害风险，已进入人工复核。";
  if (review === "REJECTED") return "人工复核未通过，暂不展示为正式结论。";
  if (acceptance === "PASS") return "巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。";
  if (status === "CONFIRMED") return "巡检结果已确认，但尚未进入补喷处方。";
  if (status === "SUSPECTED") return "发现疑似病虫害风险，已进入人工复核。";
  return "巡检证据不足，暂不生成处理建议。";
}

export function pestDiseaseInspectionTargetLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "PEST") return "虫害";
  if (key === "DISEASE") return "病害";
  if (key === "WEED") return "杂草";
  if (key === "UNKNOWN_STRESS") return "未知胁迫";
  return "待确认";
}

export function pestDiseaseAssessmentStatusLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "CONFIRMED") return "已确认";
  if (key === "SUSPECTED") return "疑似风险";
  if (key === "RULED_OUT") return "已排除";
  if (key === "NEEDS_REVIEW") return "需复核";
  if (key === "INSUFFICIENT_EVIDENCE") return "证据不足";
  return "待确认";
}

export function pestDiseaseSeverityLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "HIGH") return "高";
  if (key === "MEDIUM") return "中";
  if (key === "LOW") return "低";
  return "待补充";
}

export function pestDiseaseEvidenceTierLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "FORMAL") return "正式证据";
  if (key === "TECHNICAL") return "技术信号";
  if (key === "WARNING") return "预警";
  if (key === "MANUAL_REVIEW") return "人工复核";
  return "待确认";
}
