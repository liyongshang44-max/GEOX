// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLegacyBridgePanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditLegacyBridgePanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const regionLabel = t("auditLegacyBridge");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditLegacyBridge" data-h60k-panel="audit-legacy-bridge">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditLegacyBridge")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true" data-long-token="true">{audit.legacyRouteFamily}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Legacy routes remain preserved and isolated without redirect.", "旧版路由继续保留并隔离，不引入重定向。")}</p>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-audit-legacy-routes">
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label={regionLabel}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Canonical Route", "规范路由")}</span><span>{text("Legacy Route", "旧版路由")}</span><span>{text("Strategy", "策略")}</span></div>{audit.legacyRoutes.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.canonicalRoute + row.legacyRoute}><span data-locale-neutral="true" data-long-token="true">{row.canonicalRoute}</span><span data-locale-neutral="true" data-long-token="true">{row.legacyRoute}</span><span>{text("Preserve Without Redirect", "保留且不重定向")}</span></div>)}</div>
    </ProductHorizontalScrollRegion>
  </article>;
}
