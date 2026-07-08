// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceBoundaryPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

const BOUNDARY_KEYS: FieldRuntimeCopyKey[] = ["noFactsWrite", "noRecommendation", "noApproval", "noDispatch", "noAoAct", "noRoi", "noFieldMemory", "noEvidenceMutation", "noBackendChange"];
const COPY = {
  rule: { zh: "只读证据边界规则", en: "Read-only Evidence Boundary Rule" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeEvidenceBoundaryPanel({ evidence }: { evidence: FieldRuntimeEvidenceViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__evidenceBoundary" data-h60e-panel="evidence-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("evidenceBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("evidenceBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("evidenceBoundaryMeta")}</span></div>
    <ul className="operatorFieldRuntime__boundaryList">{BOUNDARY_KEYS.map((key) => <li key={key}>{t(key)}</li>)}</ul>
    {evidence.boundaryRules.length > 0 ? <div><p className="operatorFieldRuntime__panelMeta">{t("evidenceBoundaryRules")}</p><ul className="operatorFieldRuntime__boundaryList">{evidence.boundaryRules.map((rule, index) => <li key={`${index}:${rule}`}>{operatorSafeDisplay(rule, locale, COPY.rule)}</li>)}</ul></div> : null}
  </article>;
}
