import React from "react";
import { fetchAuthMe, fetchDashboardOverview, type AuthMe, type DashboardOverview } from "../api";

export function useDashboard(): {
  overview: DashboardOverview | null;
  session: AuthMe | null;
  loading: boolean;
  message: string;
  reload: () => Promise<void>;
} {
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [message, setMessage] = React.useState<string>("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const start = now - 24 * 60 * 60 * 1000;
    try {
      const [nextOverview, nextSession] = await Promise.all([
        fetchDashboardOverview({ from_ts_ms: start, to_ts_ms: now }),
        fetchAuthMe().catch(() => null),
      ]);
      setOverview(nextOverview);
      setSession(nextSession);
      setMessage(`当前会话：${nextSession?.role === "operator" ? "操作员" : nextSession?.role === "admin" ? "管理员" : "未识别"}；已同步最近 24 小时首页数据。`);
    } catch (e: any) {
      setMessage(`暂未读取到首页总览：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  return { overview, session, loading, message, reload };
}
