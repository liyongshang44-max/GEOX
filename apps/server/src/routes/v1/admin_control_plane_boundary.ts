export const ADMIN_CONTROL_PLANE_SOURCE = "admin_control_plane_api" as const;
export const ADMIN_CONTROL_PLANE_DATA_SCOPE = "INTERNAL_ADMIN_CONTROL_PLANE" as const;
export const ADMIN_CONTROL_PLANE_SURFACE = "ADMIN" as const;

export type AdminControlPlaneKind = "dashboard" | "fields" | "operations" | "devices" | "alerts" | "evidence" | "skills" | "acceptance" | "healthz";

export function adminControlPlaneEnvelope(kind: AdminControlPlaneKind, payload: Record<string, unknown>, boundary_rules: string[] = []) {
  return {
    ok: true,
    source: ADMIN_CONTROL_PLANE_SOURCE,
    dataScope: ADMIN_CONTROL_PLANE_DATA_SCOPE,
    surface: ADMIN_CONTROL_PLANE_SURFACE,
    generated_at: new Date().toISOString(),
    writeReady: false,
    customerReportReady: false,
    operatorTwinReady: false,
    recommendationAuthoringReady: false,
    approvalReady: false,
    approvalBypassReady: false,
    taskCreationReady: false,
    dispatchReady: false,
    admin_control_plane_v1: { kind, payload, boundary_rules },
  };
}
