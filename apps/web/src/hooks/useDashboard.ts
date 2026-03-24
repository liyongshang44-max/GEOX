import React from "react";
import {
  fetchAuthMe,
  fetchDashboardAcceptanceRisks,
  fetchDashboardEvidenceSummary,
  fetchDashboardOverview,
  fetchDashboardPendingActions,
  fetchPrograms,
  type AuthMe,
  type DashboardOverview,
} from "../api";
import { buildDashboardViewModel } from "../viewmodels/dashboardViewModel";

export function useDashboard(): {
  session: AuthMe | null;
  loading: boolean;
  message: string;
  model: ReturnType<typeof buildDashboardViewModel>;
  reload: () => Promise<void>;
} {
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [message, setMessage] = React.useState<string>("");
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [activePrograms, setActivePrograms] = React.useState<any[]>([]);
  const [evidenceItems, setEvidenceItems] = React.useState<any[]>([]);
  const [riskItems, setRiskItems] = React.useState<any[]>([]);
  const [pendingActions, setPendingActions] = React.useState<any[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const start = now - 24 * 60 * 60 * 1000;
    try {
      const [nextOverview, nextSession, nextPrograms, nextEvidence, nextRisks, nextPending] = await Promise.all([
        fetchDashboardOverview({ from_ts_ms: start, to_ts_ms: now }),
        fetchAuthMe().catch(() => null),
        fetchPrograms({ status: "ACTIVE", limit: 6 }).catch(() => []),
        fetchDashboardEvidenceSummary(6).catch(() => []),
        fetchDashboardAcceptanceRisks(6).catch(() => []),
        fetchDashboardPendingActions(6).catch(() => []),
      ]);

      setOverview(nextOverview);
      setSession(nextSession);
      setActivePrograms(Array.isArray(nextPrograms) ? nextPrograms : []);
      setEvidenceItems(Array.isArray(nextEvidence) ? nextEvidence : []);
      setRiskItems(Array.isArray(nextRisks) ? nextRisks : []);
      setPendingActions(Array.isArray(nextPending) ? nextPending : []);
      setMessage(`当前会话：${nextSession?.role === "operator" ? "操作员" : nextSession?.role === "admin" ? "管理员" : "未识别"}；已同步首页聚合数据。`);
    } catch (e: any) {
      setMessage(`暂未读取到首页总览：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const model = React.useMemo(
    () => buildDashboardViewModel({ overview, activePrograms, evidenceItems, riskItems, pendingActions }),
    [overview, activePrograms, evidenceItems, riskItems, pendingActions],
  );

  return { session, loading, message, model, reload };
}
