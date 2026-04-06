import React from "react";
import { Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const OperationsPage = React.lazy(() => import("../../features/operations/pages/OperationsPage"));
const OperationDetailPage = React.lazy(() => import("../../features/operations/pages/OperationDetailPage"));
const HumanAssignmentsPage = React.lazy(() => import("../../views/HumanAssignmentsPage"));
const HumanAssignmentDetailPage = React.lazy(() => import("../../views/HumanAssignmentDetailPage"));
const DispatchWorkbenchPage = React.lazy(() => import("../../views/DispatchWorkbenchPage"));
const AlertsPage = React.lazy(() => import("../../views/AlertsPage"));

export function renderOperationsRoutes(): React.ReactElement[] {
  return [
    <Route key="operations" path="/operations" element={<OperationsPage />} />,
    <Route key="operations-detail" path="/operations/:operationPlanId" element={<RouteErrorBoundary><OperationDetailPage /></RouteErrorBoundary>} />,
    <Route key="human-assignments" path="/human-assignments" element={<HumanAssignmentsPage />} />,
    <Route key="human-assignments-detail" path="/human-assignments/:assignmentId" element={<RouteErrorBoundary><HumanAssignmentDetailPage /></RouteErrorBoundary>} />,
    <Route key="dispatch-workbench" path="/dispatch-workbench" element={<DispatchWorkbenchPage />} />,
    <Route key="alerts" path="/alerts" element={<AlertsPage />} />,
  ];
}
