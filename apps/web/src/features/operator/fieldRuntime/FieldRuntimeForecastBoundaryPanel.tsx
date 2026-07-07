// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastBoundaryPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

const EXTRA = {
  noScenario: { zh: "不执行情景比较", en: "No Scenario Comparison" },
  noGeneration: { zh: "不生成新预测", en: "No Forecast Generation" },
  rules: { zh: "预测读模型边界规则", en: "Forecast Read-model Boundary Rules" },
} as const satisfies Record<string, LocalizedCopy>;
const BASE_KEYS: FieldRuntimeCopyKey[] = ["noFactsWrite", "noRecommendation", "noApproval", "noDispatch", "noAoAct", "noRoi", "noFieldMemory", "noBackendChange"];

export default function FieldRuntimeForecastBoundaryPanel({ forecast }: { forecast: FieldRuntimeForecastViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastBoundary" data-h60f-panel="forecast-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("forecastBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("forecastBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("readOnly")} {t("forecastReview")}</span></div>
    <ul className="operatorFieldRuntime__boundaryList">{BASE_KEYS.map((key) => <li key={key}>{t(key)}</li>)}<li>{c(EXTRA.noScenario)}</li><li>{c(EXTRA.noGeneration)}</li></ul>
    {forecast.boundaryRules.length > 0 ? <div><p className="operatorFieldRuntime__panelMeta">{c(EXTRA.rules)}</p><ul className="operatorFieldRuntime__boundaryList">{forecast.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div> : null}
  </article>;
}
