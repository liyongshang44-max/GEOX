import { apiRequestWithPolicy, withQuery } from "./client";

export type CustomerPrescriptionDataScope = "OFFICIAL_PRESCRIPTION_API" | "NO_FORMAL_PRESCRIPTION" | "ERROR_EMPTY";

export type CustomerPrescriptionContract = {
  prescription_id?: string | null;
  recommendation_id?: string | null;
  operation_target?: unknown;
  target?: unknown;
  field_scope?: unknown;
  spatial_scope?: unknown;
  location?: unknown;
  recommended_time_window?: unknown;
  timing_window?: unknown;
  timing?: unknown;
  forbidden_time_window?: unknown;
  avoid_window?: unknown;
  operation_type?: unknown;
  action?: unknown;
  operation_amount?: unknown;
  amount?: unknown;
  device_requirements?: unknown;
  equipment_requirements?: unknown;
  risk_level?: unknown;
  risk?: unknown;
  approval_required?: unknown;
  approval_requirements?: unknown;
  acceptance_conditions?: unknown;
  basis_summary?: unknown;
  evidence_summary?: unknown;
  status?: unknown;
  generated_at?: string | null;
  updated_at?: string | null;
};

export type CustomerPrescriptionResponse = {
  source: "prescription_by_id" | "prescription_by_recommendation" | "no_formal_prescription" | "empty_error_state";
  dataScope: CustomerPrescriptionDataScope;
  generated_at?: string | null;
  prescription: CustomerPrescriptionContract | null;
  message?: string;
};

type PrescriptionApiEnvelope =
  | CustomerPrescriptionContract
  | { ok?: boolean; prescription?: CustomerPrescriptionContract | null; data?: unknown; generated_at?: string | null };

function normalizePrescriptionPayload(payload: unknown): CustomerPrescriptionContract | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (obj.prescription && typeof obj.prescription === "object") return obj.prescription as CustomerPrescriptionContract;
  if (obj.data) return normalizePrescriptionPayload(obj.data);
  return obj as CustomerPrescriptionContract;
}

function cleanId(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "暂无记录") return "";
  return text;
}

async function fetchByPath(path: string): Promise<CustomerPrescriptionContract | null> {
  const result = await apiRequestWithPolicy<PrescriptionApiEnvelope>(
    withQuery(path),
    undefined,
    { allowedStatuses: [404, 405, 422], silent: true, timeoutMs: 10000 }
  );
  return result.ok ? normalizePrescriptionPayload(result.data) : null;
}

export async function fetchCustomerPrescriptionContract(args: { prescriptionId?: unknown; recommendationId?: unknown }): Promise<CustomerPrescriptionResponse> {
  const prescriptionId = cleanId(args.prescriptionId);
  const recommendationId = cleanId(args.recommendationId);

  try {
    if (prescriptionId) {
      const prescription = await fetchByPath(`/api/v1/prescriptions/${encodeURIComponent(prescriptionId)}`);
      if (prescription) {
        return {
          source: "prescription_by_id",
          dataScope: "OFFICIAL_PRESCRIPTION_API",
          generated_at: prescription.generated_at ?? prescription.updated_at ?? new Date().toISOString(),
          prescription,
        };
      }
    }

    if (recommendationId) {
      const prescription = await fetchByPath(`/api/v1/prescriptions/by-recommendation/${encodeURIComponent(recommendationId)}`);
      if (prescription) {
        return {
          source: "prescription_by_recommendation",
          dataScope: "OFFICIAL_PRESCRIPTION_API",
          generated_at: prescription.generated_at ?? prescription.updated_at ?? new Date().toISOString(),
          prescription,
        };
      }
    }

    return {
      source: "no_formal_prescription",
      dataScope: "NO_FORMAL_PRESCRIPTION",
      generated_at: new Date().toISOString(),
      prescription: null,
      message: "未形成正式处方。",
    };
  } catch {
    return {
      source: "empty_error_state",
      dataScope: "ERROR_EMPTY",
      generated_at: new Date().toISOString(),
      prescription: null,
      message: "处方详情暂不可用，请稍后刷新。",
    };
  }
}
