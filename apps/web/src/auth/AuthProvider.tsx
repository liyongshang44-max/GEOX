import React from "react";
import { clearSessionToken, persistSessionToken, readSessionToken } from "./authStorage";

type SessionContextValue = {
  token: string;
  setToken: (nextToken: string) => void;
  clearToken: () => void;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [token, setTokenState] = React.useState<string>(() => readSessionToken());

  const setToken = React.useCallback((nextToken: string) => {
    setTokenState(persistSessionToken(nextToken));
  }, []);

  const clearToken = React.useCallback(() => {
    clearSessionToken();
    setTokenState("");
  }, []);

  const value = React.useMemo(() => ({ token, setToken, clearToken }), [token, setToken, clearToken]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAuthProviderSession(): SessionContextValue {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error("AuthProvider is required for useSession");
  return value;
}
