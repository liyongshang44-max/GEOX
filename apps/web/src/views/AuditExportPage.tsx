import React from "react";
import { Navigate } from "react-router-dom";

export default function AuditExportPage(): React.ReactElement {
  return <Navigate to="/delivery/export-jobs" replace />;
}
