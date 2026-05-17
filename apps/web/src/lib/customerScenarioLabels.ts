export function scenarioTypeLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "FORMAL_IRRIGATION") return "正式灌溉";
  if (key === "DEVICE_ANOMALY") return "设备异常";
  if (key === "FORMAL_VARIABLE_OPERATION") return "变量作业";
  if (key === "FORMAL_SAMPLING") return "正式采样";
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
  if (normalized === "missing:roi" || normalized === "missing:field_memory") return "价值和田块记忆暂不对客展示";
  if (normalized === "missing:diagnosis" || normalized.includes("sensing summary") || normalized.includes("soil_moisture") || normalized.includes("threshold") || normalized.includes("deficit")) {
    return "正式诊断依据不足";
  }
  if (["missing:recommendation", "missing:prescription", "missing:approval", "missing:operation_plan"].includes(normalized)) {
    return "建议、处方与审批链路尚未闭合";
  }
  if (["missing:execution", "missing:receipt", "missing:evidence"].includes(normalized)) {
    return "正式执行回执与验收结果尚未成立";
  }
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
