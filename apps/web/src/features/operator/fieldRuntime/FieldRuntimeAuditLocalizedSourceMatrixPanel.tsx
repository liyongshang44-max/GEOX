// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLocalizedSourceMatrixPanel.tsx
import React from "react";
import { useLocale, type LocaleCode } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

function tabLabel(value: string, locale: LocaleCode): string {
  const labels: Record<string, { zh: string; en: string }> = {
    overview: { zh: "总览", en: "Overview" },
    state: { zh: "状态", en: "State" },
    evidence: { zh: "证据", en: "Evidence" },
    forecast: { zh: "预测", en: "Forecast" },
    scenario: { zh: "情景", en: "Scenario" },
    residual: { zh: "残差", en: "Residual" },
    calibration: { zh: "校准", en: "Calibration" },
    health: { zh: "健康", en: "Health" },
    audit: { zh: "审计", en: "Audit" },
  };
  const copy = labels[value.trim().toLowerCase()];
  return copy ? (locale === "en-US" ? copy.en : copy.zh) : value;
}

export default function FieldRuntimeAuditLocalizedSourceMatrixPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditSourceMatrix" data-h60k-panel="audit-source-matrix">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditSourceMatrix")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Read Model Matrix", "读模型矩阵")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Source contract values are audit-detail metadata.", "来源契约值是审计细节元数据。")}</p>
    <div className="operatorFieldRuntime__auditTable" role="table" aria-label={t("auditSourceMatrix")}>
      <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Tab", "标签页")}</span><span>{text("Read Model", "读模型")}</span><span>Fetcher</span><span>{text("Source Contract", "来源契约")}</span><span>{text("Changed in H60", "H60 是否变更")}</span></div>
      {audit.sourceContracts.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.tab}><span>{tabLabel(row.tab, locale)}</span><span>{row.readModel}</span><span>{row.fetcher}</span><span>{row.sourceContract}</span><span>{row.backendChangedByH60 ? "true" : "false"}</span></div>)}
    </div>
  </article>;
}
