import React from "react";
import { Navigate, Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const FieldsPage = React.lazy(() => import("../../features/fields/pages/FieldsPage"));
const FieldCreatePage = React.lazy(() => import("../../features/fields/pages/FieldCreatePage"));
const FieldDetailPage = React.lazy(() => import("../../features/fields/pages/FieldDetailPage"));
const FieldReportPage = React.lazy(() => import("../../views/FieldReportPage"));
const FieldReportExportPage = React.lazy(() => import("../../views/FieldReportExportPage"));
const FieldPortfolioPage = React.lazy(() => import("../../views/FieldPortfolioPage"));

export function renderCustomerFieldsRoutes(): React.ReactElement[] {
  return [
    <Route key="fields-redirect" path="/fields" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="customer-fields" path="/customer/fields" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="customer-fields-new" path="/customer/fields/new" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="customer-fields-portfolio" path="/customer/fields/portfolio" element={<Navigate to="/customer/dashboard" replace />} />,
    <Route key="customer-fields-detail" path="/customer/fields/:fieldId" element={<RouteErrorBoundary><FieldReportPage /></RouteErrorBoundary>} />,
    <Route key="customer-fields-export" path="/customer/fields/:fieldId/export" element={<RouteErrorBoundary><FieldReportExportPage /></RouteErrorBoundary>} />,
  ];
}

export function renderAdminFieldsRoutes(): React.ReactElement[] {
  return [
    <Route key="admin-fields" path="/admin/fields" element={<FieldsPage />} />,
    <Route key="admin-fields-new" path="/admin/fields/new" element={<FieldCreatePage />} />,
    <Route key="admin-fields-portfolio" path="/admin/fields/portfolio" element={<FieldPortfolioPage />} />,
    <Route key="admin-fields-detail" path="/admin/fields/:fieldId" element={<RouteErrorBoundary><FieldDetailPage /></RouteErrorBoundary>} />,
  ];
}
