import React from "react";
import { Route } from "react-router-dom";

const AuditExportPage = React.lazy(() => import("../../views/AuditExportPage"));
const ExportJobsPage = React.lazy(() => import("../../views/ExportJobsPage"));

export function renderEvidenceRoutes(): React.ReactElement[] {
  return [
    <Route key="evidence-center" path="/audit-export" element={<AuditExportPage />} />,
    <Route key="evidence-jobs" path="/delivery/export-jobs" element={<ExportJobsPage />} />,
  ];
}
