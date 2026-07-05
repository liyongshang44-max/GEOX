// apps/web/src/features/admin/pages/AdminDashboardPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
import { localizedText, useLocale } from "../../../lib/locale";
import { ADMIN_SHELL_LABELS } from "../../../lib/productSurfaceLabels";
import { boundaryRules, dashboardRows } from "./adminPageData";

const COPY = {
  title: { zh: "后台总览", en: "Admin Dashboard" },
  lead: { zh: "内部治理回查界面；不直接执行，不打开生产能力。", en: "Internal governance readback surface; no direct execution and no production capability is opened." },
  summaries: { zh: "只读摘要", en: "Read-only summaries" },
  boundaries: { zh: "边界规则", en: "Boundary rules" },
  area: { zh: "区域", en: "Area" },
  mode: { zh: "模式", en: "Mode" },
};

export default function AdminDashboardPage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage" data-surface="admin-dashboard-readback">
      <header className="adminControlPlaneHero">
        <p className="adminPill">{localizedText(ADMIN_SHELL_LABELS.meta.internalGovernanceSurface, locale)}</p>
        <h1>{localizedText(COPY.title, locale)}</h1>
        <p>{localizedText(COPY.lead, locale)}</p>
      </header>
      <section className="adminPanelGrid">
        <AdminPanel title={localizedText(COPY.summaries, locale)}>
          <AdminTable headers={[localizedText(COPY.area, locale), localizedText(COPY.mode, locale)]} rows={dashboardRows} />
        </AdminPanel>
        <AdminPanel title={localizedText(COPY.boundaries, locale)}>
          <ul className="adminList">{boundaryRules.map((r) => <li key={r}>{r}</li>)}</ul>
        </AdminPanel>
      </section>
    </main>
  );
}
