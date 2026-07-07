// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLegacyBridgePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditLegacyBridgePanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditLegacyBridge" data-h60k-panel="audit-legacy-bridge">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditLegacyBridge")}</h2></div><span className="operatorFieldRuntime__panelMeta">{audit.legacyRouteFamily}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Legacy routes remain preserved and isolated without redirect.", "旧版路由继续保留并隔离，不引入重定向。")}</p>
    <div className="operatorFieldRuntime__auditTable" role="table" aria-label={t("auditLegacyBridge")}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Canonical Route", "规范路由")}</span><span>{text("Legacy Route", "旧版路由")}</span><span>{text("Strategy", "策略")}</span></div>{audit.legacyRoutes.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.canonicalRoute + row.legacyRoute}><span>{row.canonicalRoute}</span><span>{row.legacyRoute}</span><span>{row.strategy}</span></div>)}</div>
  </article>;
}
