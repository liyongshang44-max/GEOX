// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTracePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type Props = { evidence: FieldRuntimeEvidenceViewModel };

export default function FieldRuntimeEvidenceTracePanel({ evidence }: Props): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__evidenceTrace" data-h60e-panel="evidence-trace">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("evidenceTrace")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("evidenceTrace")}</h2></div><span className="operatorFieldRuntime__panelMeta">{evidence.traceItems.length} {t("traceItems")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{t("traceLead")}</p>
    <div className="operatorFieldRuntime__evidenceTraceList">{evidence.traceItems.map((item, index) => <section className="operatorFieldRuntime__evidenceTraceItem" key={item.stage + item.label + String(index)}>
      <div><p className="operatorFieldRuntime__panelMeta">{item.stage}</p><strong>{item.label}</strong></div>
      <dl className="operatorFieldRuntime__evidenceDetailList">
        <div><dt>{t("available")}</dt><dd>{item.available ? t("available") : t("unavailable")}</dd></div>
        <div><dt>{t("sourceTable")}</dt><dd>{item.sourceTable}</dd></div>
        <div><dt>{t("latestTimestamp")}</dt><dd>{item.latestTsText}</dd></div>
        <div><dt>{t("qualityFlags")}</dt><dd>{item.qualityFlags.join(", ") || t("none")}</dd></div>
      </dl>
      <details className="operatorFieldRuntime__evidenceRefs"><summary>{item.evidenceRefs.length} {t("evidenceRefs")}</summary><ul>{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
    </section>)}</div>
  </article>;
}
