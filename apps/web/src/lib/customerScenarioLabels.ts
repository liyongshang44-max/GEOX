export function scenarioTypeLabel(value: unknown): string {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "FORMAL_IRRIGATION") return "正式灌溉";
  if (key === "DEVICE_ANOMALY") return "设备异常";
  if (key === "FORMAL_VARIABLE_OPERATION") return "变量作业";
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
