import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const FieldsPage = React.lazy(() => import("../../features/fields/pages/FieldsPage"));
const FieldCreatePage = React.lazy(() => import("../../features/fields/pages/FieldCreatePage"));
const FieldDetailPage = React.lazy(() => import("../../features/fields/pages/FieldDetailPage"));
const FieldReportPage = React.lazy(() => import("../../views/FieldReportPage"));
const FieldReportExportPage = React.lazy(() => import("../../views/FieldReportExportPage"));
const FieldPortfolioPage = React.lazy(() => import("../../views/FieldPortfolioPage"));

export function renderFieldsRoutes(): React.ReactElement[] {
  return [
    <Route key="fields" path="/fields" element={<FieldsPage />} />,
    <Route key="fields-new" path="/fields/new" element={<FieldCreatePage />} />,
    <Route key="fields-portfolio" path="/fields/portfolio" element={<FieldPortfolioPage />} />,
    <Route key="fields-detail" path="/fields/:fieldId" element={<RouteErrorBoundary><FieldDetailPage /></RouteErrorBoundary>} />,
    <Route key="fields-report" path="/fields/:fieldId/report" element={<RouteErrorBoundary><FieldReportPage /></RouteErrorBoundary>} />,
    <Route key="fields-report-export" path="/fields/:fieldId/report/export" element={<RouteErrorBoundary><FieldReportExportPage /></RouteErrorBoundary>} />,
  ];
}
