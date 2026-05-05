import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const OperationReportPage = React.lazy(() => import("../../views/OperationReportPage"));
const CustomerReportExportPage = React.lazy(() => import("../../views/CustomerReportExportPage"));

export function renderCustomerOperationsRoutes(): React.ReactElement[] {
  return [
    <Route
      key="customer-operations-detail"
      path="/customer/operations/:operationId"
      element={<RouteErrorBoundary><OperationReportPage /></RouteErrorBoundary>}
    />,
    <Route
      key="customer-operations-export"
      path="/customer/operations/:operationId/export"
      element={<RouteErrorBoundary><CustomerReportExportPage /></RouteErrorBoundary>}
    />,
  ];
}
