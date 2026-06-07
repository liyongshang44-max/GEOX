import React from "react";
import { Navigate, Route } from "react-router-dom";
import { fetchRuntimeFeatures, type RuntimeFeaturesResponseV1 } from "../../api/runtimeFeatures";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";
import { renderOperatorRoutes } from "./operatorRoutes";

const CommercialDashboardPage = React.lazy(() => import("../../features/dashboard/pages/CommercialDashboardPage"));
const ManualExecutionQualityAnalysisPage = React.lazy(() => import("../../features/dashboard/pages/ManualExecutionQualityAnalysisPage"));
const CustomerDashboardPage = React.lazy(() => import("../../features/customer/pages/CustomerDashboardPage"));
const CustomerDashboardExportPage = React.lazy(() => import("../../features/customer/pages/CustomerDashboardExportPage"));
const CustomerReportExportPage = React.lazy(() => import("../../features/customer/pages/CustomerReportExportPage"));
const FlightTablePage = React.lazy(() => import("../../features/dev/flight-table/pages/FlightTablePage"));

function FlightTableDisabledNotice({ features }: { features: RuntimeFeaturesResponseV1 | null }): React.ReactElement {
  return (
    <main className="customerPageShell">
      <section className="customerReportHero">
        <span className="customerEyebrow">devtools disabled</span>
        <h1>飞行台未启用</h1>
        <p>飞行台是研发与验收工具，当前受控试点运行环境未启用。</p>
        <p>当前 runtime 禁止 devtools，以避免模拟链路进入客户/运营正式链路。</p>
      </section>
      <section className="customerReportSection">
        <h2>Runtime feature boundary</h2>
        <div className="customerMetricGrid">
          <article>
            <span>runtime</span>
            <strong>{features?.runtime_env ?? "unknown"}</strong>
          </article>
          <article>
            <span>devtools</span>
            <strong>{features?.features.devtools_enabled ? "enabled" : "disabled"}</strong>
          </article>
          <article>
            <span>flight table</span>
            <strong>{features?.features.flight_table_enabled ? "enabled" : "disabled"}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}

function FlightTableRuntimeGate(): React.ReactElement {
  const [features, setFeatures] = React.useState<RuntimeFeaturesResponseV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchRuntimeFeatures()
      .then((next) => {
        if (!alive) return;
        setFeatures(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(String((err as any)?.message ?? err ?? "runtime features unavailable"));
        setFeatures(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <main className="customerPageShell"><div className="customerMutedCard">正在读取 runtime features...</div></main>;
  }

  if (error || !features?.features.flight_table_enabled) {
    return <FlightTableDisabledNotice features={features} />;
  }

  return <FlightTablePage />;
}

export function renderDashboardRoutes(expert: boolean): React.ReactElement[] {
  return [
    <Route key="dashboard-root" path="/" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-redirect" path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-admin" path="/admin/dashboard" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard-manual-quality" path="/dashboard/manual-quality-analysis" element={<ManualExecutionQualityAnalysisPage />} />,
    <Route key="dashboard-customer-legacy" path="/dashboard/customer" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-customer" path="/customer/dashboard" element={<RouteErrorBoundary><CustomerDashboardPage /></RouteErrorBoundary>} />,
    <Route key="flight-table" path="/dev/flight-table" element={<RouteErrorBoundary><FlightTableRuntimeGate /></RouteErrorBoundary>} />,
    <Route key="dashboard-export-legacy" path="/dashboard/export" element={<Navigate to="/customer/export" replace />} />,
    <Route
      key="dashboard-export"
      path="/customer/export"
      element={
        <RouteErrorBoundary>
          <CustomerDashboardExportPage />
        </RouteErrorBoundary>
      }
    />,
    ...renderOperatorRoutes(),
  ];
}
