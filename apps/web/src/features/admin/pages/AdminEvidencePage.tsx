// apps/web/src/features/admin/pages/AdminEvidencePage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  readback: { zh: "回查", en: "Readback" },
  title: { zh: "后台证据", en: "Admin Evidence" },
  lead: { zh: "证据回查界面；evidence_ref、fact_id、source_ref、raw_payload、hashes 和 trace IDs 保持原始值。", en: "Evidence readback surface; evidence_ref, fact_id, source_ref, raw_payload, hashes, and trace IDs stay unchanged." },
  panel: { zh: "证据回查标签", en: "Evidence readback labels" },
  artifactRefs: { zh: "证据产物引用", en: "Evidence artifact refs" },
  sourceSummary: { zh: "来源摘要", en: "Source summary" },
  dataQuality: { zh: "数据质量状态", en: "Data quality status" },
  missingReasons: { zh: "缺失证据原因", en: "Missing evidence reasons" },
};

export default function AdminEvidencePage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">{localizedText(COPY.readback, locale)}</p>
        <h1>{localizedText(COPY.title, locale)}</h1>
        <p>{localizedText(COPY.lead, locale)}</p>
      </header>
      <AdminPanel title={localizedText(COPY.panel, locale)}>
        <ul className="adminEvidenceList"><li>{localizedText(COPY.artifactRefs, locale)}</li><li>{localizedText(COPY.sourceSummary, locale)}</li><li>{localizedText(COPY.dataQuality, locale)}</li><li>{localizedText(COPY.missingReasons, locale)}</li></ul>
      </AdminPanel>
    </main>
  );
}
