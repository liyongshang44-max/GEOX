// apps/web/src/features/operator/fieldRuntime/FieldRuntimeZoneResponsePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

export default function FieldRuntimeZoneResponsePanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const label = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__zoneResponse" data-h60h-panel="zone-response">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("zoneResponse")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("zoneResponse")}</h2></div><span className="operatorFieldRuntime__panelMeta">{residual.zoneResponse.rows.length} {t("rows")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{label("Zone response is verification display, not a zone prescription.", "分区响应仅用于核验展示，不是分区处方。")}</p>
    <div className="operatorFieldRuntime__residualTable" role="table" aria-label={t("zoneResponse")}>
      <div className="operatorFieldRuntime__residualTableHeader" role="row"><span>{label("Zone ID", "分区 ID")}</span><span>{t("status")}</span><span>{label("Delta Value", "变化值")}</span></div>
      {residual.zoneResponse.rows.length === 0 ? <div className="operatorFieldRuntime__residualTableRow" role="row"><span>{label("No zone response rows returned.", "未返回分区响应记录。")}</span><span>{t("unavailable")}</span><span>{t("unavailable")}</span></div> : null}
      {residual.zoneResponse.rows.map((row) => <div className="operatorFieldRuntime__residualTableRow" role="row" key={row.zoneId}><span>{row.zoneId}</span><span>{row.statusText}</span><span>{row.deltaValue}</span></div>)}
    </div>
  </article>;
}
