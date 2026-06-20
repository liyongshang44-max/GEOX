import { apiRequestWithPolicy, withQuery } from "./client";
import type { CustomerScopeV1 } from "./session";

export type CustomerConfirmedTwinSummaryV1 = {
  version: "v1";
  field_id: string;
  summary_status: "AVAILABLE" | "NOT_AVAILABLE" | string;
  reason?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  state_summary: { water_state?: string | null; crop_stage?: string | null; confidence?: string | null; status_text?: string | null } | null;
  risk_summary: { primary_risk?: string | null; risk_level?: string | null; time_window?: string | null; confidence?: string | null } | null;
  recommendation_summary: { recommendation_id?: string | null; recommendation_type?: string | null; action_summary?: string | null; amount_mm?: number | null; human_approval_required?: boolean | null; approval_status?: string | null; operation_plan_status?: string | null; task_status?: string | null } | null;
  evidence_summary: { evidence_refs: unknown[]; evidence_count: number; quality_status?: string | null; missing_reasons?: string[] };
  boundary_rules: string[];
};

export type CustomerConfirmedTwinSummaryResponse = {
  ok: true;
  source: "customer_confirmed_twin_summary_api";
  dataScope: "OFFICIAL_CUSTOMER_DELIVERY_PORTAL";
  surface: "CUSTOMER";
  generated_at: string;
  writeReady: false;
  operatorTwinReady: false;
  adminControlPlaneReady: false;
  forecastRunReady: false;
  scenarioEditReady: false;
  recommendationSubmitReady: false;
  approvalReady: false;
  taskCreationReady: false;
  dispatchReady: false;
  customer_confirmed_twin_summary_v1: CustomerConfirmedTwinSummaryV1;
};

export async function fetchCustomerConfirmedTwinSummary(fieldId: string, scope?: Partial<CustomerScopeV1> | Record<string, unknown>): Promise<CustomerConfirmedTwinSummaryResponse | null> {
  const id = String(fieldId ?? "").trim();
  if (!id) return null;
  const result = await apiRequestWithPolicy<CustomerConfirmedTwinSummaryResponse>(
    withQuery(`/api/v1/customer/fields/${encodeURIComponent(id)}/confirmed-twin-summary`, scope as Record<string, unknown> | undefined),
    undefined,
    { allowedStatuses: [403, 404, 405, 422], silent: true, timeoutMs: 10000 }
  );
  return result.ok ? result.data : null;
}
