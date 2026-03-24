import React from "react";
import { useSession } from "../auth/useSession";
import { fetchAuthMe, type AuthMe } from "../api/auth";

export function useSettings(): {
  session: AuthMe | null;
  status: string;
  loading: boolean;
  tokenPreview: string;
  refresh: () => Promise<void>;
} {
  const { token } = useSession();
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setStatus("正在读取当前会话...");
    try {
      const me = await fetchAuthMe();
      setSession(me);
      setStatus(`当前角色：${me.role === "admin" ? "管理员" : "操作员"}`);
    } catch (e: any) {
      setSession(null);
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const tokenPreview = React.useMemo(() => {
    const t = String(token || "").trim();
    if (!t) return "-";
    if (t.length <= 12) return t;
    return `${t.slice(0, 6)}...${t.slice(-4)}`;
  }, [token]);

  return { session, status, loading, tokenPreview, refresh };
}
