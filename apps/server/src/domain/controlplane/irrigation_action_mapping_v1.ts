export const IRRIGATION_RECOMMENDATION_ACTION = "irrigation.start";
export const IRRIGATION_CONTROL_PLANE_ACTION = "IRRIGATE";

function normalizeActionType(actionType: string): string {
  return String(actionType ?? "").trim().toLowerCase();
}

export function mapRecommendationActionToControlPlane(actionType: string): string | null {
  const normalized = normalizeActionType(actionType);
  if (normalized === IRRIGATION_RECOMMENDATION_ACTION) {
    return IRRIGATION_CONTROL_PLANE_ACTION;
  }
  return null;
}

export function toCustomerFacingActionLabel(actionType: string): string {
  const normalized = normalizeActionType(actionType);
  if (normalized === IRRIGATION_RECOMMENDATION_ACTION) return "灌溉";
  if (String(actionType ?? "").trim().toUpperCase() === IRRIGATION_CONTROL_PLANE_ACTION) return "灌溉";
  return "执行";
}
