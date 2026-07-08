// apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionTailPanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

export default function FieldRuntimeExecutionTailPanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const label = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const regionLabel = t("executionTail");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__executionTail" data-h60h-panel="execution-tail">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("executionTail")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("executionTail")}</h2></div><span className="operatorFieldRuntime__panelMeta">{label("Trace Summary Only", "仅追踪摘要")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{label("The execution tail is not the full Audit drawer.", "执行尾部不是完整审计抽屉。")}</p>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-residual-execution-tail">
      <div className="operatorFieldRuntime__residualTable" role="table" aria-label={regionLabel}>
        <div className="operatorFieldRuntime__residualTableHeader" role="row"><span>{label("Stage", "阶段")}</span><span>{label("Label", "标签")}</span><span>{t("status")}</span><span>{label("Ref", "引用")}</span></div>
        {residual.executionTail.map((stage) => <div className="operatorFieldRuntime__residualTableRow" role="row" key={stage.stageCode}><span data-long-token="true">{stage.stageCode}</span><span>{stage.label}</span><span>{stage.statusText}</span><span data-long-token="true">{stage.ref}</span></div>)}
      </div>
    </ProductHorizontalScrollRegion>
  </article>;
}
