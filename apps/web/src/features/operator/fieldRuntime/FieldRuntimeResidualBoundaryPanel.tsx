// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualBoundaryPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

const KEYS: FieldRuntimeCopyKey[] = ["noFactsWrite", "noRecommendation", "noApproval", "noDispatch", "noAoAct", "noRoi", "noFieldMemory", "noBackendChange"];

export default function FieldRuntimeResidualBoundaryPanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const label = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__residualBoundary" data-h60h-panel="residual-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("residualBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("residualBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("readOnly")} {t("reviewOnly")}</span></div>
    <ul className="operatorFieldRuntime__boundaryList">{KEYS.map((key) => <li key={key}>{t(key)}</li>)}<li>{label("No Causal Proof Claim", "不声明因果证明")}</li><li>{label("No Operation Plan Creation", "不创建作业计划")}</li></ul>
    {residual.boundaryRules.length > 0 ? <div><p className="operatorFieldRuntime__panelMeta">{label("Verification Read-model Boundary Rules", "核验读模型边界规则")}</p><ul className="operatorFieldRuntime__boundaryList">{residual.boundaryRules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div> : null}
  </article>;
}
