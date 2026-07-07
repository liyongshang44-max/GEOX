// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthReadModelPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthReadModelPanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthReadModels" data-h62-panel="read-model-availability">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthReadModel")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Read Model Availability", "读模型可用性")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("UI / Read-model Availability", "界面 / 读模型可用性")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Read-model availability is not production health.", "读模型可用性不代表生产健康状态。")}</p>
    <div className="operatorFieldRuntime__healthTable" role="table" aria-label={text("Read Model Availability Matrix", "读模型可用性矩阵")}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Tab", "标签页")}</span><span>{text("Read Model", "读模型")}</span><span>{t("status")}</span><span>{text("Backend Changed", "后端是否变更")}</span></div>{health.readModelAvailability.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.readModel}</span><span>{row.status}</span><span>{row.backendChangedByH62 ? "true" : "false"}</span></div>)}</div>
  </article>;
}
