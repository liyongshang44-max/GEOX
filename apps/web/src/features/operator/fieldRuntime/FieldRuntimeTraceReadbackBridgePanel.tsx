// apps/web/src/features/operator/fieldRuntime/FieldRuntimeTraceReadbackBridgePanel.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

export default function FieldRuntimeTraceReadbackBridgePanel({ audit }: { audit: FieldRuntimeAuditViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const bridge = audit.traceBridge;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__traceBridge" data-h60k-panel="trace-readback-bridge">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("traceReadbackBridge")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Bridge Only", "仅桥接")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Full trace readback remains in the existing Twin Trace Readback surface; this tab does not replace it.", "完整追踪回查仍保留在现有 Twin Trace Readback 界面；本标签页不替代它。")}</p>
    <p className="operatorFieldRuntime__panelMeta">decision_cycle_id: <span data-locale-neutral="true">{bridge.hasDecisionCycleId ? bridge.decisionCycleId : text("Not Provided", "未提供")}</span></p>
    {bridge.hasDecisionCycleId ? <Link className="operatorFieldRuntime__tab" to={bridge.traceReadbackPath}>{text("Open Existing Trace Readback", "打开现有追踪回查")}</Link> : null}
    <p className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">{bridge.traceReadbackPath || "/operator/twin/traces/:decisionCycleId"}</p>
  </article>;
}
