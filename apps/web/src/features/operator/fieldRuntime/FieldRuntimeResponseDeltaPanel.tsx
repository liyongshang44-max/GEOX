// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResponseDeltaPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

export default function FieldRuntimeResponseDeltaPanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const delta = residual.responseDelta;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__responseDelta" data-h60h-panel="response-delta">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("responseDelta")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("responseDelta")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("reviewOnly")}</span></div>
      <p className="operatorFieldRuntime__stubLead">{locale === "en-US" ? "Response comparison metadata only." : "仅展示响应比较元数据。"}</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("status")}</p><strong>{delta.statusText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{locale === "en-US" ? "Delta Direction" : "变化方向"}</p><strong>{delta.deltaDirection}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{locale === "en-US" ? "Delta Value" : "变化值"}</p><strong>{delta.deltaValue}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{locale === "en-US" ? "Expected Response" : "预期响应"}</p><strong>{delta.meetsExpectedResponse}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{locale === "en-US" ? "Reason Codes" : "原因代码"}</p><strong>{delta.reasonCodes.join(", ") || t("none")}</strong></section>
      </div>
    </article>
  );
}
