// apps/web/src/features/admin/pages/AdminDevicesPage.tsx
import React from "react";
import AdminPanel from "../components/AdminPanel";
import AdminTable from "../components/AdminTable";
import { localizedText, useLocale } from "../../../lib/locale";

const COPY = {
  readback: { zh: "回查", en: "Readback" },
  title: { zh: "后台设备", en: "Admin Devices" },
  lead: { zh: "设备状态回查界面；不声明实时连接或生产网关在线。", en: "Device state readback surface; no live connection or production gateway claim." },
  panel: { zh: "设备状态标签", en: "Device state labels" },
  allowedField: { zh: "允许字段", en: "Allowed field" },
  meaning: { zh: "含义", en: "Meaning" },
};

export default function AdminDevicesPage(): React.ReactElement {
  const { locale } = useLocale();
  return (
    <main className="adminControlPlanePage">
      <header className="adminControlPlaneHero">
        <p className="adminPill">{localizedText(COPY.readback, locale)}</p>
        <h1>{localizedText(COPY.title, locale)}</h1>
        <p>{localizedText(COPY.lead, locale)}</p>
      </header>
      <AdminPanel title={localizedText(COPY.panel, locale)}>
        <AdminTable headers={[localizedText(COPY.allowedField, locale), localizedText(COPY.meaning, locale)]} rows={[["device_id", "identity"], ["binding_status", "binding"], ["online_status", "connectivity"], ["last_seen", "telemetry recency"], ["capability", "declared capability"], ["source evidence refs", "traceability"]]} />
      </AdminPanel>
    </main>
  );
}
