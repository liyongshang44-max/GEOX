// apps/web/src/features/operator/fieldRuntime/FieldRuntimeSourceIndexPanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

export default function FieldRuntimeSourceIndexPanel({ evidence }: { evidence: FieldRuntimeEvidenceViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const regionLabel = t("sourceIndexAria");
  return (
    <article className="operatorFieldRuntime__panel" data-h60e-panel="source-index">
      <div className="operatorFieldRuntime__panelHeader">
        <div><p className="operatorFieldRuntime__eyebrow">{t("sourceIndex")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("sourceIndex")}</h2></div>
        <span className="operatorFieldRuntime__panelMeta">{evidence.sourceIndexes.length} {t("sources")}</span>
      </div>
      <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-evidence-source-index">
        <div className="operatorFieldRuntime__sourceIndexTable" role="table" aria-label={regionLabel}>
          <div className="operatorFieldRuntime__tableHeader" role="row"><span>{t("sourceLabel")}</span><span>{t("available")}</span><span>{t("rows")}</span><span>{t("missingReason")}</span><span>{t("refs")}</span></div>
          {evidence.sourceIndexes.map((row) => (
            <div className="operatorFieldRuntime__tableRow" role="row" key={row.tableName}>
              <span><strong>{row.sourceLabel}</strong><small data-long-token="true">{row.tableName}</small></span>
              <span>{row.available ? t("available") : t("unavailable")}</span>
              <span>{row.rowCount}</span><span>{row.missingReason}</span><span>{row.latestEvidenceRefs.length}</span>
            </div>
          ))}
        </div>
      </ProductHorizontalScrollRegion>
    </article>
  );
}
