import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const CommercialDashboardPage = React.lazy(() => import("../../features/dashboard/pages/CommercialDashboardPage"));
const ManualExecutionQualityAnalysisPage = React.lazy(() => import("../../features/dashboard/pages/ManualExecutionQualityAnalysisPage"));
const CustomerDashboardPage = React.lazy(() => import("../../views/CustomerDashboardPage"));
const CustomerDashboardExportPage = React.lazy(() => import("../../views/CustomerDashboardExportPage"));

export function renderDashboardRoutes(expert: boolean): React.ReactElement[] {
  return [
    <Route key="dashboard-root" path="/" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard" path="/dashboard" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard-manual-quality" path="/dashboard/manual-quality-analysis" element={<ManualExecutionQualityAnalysisPage />} />,
    <Route key="dashboard-customer" path="/dashboard/customer" element={<RouteErrorBoundary><CustomerDashboardPage /></RouteErrorBoundary>} />,
    <Route key="dashboard-export" path="/dashboard/export" element={<RouteErrorBoundary><CustomerDashboardExportPage /></RouteErrorBoundary>} />,
  ];
}
