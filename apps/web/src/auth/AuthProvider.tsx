import React from "react";
import { clearSession, persistSession, persistSessionToken, readStoredSession, readTenantContext } from "./authStorage";
import { createSessionState, isSameTenantContext, type AuthPayload, type SessionState, type TenantContext } from "./sessionModel";

type SessionContextValue = {
  token: string;
  isLoggedIn: boolean;
  context: TenantContext | null;
  role: string;
  scopes: string[];
  actorId: string;
  tokenId: string;
  notice: string | null;
  setToken: (token: string) => void;
  applyLogin: (token: string, payload: AuthPayload) => SessionState;
  hydrateSession: (payload: AuthPayload) => SessionState | null;
  clearSession: () => void;
  clearNotice: () => void;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

function buildConflictNotice(previous: TenantContext, next: TenantContext): string {
  return `检测到历史会话上下文（${previous.tenant_id}/${previous.project_id}/${previous.group_id}）与新登录上下文（${next.tenant_id}/${next.project_id}/${next.group_id}）不一致，系统已切换到新登录上下文。`;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = React.useState<SessionState | null>(() => readStoredSession());
  const [notice, setNotice] = React.useState<string | null>(null);

  const applyLogin = React.useCallback((token: string, payload: AuthPayload): SessionState => {
    const next = createSessionState(token, payload);
    if (!next) throw new Error("SESSION_CONTEXT_REQUIRED");

    const previousContext = session?.context ?? readTenantContext();
    if (previousContext && !isSameTenantContext(previousContext, next.context)) {
      setNotice(buildConflictNotice(previousContext, next.context));
    }

    const stored = persistSession(next);
    setSession(stored);
    return stored;
  }, [session]);

  const hydrateSession = React.useCallback((payload: AuthPayload): SessionState | null => {
    if (!session?.token) return null;
    const next = createSessionState(session.token, payload);
    if (!next) {
      clearSession();
      setSession(null);
      return null;
    }

    const stored = persistSession(next);
    setSession(stored);
    return stored;
  }, [session]);

  const clearSessionState = React.useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const clearNotice = React.useCallback(() => {
    setNotice(null);
  }, []);

  const setToken = React.useCallback((token: string) => {
    const cleanToken = persistSessionToken(token);
    setSession((prev) => {
      if (!cleanToken) return null;
      if (!prev?.context) return null;
      const next = { ...prev, token: cleanToken };
      persistSession(next);
      return next;
    });
  }, []);

  const value = React.useMemo<SessionContextValue>(() => ({
    token: session?.token ?? "",
    isLoggedIn: Boolean(session?.token && session?.context),
    context: session?.context ?? null,
    role: session?.meta.role ?? "",
    scopes: session?.meta.scopes ?? [],
    actorId: session?.meta.actor_id ?? "",
    tokenId: session?.meta.token_id ?? "",
    notice,
    setToken,
    applyLogin,
    hydrateSession,
    clearSession: clearSessionState,
    clearNotice,
  }), [session, notice, setToken, applyLogin, hydrateSession, clearSessionState, clearNotice]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAuthProviderSession(): SessionContextValue {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error("AuthProvider is required for useSession");
  return value;
}
