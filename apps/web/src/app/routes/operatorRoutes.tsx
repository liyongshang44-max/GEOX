import React from "react";
import { Navigate, Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const OperatorWorkbenchPage = React.lazy(() => import("../../views/operator/OperatorWorkbenchPage"));
const OperatorApprovalsPage = React.lazy(() => import("../../views/operator/OperatorApprovalsPage"));
const OperatorDispatchPage = React.lazy(() => import("../../views/operator/OperatorDispatchPage"));
const OperatorAcceptancePage = React.lazy(() => import("../../views/operator/OperatorAcceptancePage"));
const OperatorEvidencePage = React.lazy(() => import("../../views/operator/OperatorEvidencePage"));

export function renderOperatorRoutes(): React.ReactElement[] {
  return [
    <Route key="operator-root" path="/operator" element={<Navigate to="/operator/workbench" replace />} />,
    <Route key="operator-workbench" path="/operator/workbench" element={<RouteErrorBoundary><OperatorWorkbenchPage /></RouteErrorBoundary>} />,
    <Route key="operator-approvals" path="/operator/approvals" element={<RouteErrorBoundary><OperatorApprovalsPage /></RouteErrorBoundary>} />,
    <Route key="operator-dispatch" path="/operator/dispatch" element={<RouteErrorBoundary><OperatorDispatchPage /></RouteErrorBoundary>} />,
    <Route key="operator-acceptance" path="/operator/acceptance" element={<RouteErrorBoundary><OperatorAcceptancePage /></RouteErrorBoundary>} />,
    <Route key="operator-evidence" path="/operator/evidence" element={<RouteErrorBoundary><OperatorEvidencePage /></RouteErrorBoundary>} />,
  ];
}
