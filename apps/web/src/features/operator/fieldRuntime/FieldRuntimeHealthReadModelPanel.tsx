// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthReadModelPanel.tsx
import React from "react";
import { useLocale, type LocaleCode } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

function tabLabel(value: string, locale: LocaleCode): string {
  const labels: Record<string, { zh: string; en: string }> = {
    "Overview / State": { zh: "总览 / 状态", en: "Overview / State" },
    Evidence: { zh: "证据", en: "Evidence" },
    Forecast: { zh: "预测", en: "Forecast" },
    Scenario: { zh: "情景", en: "Scenario" },
    "Residual / Verification": { zh: "残差 / 核验", en: "Residual / Verification" },
    Calibration: { zh: "校准", en: "Calibration" },
    Audit: { zh: "审计", en: "Audit" },
    Health: { zh: "健康", en: "Health" },
    "Gateway Demo": { zh: "网关演示", en: "Gateway Demo" },
  };
  const copy = labels[value];
  return copy ? (locale === "en-US" ? copy.en : copy.zh) : value;
}

function statusLabel(value: string, locale: LocaleCode): string {
  if (value === "available") return locale === "en-US" ? "Available" : "可用";
  if (value === "not_enabled") return locale === "en-US" ? "Not Enabled" : "未启用";
  return value;
}

export default function FieldRuntimeHealthReadModelPanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthReadModels" data-h62-panel="read-model-availability">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthReadModel")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Read Model Availability", "读模型可用性")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("UI / Read-model Availability", "界面 / 读模型可用性")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Read-model availability is not production health.", "读模型可用性不代表生产健康状态。")}</p>
    <div className="operatorFieldRuntime__healthTable" role="table" aria-label={text("Read Model Availability Matrix", "读模型可用性矩阵")}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Tab", "标签页")}</span><span>{text("Read Model", "读模型")}</span><span>{t("status")}</span><span>{text("Backend Changed", "后端是否变更")}</span></div>{health.readModelAvailability.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.tab}><span>{tabLabel(row.tab, locale)}</span><span data-locale-neutral="true">{row.readModel}</span><span>{statusLabel(row.status, locale)}</span><span>{row.backendChangedByH62 ? text("Yes", "是") : text("No", "否")}</span></div>)}</div>
  </article>;
}
