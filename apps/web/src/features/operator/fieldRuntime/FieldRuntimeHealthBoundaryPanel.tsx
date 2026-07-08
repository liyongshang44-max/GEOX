// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthBoundaryPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";

export default function FieldRuntimeHealthBoundaryPanel(): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const lines = [
    t("noBackendChange"), text("No Live Polling", "不进行实时轮询"), text("No Production Monitoring", "不进行生产监控"), text("No Alerting", "不发送告警"), text("No Incident Creation", "不创建事件"), t("noDispatch"), t("noFactsWrite"), t("noRoi"), t("noFieldMemory"), t("noModelUpdate"),
  ];
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthBoundary" data-h62-panel="health-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthBoundary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("healthBoundary")}</h2></div><span className="operatorFieldRuntime__panelMeta">readOnly=true</span></div>
    <ul className="operatorFieldRuntime__boundaryList">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
  </article>;
}
