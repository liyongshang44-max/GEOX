// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthSourcePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthSourcePanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthSource" data-h62-panel="source-freshness">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthSource")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Source Freshness", "来源新鲜度")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Metadata Only", "仅元数据")}</span></div>
      <p className="operatorFieldRuntime__stubLead">{text("Source freshness is review metadata.", "来源新鲜度是审查元数据。")}</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label={text("Source Freshness Matrix", "来源新鲜度矩阵")}>
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{t("source")}</span><span>{text("Availability", "可用性")}</span><span>{text("Meaning", "含义")}</span><span>{text("Boundary", "边界")}</span></div>
        {health.sourceFreshness.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.source}><span>{row.source}</span><span>{row.availability}</span><span>{row.freshnessMeaning}</span><span>{row.doesNotMean}</span></div>)}
      </div>
    </article>
  );
}
