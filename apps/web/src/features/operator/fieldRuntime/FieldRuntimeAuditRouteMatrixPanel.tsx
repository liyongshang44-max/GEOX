// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditRouteMatrixPanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditRouteMatrixPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const routeRows = ["/operator/fields", ...audit.migratedTabs.map((row) => row.route)];
  const regionLabel = t("auditRouteMatrix");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditRouteMatrix" data-h60k-panel="audit-route-matrix">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditRouteMatrix")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true" data-long-token="true">{audit.canonicalRouteFamily}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Route ownership metadata only.", "仅展示路由所有权元数据。")}</p>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-audit-route-matrix">
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label={regionLabel}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Route", "路由")}</span><span>{text("Owner", "所有者")}</span><span>{t("status")}</span></div>{routeRows.map((route) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={route}><span data-locale-neutral="true" data-long-token="true">{route}</span><span data-locale-neutral="true" data-long-token="true">FieldRuntimeRoutePage</span><span>{text("Preserved", "已保留")}</span></div>)}</div>
    </ProductHorizontalScrollRegion>
  </article>;
}
