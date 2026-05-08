import React from "react";
import { Navigate, Route } from "react-router-dom";
import RouteErrorBoundary from "../errors/RouteErrorBoundary";

const OperationsPage = React.lazy(() => import("../../features/operations/pages/OperationsPage"));
const OperationDetailPage = React.lazy(() => import("../../features/operations/pages/OperationDetailPage"));
const HumanAssignmentsPage = React.lazy(() => import("../../features/operations/pages/HumanAssignmentsPage"));
const HumanAssignmentDetailPage = React.lazy(() => import("../../features/operations/pages/HumanAssignmentDetailPage"));
const DispatchWorkbenchPage = React.lazy(() => import("../../features/operations/pages/DispatchWorkbenchPage"));
const AlertsPage = React.lazy(() => import("../../features/operations/pages/AlertsPage"));
const ManualExecutionAnalysisPage = React.lazy(() => import("../../features/operations/pages/ManualExecutionAnalysisPage"));
const HumanOpsAnalyticsPage = React.lazy(() => import("../../features/operations/pages/HumanOpsAnalyticsPage"));
const OperationReportPage = React.lazy(() => import("../../features/operations/pages/OperationReportPage"));
const OperationReportExportPage = React.lazy(() => import("../../features/operations/pages/OperationReportExportPage"));
const OperationsWorkboardPage = React.lazy(() => import("../../features/operations/pages/OperationsWorkboardPage"));
const CustomerOperationsIndexPage = React.lazy(() => import("../../views/CustomerOperationsIndexPage"));
const AdminOperationDebugPage = React.lazy(() => import("../../features/dashboard/pages/AdminOperationDebugPage"));

export function renderCustomerOperationsRoutes(): React.ReactElement[] {
  return [
    <Route key="customer-operations" path="/customer/operations" element={<RouteErrorBoundary><CustomerOperationsIndexPage /></RouteErrorBoundary>} />,
    <Route key="customer-operations-index" path="/customer/operations/index" element={<Navigate to="/customer/operations" replace />} />,
    <Route key="customer-operations-detail" path="/customer/operations/:operationId" element={<RouteErrorBoundary><OperationReportPage /></RouteErrorBoundary>} />,
    <Route key="customer-operations-export" path="/customer/operations/:operationId/export" element={<RouteErrorBoundary><OperationReportExportPage /></RouteErrorBoundary>} />,
  ];
}

export function renderOperationsRoutes(): React.ReactElement[] {
  return [
    ...renderCustomerOperationsRoutes(),
    <Route key="operations" path="/operations" element={<OperationsPage />} />,
    <Route key="operations-detail" path="/operations/:operationId" element={<RouteErrorBoundary><OperationDetailPage /></RouteErrorBoundary>} />,
    <Route key="operations-report" path="/operations/:operationId/report" element={<RouteErrorBoundary><OperationReportPage /></RouteErrorBoundary>} />,
    <Route key="operations-report-export" path="/operations/:operationId/report/export" element={<RouteErrorBoundary><OperationReportExportPage /></RouteErrorBoundary>} />,
    <Route key="admin-operation-debug" path="/admin/operations/:operationId/debug" element={<RouteErrorBoundary><AdminOperationDebugPage /></RouteErrorBoundary>} />,
    <Route key="operations-workboard" path="/operations/workboard" element={<OperationsWorkboardPage />} />,
    <Route key="human-assignments" path="/human-assignments" element={<HumanAssignmentsPage />} />,
    <Route key="human-assignments-detail" path="/human-assignments/:assignmentId" element={<RouteErrorBoundary><HumanAssignmentDetailPage /></RouteErrorBoundary>} />,
    <Route key="dispatch-workbench" path="/dispatch-workbench" element={<DispatchWorkbenchPage />} />,
    <Route key="manual-execution-analysis" path="/human-execution-analysis" element={<ManualExecutionAnalysisPage />} />,
    <Route key="human-ops-analytics" path="/human-ops-analytics" element={<HumanOpsAnalyticsPage />} />,
    <Route key="alerts" path="/alerts" element={<AlertsPage />} />,
  ];
}
