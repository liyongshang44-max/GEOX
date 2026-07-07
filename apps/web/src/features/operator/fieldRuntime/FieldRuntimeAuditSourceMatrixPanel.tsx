// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditSourceMatrixPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditSourceMatrixPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditSourceMatrix" data-h60k-panel="audit-source-matrix">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditSourceMatrix")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Read Model Matrix", "读模型矩阵")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Source contract values are audit-detail metadata.", "来源契约值是审计细节元数据。")}</p>
    <div className="operatorFieldRuntime__auditTable" role="table" aria-label={t("auditSourceMatrix")}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Tab", "标签页")}</span><span>{text("Read Model", "读模型")}</span><span>Fetcher</span><span>{text("Source Contract", "来源契约")}</span><span>{text("Backend Changed", "后端是否变更")}</span></div>{audit.sourceContracts.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.readModel}</span><span>{row.fetcher}</span><span>{row.sourceContract}</span><span>{row.backendChangedByH60 ? "true" : "false"}</span></div>)}</div>
  </article>;
}
