import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

export type CustomerScopeModeV1 = "CLIENT_ALLOWLIST" | "INTERNAL_PREVIEW" | "DENIED";

export type CustomerScopeV1 = {
  scope_mode: CustomerScopeModeV1;
  allowed_field_ids: string[];
  can_preview_all_fields: boolean;
  reason: string;
};

export function normalizeCustomerAllowedFieldIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const values = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  return Array.from(new Set(values)).sort();
}

export function resolveCustomerScope(auth: Pick<AoActAuthContextV0, "role" | "allowed_field_ids">): CustomerScopeV1 {
  const role = String(auth.role ?? "").trim().toLowerCase();
  const allowedFieldIds = normalizeCustomerAllowedFieldIds(auth.allowed_field_ids);

  if (role === "client") {
    if (allowedFieldIds.length === 0) {
      return { scope_mode: "DENIED", allowed_field_ids: [], can_preview_all_fields: false, reason: "客户账号尚未绑定可查看地块" };
    }
    return { scope_mode: "CLIENT_ALLOWLIST", allowed_field_ids: allowedFieldIds, can_preview_all_fields: false, reason: "客户授权地块范围" };
  }

  if (allowedFieldIds.length === 0) {
    return { scope_mode: "INTERNAL_PREVIEW", allowed_field_ids: [], can_preview_all_fields: true, reason: "受控试点预览数据" };
  }

  return { scope_mode: "CLIENT_ALLOWLIST", allowed_field_ids: allowedFieldIds, can_preview_all_fields: false, reason: "受控试点授权地块范围" };
}

export function isFieldAllowedByCustomerScope(scope: CustomerScopeV1, fieldId: unknown): boolean {
  const normalizedFieldId = String(fieldId ?? "").trim();
  if (!normalizedFieldId) return false;
  if (scope.scope_mode === "DENIED") return false;
  if (scope.can_preview_all_fields) return true;
  return scope.allowed_field_ids.includes(normalizedFieldId);
}

export function filterByCustomerScope<T>(items: T[], scope: CustomerScopeV1, fieldIdOf: (item: T) => unknown): T[] {
  if (scope.scope_mode === "DENIED") return [];
  if (scope.can_preview_all_fields) return items;
  return items.filter((item) => isFieldAllowedByCustomerScope(scope, fieldIdOf(item)));
}
