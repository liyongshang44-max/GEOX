import React from "react";
import { Route } from "react-router-dom";

const CommercialDashboardPage = React.lazy(() => import("../../features/dashboard/pages/CommercialDashboardPage"));
const ManualExecutionQualityAnalysisPage = React.lazy(() => import("../../features/dashboard/pages/ManualExecutionQualityAnalysisPage"));

export function renderDashboardRoutes(expert: boolean): React.ReactElement[] {
  return [
    <Route key="dashboard-root" path="/" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard" path="/dashboard" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard-manual-quality" path="/dashboard/manual-quality-analysis" element={<ManualExecutionQualityAnalysisPage />} />,
  ];
}
