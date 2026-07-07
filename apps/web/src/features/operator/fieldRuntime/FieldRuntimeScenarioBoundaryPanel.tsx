// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioBoundaryPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay } from "../../../lib/productCopy/operatorLocale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

const COPY = {
  legacy: { zh: "旧情景提交继续隔离在 /operator/twin/fields/:fieldId/scenarios。", en: "Legacy scenario submission remains isolated under /operator/twin/fields/:fieldId/scenarios." },
  noSubmission: { zh: "不提交情景", en: "No Scenario Submission" },
  noPlan: { zh: "不创建作业计划", en: "No Operation Plan Creation" },
  rules: { zh: "情景读模型边界规则", en: "Scenario Read-model Boundary Rules" },
  rule: { zh: "只读情景边界规则", en: "Read-only Scenario Boundary Rule" },
} as const satisfies Record<string, LocalizedCopy>;
const KEYS: FieldRuntimeCopyKey[] = ["noFactsWrite", "noRecommendation", "noApproval", "noDispatch", "noAoAct", "noRoi", "noFieldMemory", "noBackendChange"];

export default function FieldRuntimeScenarioBoundaryPanel({ scenario }: { scenario: FieldRuntimeScenarioViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioBoundary" data-h60g-panel="scenario-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("scenarioBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("scenarioBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("readOnly")} {t("scenarioReview")}</span></div>
    <p className="operatorFieldRuntime__scenarioNotice">{c(COPY.legacy)}</p>
    <ul className="operatorFieldRuntime__boundaryList">{KEYS.map((key) => <li key={key}>{t(key)}</li>)}<li>{c(COPY.noSubmission)}</li><li>{c(COPY.noPlan)}</li></ul>
    {scenario.boundaryRules.length > 0 ? <div><p className="operatorFieldRuntime__panelMeta">{c(COPY.rules)}</p><ul className="operatorFieldRuntime__boundaryList">{scenario.boundaryRules.map((rule, index) => <li key={`${index}:${rule}`}>{operatorSafeDisplay(rule, locale, COPY.rule)}</li>)}</ul></div> : null}
  </article>;
}
