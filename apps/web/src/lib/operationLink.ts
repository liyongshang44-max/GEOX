export function resolveOperationPlanId(raw: any): string {
  const direct =
    raw?.operation_plan_id
    ?? raw?.operationPlanId
    ?? raw?.operation_id
    ?? raw?.operationId
    ?? raw?.plan_id
    ?? raw?.planId
    ?? raw?.meta?.operation_plan_id
    ?? raw?.summary?.operation_plan_id
    ?? raw?.summary?.operation_id
    ?? raw?.receipt?.operation_plan_id
    ?? raw?.receipt?.operation_id
    ?? "";
  return String(direct ?? "").trim();
}

export function toOperationDetailPath(raw: any, fallback = "/operations"): string {
  const operationPlanId = resolveOperationPlanId(raw);
  return operationPlanId ? `/operations/${encodeURIComponent(operationPlanId)}` : fallback;
}
