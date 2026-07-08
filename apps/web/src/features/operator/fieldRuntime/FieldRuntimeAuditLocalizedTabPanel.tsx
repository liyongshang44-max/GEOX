// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLocalizedTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeAuditLoadState } from "./fieldRuntimeAuditAdapter";
import FieldRuntimeAuditBoundaryMatrixPanel from "./FieldRuntimeAuditBoundaryMatrixPanel";
import FieldRuntimeAuditCompletionPanel from "./FieldRuntimeAuditCompletionPanel";
import FieldRuntimeAuditLegacyBridgePanel from "./FieldRuntimeAuditLegacyBridgePanel";
import FieldRuntimeAuditRouteMatrixPanel from "./FieldRuntimeAuditRouteMatrixPanel";
import FieldRuntimeAuditSourceMatrixPanel from "./FieldRuntimeAuditSourceMatrixPanel";
import FieldRuntimeTraceReadbackBridgePanel from "./FieldRuntimeTraceReadbackBridgePanel";

export default function FieldRuntimeAuditLocalizedTabPanel({ loadState }: { loadState?: FieldRuntimeAuditLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  if (!loadState || loadState.status !== "ready") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("audit")}</h2><p>{text("Audit metadata is unavailable.", "审计元数据不可用。")}</p></article>;
  const audit = loadState.audit;
  return <div className="operatorFieldRuntime__auditGrid" data-h60k="audit-tab-ready" data-audit-source={audit.source}>
    <article className="operatorFieldRuntime__panel" data-h60k-panel="audit-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("audit")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("auditReview")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">field_runtime_audit_v1</span></div>
      <p className="operatorFieldRuntime__stubLead">{text("Local route, source, contract, and boundary metadata.", "本地路由、来源、契约和边界元数据。")}</p>
      <p className="operatorFieldRuntime__stubLead">{text("Traceability review only; no runtime mutation.", "仅用于可追溯性审查；不修改运行状态。")}</p>
    </article>
    <FieldRuntimeAuditCompletionPanel audit={audit} /><FieldRuntimeAuditSourceMatrixPanel audit={audit} /><FieldRuntimeAuditRouteMatrixPanel audit={audit} /><FieldRuntimeAuditLegacyBridgePanel audit={audit} /><FieldRuntimeAuditBoundaryMatrixPanel audit={audit} /><FieldRuntimeTraceReadbackBridgePanel audit={audit} />
  </div>;
}
