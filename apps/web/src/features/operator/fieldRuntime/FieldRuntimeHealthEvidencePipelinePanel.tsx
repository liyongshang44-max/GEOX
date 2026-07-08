// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthEvidencePipelinePanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthEvidencePipelinePanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const regionLabel = text("Evidence Pipeline Matrix", "证据管线矩阵");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthPipeline" data-h62-panel="evidence-pipeline">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("evidence")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Evidence Pipeline", "证据管线")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("No Write Surface", "无写入界面")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Pipeline status is read-only availability metadata.", "管线状态是只读可用性元数据。")}</p>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-health-evidence-pipeline">
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label={regionLabel}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Stage", "阶段")}</span><span>{t("source")}</span><span>{t("status")}</span><span>{text("Write Surface", "写入界面")}</span></div>{health.evidencePipeline.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.stage}><span>{row.stage}</span><span data-long-token="true">{row.source}</span><span>{row.status}</span><span>{row.writeSurface ? "true" : "false"}</span></div>)}</div>
    </ProductHorizontalScrollRegion>
  </article>;
}
