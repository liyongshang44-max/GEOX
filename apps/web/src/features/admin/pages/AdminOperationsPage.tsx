// apps/web/src/features/admin/pages/AdminOperationsPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  readback: { zh: "回查", en: "Readback" },
  title: { zh: "后台作业", en: "Admin Operations" },
  lead: { zh: "作业回查界面。", en: "Operations readback surface." },
  panel: { zh: "作业管理标签", en: "Operation management labels" },
  allowedField: { zh: "允许字段", en: "Allowed field" },
  boundary: { zh: "边界", en: "Boundary" },
};

export default function AdminOperationsPage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">{localizedText(COPY.readback, locale)}</p>
        <h1>{localizedText(COPY.title, locale)}</h1>
        <p>{localizedText(COPY.lead, locale)}</p>
      </header>
      <AdminPanel title={localizedText(COPY.panel, locale)}>
        <AdminTable headers={[localizedText(COPY.allowedField, locale), localizedText(COPY.boundary, locale)]} rows={[["operation_id", "read"], ["plan_status", "read"], ["approval_status", "read"], ["task_status", "read"], ["receipt_status", "read"], ["as_executed_status", "read"], ["acceptance_status", "read"], ["blocking_reason", "read"]]} />
      </AdminPanel>
    </main>
  );
}
