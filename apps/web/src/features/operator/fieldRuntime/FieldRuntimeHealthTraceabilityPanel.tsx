// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthTraceabilityPanel.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthTraceabilityPanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const traceability = health.traceability;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthTraceability" data-h62-panel="traceability">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthTraceability")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Traceability Availability", "可追溯性可用性")}</h2></div><span className="operatorFieldRuntime__panelMeta">createsTrace=false</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Traceability availability is navigation and readback metadata; it creates no trace record.", "可追溯性可用性是导航与回查元数据，不创建追踪记录。")}</p>
    <div className="operatorFieldRuntime__healthTable" role="table" aria-label={text("Traceability Availability Matrix", "可追溯性可用性矩阵")}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Audit Route", "审计路由")}</span><span>{text("Replay Demo Route", "回放演示路由")}</span><span>{text("Bridge Available", "桥接可用")}</span><span>createsTrace</span></div><div className="operatorFieldRuntime__healthTableRow" role="row"><span>{traceability.fieldRuntimeAuditRoute}</span><span><Link to={traceability.replayDemoRoute}>{text("Replay Demo Only", "仅回放演示")}</Link></span><span>{traceability.traceReadbackBridgeAvailable ? "true" : "false"}</span><span>{traceability.createsTrace ? "true" : "false"}</span></div></div>
  </article>;
}
