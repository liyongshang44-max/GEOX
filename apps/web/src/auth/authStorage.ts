import type { SessionMeta, SessionState, TenantContext } from "./sessionModel";

const TOKEN_KEY = "geox_ao_act_token";
const TENANT_KEY = "geox_tenant_context";
const SESSION_META_KEY = "geox_session_meta";

function readStorageValue(key: string): string {
  try {
    const local = localStorage.getItem(key);
    if (typeof local === "string" && local.trim()) return local.trim();
  } catch {
    // ignore storage failures
  }

  try {
    const session = sessionStorage.getItem(key);
    if (typeof session === "string" && session.trim()) return session.trim();
  } catch {
    // ignore storage failures
  }

  return "";
}

function writeStorageValue(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
}

function removeStorageValue(key: string): void {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

export function readSessionToken(): string {
  return readStorageValue(TOKEN_KEY);
}

export function persistSessionToken(nextToken: string): string {
  const token = String(nextToken ?? "").trim();
  if (!token) {
    clearSessionToken();
    return "";
  }
  writeStorageValue(TOKEN_KEY, token);
  return token;
}

export function clearSessionToken(): void {
  removeStorageValue(TOKEN_KEY);
}

export function readTenantContext(): TenantContext | null {
  const raw = readStorageValue(TENANT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TenantContext>;
    const tenant_id = String(parsed.tenant_id ?? "").trim();
    const project_id = String(parsed.project_id ?? "").trim();
    const group_id = String(parsed.group_id ?? "").trim();
    if (!tenant_id || !project_id || !group_id) return null;
    return { tenant_id, project_id, group_id };
  } catch {
    return null;
  }
}

export function persistTenantContext(ctx: TenantContext): TenantContext {
  const next = {
    tenant_id: String(ctx.tenant_id ?? "").trim(),
    project_id: String(ctx.project_id ?? "").trim(),
    group_id: String(ctx.group_id ?? "").trim(),
  };

  if (!next.tenant_id || !next.project_id || !next.group_id) {
    throw new Error("TENANT_CONTEXT_REQUIRED");
  }

  writeStorageValue(TENANT_KEY, JSON.stringify(next));
  return next;
}

export function clearTenantContext(): void {
  removeStorageValue(TENANT_KEY);
}

export function readSessionMeta(): SessionMeta | null {
  const raw = readStorageValue(SESSION_META_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SessionMeta>;
    return {
      role: String(parsed.role ?? ""),
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes.map((item) => String(item)) : [],
      actor_id: String(parsed.actor_id ?? ""),
      token_id: String(parsed.token_id ?? ""),
    };
  } catch {
    return null;
  }
}

export function persistSessionMeta(meta: SessionMeta): SessionMeta {
  const next: SessionMeta = {
    role: String(meta.role ?? ""),
    scopes: Array.isArray(meta.scopes) ? meta.scopes.map((item) => String(item)) : [],
    actor_id: String(meta.actor_id ?? ""),
    token_id: String(meta.token_id ?? ""),
  };
  writeStorageValue(SESSION_META_KEY, JSON.stringify(next));
  return next;
}

export function clearSessionMeta(): void {
  removeStorageValue(SESSION_META_KEY);
}

export function readStoredSession(): SessionState | null {
  const token = readSessionToken();
  const context = readTenantContext();
  if (!token || !context) return null;
  return {
    token,
    context,
    meta: readSessionMeta() ?? { role: "", scopes: [], actor_id: "", token_id: "" },
  };
}

export function persistSession(session: SessionState): SessionState {
  const token = persistSessionToken(session.token);
  const context = persistTenantContext(session.context);
  const meta = persistSessionMeta(session.meta);
  return { token, context, meta };
}

export function clearSession(): void {
  clearSessionToken();
  clearTenantContext();
  clearSessionMeta();
}
