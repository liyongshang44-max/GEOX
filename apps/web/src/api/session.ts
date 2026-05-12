import { apiRequestWithPolicy, ApiError } from "./client";

export type CustomerScopeModeV1 = "CLIENT_ALLOWLIST" | "INTERNAL_PREVIEW" | "DENIED";

export type CustomerScopeV1 = {
  scope_mode: CustomerScopeModeV1;
  allowed_field_ids: string[];
  can_preview_all_fields: boolean;
  reason: string;
};

export type SessionMe = {
  user_id: string;
  display_name: string | null;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role?: string;
  roles: string[];
  scopes: string[];
  allowed_field_ids: string[];
  customer_scope?: CustomerScopeV1;
  permissions?: {
    customer_read: boolean;
    operator_read: boolean;
    operator_approve: boolean;
    operator_dispatch: boolean;
    operator_acceptance: boolean;
    operator_evidence_export: boolean;
    operator_alert_ack_close: boolean;
    admin_device_revoke: boolean;
  };
};

export async function fetchSessionMe(): Promise<SessionMe> {
  const res = await apiRequestWithPolicy<SessionMe>("/api/v1/session/me", undefined, { dedupe: true, timeoutMs: 8000 });
  if (!res.ok) throw new ApiError(res.status, res.bodyText, res.url);
  return res.data;
}
