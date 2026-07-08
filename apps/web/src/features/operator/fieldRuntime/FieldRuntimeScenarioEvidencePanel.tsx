// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioEvidencePanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

const COPY = {
  fullTrace: { zh: "完整证据追踪可在证据标签中查看。", en: "The full evidence trace is available in the Evidence tab." },
  refsOnly: { zh: "情景证据仅列出情景比较使用的引用。", en: "Scenario Evidence lists only the references used by scenario comparison." },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeScenarioEvidencePanel({ scenario }: { scenario: FieldRuntimeScenarioViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioEvidence" data-h60g-panel="scenario-evidence">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("scenarioEvidence")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("scenarioEvidence")}</h2></div><span className="operatorFieldRuntime__panelMeta">{scenario.evidenceRefs.length} {t("refs")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.fullTrace)}</p><p className="operatorFieldRuntime__stubLead">{c(COPY.refsOnly)}</p>
    <details className="operatorFieldRuntime__scenarioRefs" open><summary>{t("scenarioEvidence")} {t("refs")}</summary><ul data-locale-neutral="true">{scenario.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
  </article>;
}
