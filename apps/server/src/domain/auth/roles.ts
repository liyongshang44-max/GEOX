export type AuthRole = "admin" | "operator" | "viewer" | "client";
export type AuthResource = "reports" | "operations" | "dashboard" | "fields" | "portfolio" | "summary" | "tags";
export type AuthAction = "read" | "execute" | "write";

export const ROLE_ACTION_MATRIX: Record<AuthRole, Record<AuthResource, Record<AuthAction, boolean>>> = {
  admin: {
    reports: { read: true, execute: true, write: true },
    operations: { read: true, execute: true, write: true },
    dashboard: { read: true, execute: true, write: true },
    fields: { read: true, execute: true, write: true },
    portfolio: { read: true, execute: true, write: true },
    summary: { read: true, execute: true, write: true },
    tags: { read: true, execute: true, write: true },
  },
  operator: {
    reports: { read: true, execute: false, write: false },
    operations: { read: true, execute: true, write: false },
    dashboard: { read: true, execute: false, write: false },
    fields: { read: true, execute: false, write: false },
    portfolio: { read: true, execute: false, write: false },
    summary: { read: true, execute: false, write: false },
    tags: { read: true, execute: true, write: true },
  },
  viewer: {
    reports: { read: true, execute: false, write: false },
    operations: { read: true, execute: false, write: false },
    dashboard: { read: true, execute: false, write: false },
    fields: { read: true, execute: false, write: false },
    portfolio: { read: true, execute: false, write: false },
    summary: { read: true, execute: false, write: false },
    tags: { read: true, execute: false, write: false },
  },
  client: {
    reports: { read: true, execute: false, write: false },
    operations: { read: true, execute: false, write: false },
    dashboard: { read: true, execute: false, write: false },
    fields: { read: true, execute: false, write: false },
    portfolio: { read: true, execute: false, write: false },
    summary: { read: true, execute: false, write: false },
    tags: { read: true, execute: false, write: false },
  },
};

export function isRoleAllowed(role: AuthRole, resource: AuthResource, action: AuthAction): boolean {
  return Boolean(ROLE_ACTION_MATRIX[role]?.[resource]?.[action]);
}

export function methodToAction(method: string): AuthAction {
  const m = String(method || "").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "read";
  if (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") return "execute";
  return "write";
}
