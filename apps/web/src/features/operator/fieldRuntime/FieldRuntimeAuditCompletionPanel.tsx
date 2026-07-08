// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditCompletionPanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeAuditCompletionPanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const rows = [
    [text("H60-D Overview / State", "H60-D 总览 / 状态"), audit.completionSummary.h60D],
    [text("H60-E Evidence", "H60-E 证据"), audit.completionSummary.h60E],
    [text("H60-F Forecast", "H60-F 预测"), audit.completionSummary.h60F],
    [text("H60-G Scenario", "H60-G 情景"), audit.completionSummary.h60G],
    [text("H60-H Residual / Verification", "H60-H 残差 / 核验"), audit.completionSummary.h60H],
    [text("H60-I Calibration", "H60-I 校准"), audit.completionSummary.h60I],
    [text("Health", "健康"), "H62"],
    [text("Audit", "审计"), "H60-K"],
  ];
  const regionLabel = t("auditCompletion");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditCompletion" data-h60k-panel="audit-completion">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditCompletion")}</h2></div><span className="operatorFieldRuntime__panelMeta">H60</span></div>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-audit-completion">
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label={regionLabel}><div className="operatorFieldRuntime__auditTableHeader" role="row"><span>{text("Phase", "阶段")}</span><span>{t("status")}</span></div>{rows.map(([phase, status]) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={phase}><span>{phase}</span><span>{status}</span></div>)}</div>
    </ProductHorizontalScrollRegion>
  </article>;
}
