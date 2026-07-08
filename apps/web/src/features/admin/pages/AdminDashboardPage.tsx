// apps/web/src/features/admin/pages/AdminDashboardPage.tsx
import React from "react";
import AdminGovernanceLocalePage from "./AdminGovernanceLocalePage";
import { ADMIN_DASHBOARD_LOCALE_CONFIG } from "./adminDashboardLocaleConfig";

export default function AdminDashboardPage(): React.ReactElement {
  return <AdminGovernanceLocalePage config={ADMIN_DASHBOARD_LOCALE_CONFIG} />;
}
