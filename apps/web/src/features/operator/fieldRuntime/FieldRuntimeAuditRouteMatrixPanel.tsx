// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditRouteMatrixPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditRouteMatrixPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const routeRows = ["/operator/fields", ...audit.migratedTabs.map((row) => row.route)];
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditRouteMatrix" data-h60k-panel="audit-route-matrix">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditRouteMatrix")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">{audit.canonicalRouteFamily}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Route ownership metadata only.", "仅展示路由所有权元数据。")}</p>
    <div className="operatorFieldRuntime__auditTable" role="table" aria-label={t("auditRouteMatrix")}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Route", "路由")}</span><span>{text("Owner", "所有者")}</span><span>{t("status")}</span></div>{routeRows.map((route) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={route}><span data-locale-neutral="true">{route}</span><span data-locale-neutral="true">FieldRuntimeRoutePage</span><span>{text("Preserved", "已保留")}</span></div>)}</div>
  </article>;
}
