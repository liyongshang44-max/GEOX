import React from "react";
import { Navigate, Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const CommercialDashboardPage = React.lazy(() => import("../../features/dashboard/pages/CommercialDashboardPage"));
const ManualExecutionQualityAnalysisPage = React.lazy(() => import("../../features/dashboard/pages/ManualExecutionQualityAnalysisPage"));
const CustomerDashboardPage = React.lazy(() => import("../../features/customer/pages/CustomerDashboardPage"));
const CustomerDashboardExportPage = React.lazy(() => import("../../features/customer/pages/CustomerDashboardExportPage"));
const CustomerReportExportPage = React.lazy(() => import("../../features/customer/pages/CustomerReportExportPage"));

export function renderDashboardRoutes(expert: boolean): React.ReactElement[] {
  return [
    <Route key="dashboard-root" path="/" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-redirect" path="/dashboard" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-admin" path="/admin/dashboard" element={<CommercialDashboardPage expert={expert} />} />,
    <Route key="dashboard-manual-quality" path="/dashboard/manual-quality-analysis" element={<ManualExecutionQualityAnalysisPage />} />,
    <Route key="dashboard-customer-legacy" path="/dashboard/customer" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="dashboard-customer" path="/customer/dashboard" element={<RouteErrorBoundary><CustomerDashboardPage /></RouteErrorBoundary>} />,
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
  ];
}
