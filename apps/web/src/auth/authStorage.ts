const TOKEN_KEY = "geox_ao_act_token";
const DEFAULT_AO_ACT_TOKEN = "geox_dev_MqF24b9NHfB6AkBNjKaxP_T0CnL0XZykhdmSyoQvg4";
const TENANT_KEY = "geox_tenant_context";

export type TenantContext = { tenant_id: string; project_id: string; group_id: string };

const DEFAULT_TENANT: TenantContext = {
  tenant_id: "t_demo",
  project_id: "p_demo",
  group_id: "g_demo",
};

export function readSessionToken(): string {
  try {
    const local = localStorage.getItem(TOKEN_KEY);
    if (typeof local === "string" && local.trim()) return local.trim();
  } catch {
    // ignore storage failures
  }

  try {
    const session = sessionStorage.getItem(TOKEN_KEY);
    if (typeof session === "string" && session.trim()) return session.trim();
  } catch {
    // ignore storage failures
  }

  return DEFAULT_AO_ACT_TOKEN;
}

export function persistSessionToken(nextToken: string): string {
  const token = String(nextToken ?? "").trim() || DEFAULT_AO_ACT_TOKEN;
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  return token;
}

export function clearSessionToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}

export function readTenantContext(): TenantContext {
  try {
    const raw = localStorage.getItem(TENANT_KEY) || sessionStorage.getItem(TENANT_KEY);
    if (!raw) return DEFAULT_TENANT;
    const parsed = JSON.parse(raw) as Partial<TenantContext>;
    return {
      tenant_id: String(parsed.tenant_id || DEFAULT_TENANT.tenant_id),
      project_id: String(parsed.project_id || DEFAULT_TENANT.project_id),
      group_id: String(parsed.group_id || DEFAULT_TENANT.group_id),
    };
  } catch {
    return DEFAULT_TENANT;
  }
}

export function persistTenantContext(ctx: Partial<TenantContext>): TenantContext {
  const next = {
    tenant_id: String(ctx.tenant_id || DEFAULT_TENANT.tenant_id),
    project_id: String(ctx.project_id || DEFAULT_TENANT.project_id),
    group_id: String(ctx.group_id || DEFAULT_TENANT.group_id),
  };
  try { localStorage.setItem(TENANT_KEY, JSON.stringify(next)); } catch {}
  try { sessionStorage.setItem(TENANT_KEY, JSON.stringify(next)); } catch {}
  return next;
}
