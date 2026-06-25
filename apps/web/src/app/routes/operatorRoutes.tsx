import React from "react";
import { Navigate, Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const OperatorWorkbenchPage = React.lazy(() => import("../../features/operator/pages/OperatorWorkbenchPage"));
const OperatorApprovalsPage = React.lazy(() => import("../../features/operator/pages/OperatorApprovalsPage"));
const OperatorDispatchPage = React.lazy(() => import("../../features/operator/pages/OperatorDispatchPage"));
const OperatorAcceptancePage = React.lazy(() => import("../../features/operator/pages/OperatorAcceptancePage"));
const OperatorEvidencePage = React.lazy(() => import("../../features/operator/pages/OperatorEvidencePage"));
const OperatorDevicesAlertsPage = React.lazy(() => import("../../features/operator/pages/OperatorDevicesAlertsPage"));
const OperatorRoiLedgerPage = React.lazy(() => import("../../features/operator/pages/OperatorRoiLedgerPage"));
const OperatorFieldMemoryPage = React.lazy(() => import("../../features/operator/pages/OperatorFieldMemoryPage"));
const OperatorEvidenceTwinPage = React.lazy(() => import("../../features/operator/pages/OperatorEvidenceTwinPage"));

export function renderOperatorRoutes(): React.ReactElement[] {
  return [
    <Route key="operator-root" path="/operator" element={<Navigate to="/operator/workbench" replace />} />,
    <Route key="operator-workbench" path="/operator/workbench" element={<RouteErrorBoundary><OperatorWorkbenchPage /></RouteErrorBoundary>} />,
    <Route key="operator-approvals" path="/operator/approvals" element={<RouteErrorBoundary><OperatorApprovalsPage /></RouteErrorBoundary>} />,
    <Route key="operator-dispatch" path="/operator/dispatch" element={<RouteErrorBoundary><OperatorDispatchPage /></RouteErrorBoundary>} />,
    <Route key="operator-acceptance" path="/operator/acceptance" element={<RouteErrorBoundary><OperatorAcceptancePage /></RouteErrorBoundary>} />,
    <Route key="operator-evidence" path="/operator/evidence" element={<RouteErrorBoundary><OperatorEvidencePage /></RouteErrorBoundary>} />,
    <Route key="operator-devices-alerts" path="/operator/devices-alerts" element={<RouteErrorBoundary><OperatorDevicesAlertsPage /></RouteErrorBoundary>} />,
    <Route key="operator-roi-ledger" path="/operator/roi-ledger" element={<RouteErrorBoundary><OperatorRoiLedgerPage /></RouteErrorBoundary>} />,
    <Route key="operator-field-memory" path="/operator/field-memory" element={<RouteErrorBoundary><OperatorFieldMemoryPage /></RouteErrorBoundary>} />,
    <Route key="h52-evidence-twin" path="/app/operator/fields/:fieldId/evidence-twin" element={<RouteErrorBoundary><OperatorEvidenceTwinPage /></RouteErrorBoundary>} />,
    <Route key="h52-water-stress-loop" path="/app/operator/fields/:fieldId/evidence-twin/water-stress" element={<RouteErrorBoundary><OperatorEvidenceTwinPage /></RouteErrorBoundary>} />,
  ];
}
