// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeScenarioLoadState } from "./fieldRuntimeScenarioAdapter";
import FieldRuntimeScenarioBoundaryPanel from "./FieldRuntimeScenarioBoundaryPanel";
import FieldRuntimeScenarioEvidencePanel from "./FieldRuntimeScenarioEvidencePanel";
import FieldRuntimeScenarioOptionsPanel from "./FieldRuntimeScenarioOptionsPanel";
import FieldRuntimeScenarioStatusPanel from "./FieldRuntimeScenarioStatusPanel";

export default function FieldRuntimeScenarioTabPanel({ loadState }: { loadState?: FieldRuntimeScenarioLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("scenario")}</h2><p>{loadState?.message || t("scenarioWaiting")}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("scenario")}</h2><p>{t("scenarioLoading")}</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("scenario")}</h2><p>{t("scenarioFailed")}: {loadState.message}</p></article>;
  const scenario = loadState.scenario;
  return <div className="operatorFieldRuntime__scenarioGrid" data-h60g="scenario-tab-ready" data-scenario-source={scenario.source} data-compare-source={scenario.scenarioCompare.source}>
    <article className="operatorFieldRuntime__panel" data-h60g-panel="scenario-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("scenario")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("scenarioReview")}</h2></div><span className="operatorFieldRuntime__panelMeta">operator_field_twin_scenario_compare_v1</span></div>
      <p className="operatorFieldRuntime__stubLead">scenario_compare_v1</p>
      <p className="operatorFieldRuntime__stubLead">{t("scenarioIntro")}</p>
      <p className="operatorFieldRuntime__stubLead">{t("scenarioOnly")}</p>
      <p className="operatorFieldRuntime__stubLead">{t("scenarioNonclaim")}</p>
      <p className="operatorFieldRuntime__stubLead">{t("scenarioNoActions")}</p>
    </article>
    <FieldRuntimeScenarioStatusPanel scenario={scenario} />
    <FieldRuntimeScenarioOptionsPanel scenario={scenario} />
    <FieldRuntimeScenarioEvidencePanel scenario={scenario} />
    <FieldRuntimeScenarioBoundaryPanel scenario={scenario} />
  </div>;
}
