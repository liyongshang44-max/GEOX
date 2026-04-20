export type TenantContext = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type SessionMeta = {
  role: string;
  scopes: string[];
  actor_id: string;
  token_id: string;
};

export type SessionState = {
  token: string;
  context: TenantContext;
  meta: SessionMeta;
};

export type AuthPayload = {
  actor_id?: string;
  token_id?: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  role?: string;
  scopes?: string[];
};

export function toTenantContext(payload: AuthPayload): TenantContext | null {
  const tenant_id = String(payload.tenant_id ?? "").trim();
  const project_id = String(payload.project_id ?? "").trim();
  const group_id = String(payload.group_id ?? "").trim();
  if (!tenant_id || !project_id || !group_id) return null;
  return { tenant_id, project_id, group_id };
}

export function toSessionMeta(payload: AuthPayload): SessionMeta {
  return {
    role: String(payload.role ?? ""),
    scopes: Array.isArray(payload.scopes) ? payload.scopes.map((item) => String(item)) : [],
    actor_id: String(payload.actor_id ?? ""),
    token_id: String(payload.token_id ?? ""),
  };
}

export function isSameTenantContext(a: TenantContext | null, b: TenantContext | null): boolean {
  if (!a || !b) return false;
  return a.tenant_id === b.tenant_id && a.project_id === b.project_id && a.group_id === b.group_id;
}

export function createSessionState(token: string, payload: AuthPayload): SessionState | null {
  const cleanToken = String(token ?? "").trim();
  const context = toTenantContext(payload);
  if (!cleanToken || !context) return null;
  return {
    token: cleanToken,
    context,
    meta: toSessionMeta(payload),
  };
}
