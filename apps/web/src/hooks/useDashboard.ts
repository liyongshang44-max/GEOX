import React from "react";
import {
  fetchDashboardAcceptanceRisks,
  fetchDashboardControlPlane,
  fetchDashboardEvidenceSummary,
  fetchDashboardOverview,
  fetchDashboardPendingActions,
  fetchProgramPortfolio,
} from "../api";
import { buildDashboardViewModel, type DashboardVM } from "../viewmodels/dashboardViewModel";

export function useDashboard(): {
  loading: boolean;
  error: string | null;
  vm: DashboardVM;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<any>(null);
  const [controlPlane, setControlPlane] = React.useState<any>(null);
  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [evidenceItems, setEvidenceItems] = React.useState<any[]>([]);
  const [riskItems, setRiskItems] = React.useState<any[]>([]);
  const [pendingActions, setPendingActions] = React.useState<any[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const start = now - 24 * 60 * 60 * 1000;
      const [nextControlPlane, nextOverview, nextPortfolio, nextEvidence, nextRisks, nextPending] = await Promise.all([
        fetchDashboardControlPlane({ from_ts_ms: start, to_ts_ms: now }).catch(() => null),
        fetchDashboardOverview({ from_ts_ms: start, to_ts_ms: now }).catch(() => null),
        fetchProgramPortfolio({ limit: 80 }).catch(() => []),
        fetchDashboardEvidenceSummary(8).catch(() => []),
        fetchDashboardAcceptanceRisks(8).catch(() => []),
        fetchDashboardPendingActions(12).catch(() => []),
      ]);

      setControlPlane(nextControlPlane);
      setOverview(nextOverview);
      setPortfolio(Array.isArray(nextPortfolio) ? nextPortfolio : []);
      setEvidenceItems(Array.isArray(nextEvidence) ? nextEvidence : []);
      setRiskItems(Array.isArray(nextRisks) ? nextRisks : []);
      setPendingActions(Array.isArray(nextPending) ? nextPending : []);
    } catch (e: any) {
      setError(String(e?.message || e || "未知错误"));
      setOverview(null);
      setControlPlane(null);
      setPortfolio([]);
      setEvidenceItems([]);
      setRiskItems([]);
      setPendingActions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const vm = React.useMemo(
    () =>
      buildDashboardViewModel({
        overview,
        controlPlane,
        portfolio,
        pendingActions,
        riskItems,
        evidenceItems,
      }),
    [overview, controlPlane, portfolio, pendingActions, riskItems, evidenceItems],
  );

  return { loading, error, vm, reload };
}
