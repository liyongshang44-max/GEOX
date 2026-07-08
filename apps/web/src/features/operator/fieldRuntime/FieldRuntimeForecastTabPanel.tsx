// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeForecastLoadState } from "./fieldRuntimeForecastAdapter";
import FieldRuntimeForecastBoundaryPanel from "./FieldRuntimeForecastBoundaryPanel";
import FieldRuntimeForecastEvidencePanel from "./FieldRuntimeForecastEvidencePanel";
import FieldRuntimeForecastTimelinePanel from "./FieldRuntimeForecastTimelinePanel";
import FieldRuntimeForecastWindowPanel from "./FieldRuntimeForecastWindowPanel";

export default function FieldRuntimeForecastTabPanel({ loadState }: { loadState?: FieldRuntimeForecastLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("forecast")}</h2><p>{loadState?.message || t("forecastWaiting")}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("forecast")}</h2><p>{t("forecastLoading")}</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("forecast")}</h2><p>{t("forecastFailed")}: <span data-locale-neutral="true">{loadState.message}</span></p></article>;
  const forecast = loadState.forecast;
  return (
    <div className="operatorFieldRuntime__forecastGrid" data-h60f="forecast-tab-ready" data-forecast-source={forecast.source} data-window-source={forecast.forecastWindow.source}>
      <article className="operatorFieldRuntime__panel" data-h60f-panel="forecast-intro">
        <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("forecast")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("forecast")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">operator_field_twin_forecast_panel_v1</span></div>
        <p className="operatorFieldRuntime__stubLead" data-locale-neutral="true">forecast_window_v1</p>
        <p className="operatorFieldRuntime__stubLead">{t("forecastIntro")}</p>
        <p className="operatorFieldRuntime__stubLead">{t("forecastReview")}</p>
        <p className="operatorFieldRuntime__stubLead">{t("forecastNonclaim")}</p>
        <p className="operatorFieldRuntime__stubLead">{t("forecastNoActions")}</p>
      </article>
      <FieldRuntimeForecastWindowPanel forecast={forecast} />
      <FieldRuntimeForecastTimelinePanel forecast={forecast} />
      <FieldRuntimeForecastEvidencePanel forecast={forecast} />
      <FieldRuntimeForecastBoundaryPanel forecast={forecast} />
    </div>
  );
}
