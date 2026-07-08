// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthLocalizedTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthLoadState } from "./fieldRuntimeHealthAdapter";
import FieldRuntimeHealthBoundaryPanel from "./FieldRuntimeHealthBoundaryPanel";
import FieldRuntimeHealthEvidencePipelinePanel from "./FieldRuntimeHealthEvidencePipelinePanel";
import FieldRuntimeHealthGatewayBoundaryPanel from "./FieldRuntimeHealthGatewayBoundaryPanel";
import FieldRuntimeHealthModePanel from "./FieldRuntimeHealthModePanel";
import FieldRuntimeHealthNonclaimsPanel from "./FieldRuntimeHealthNonclaimsPanel";
import FieldRuntimeHealthReadModelPanel from "./FieldRuntimeHealthReadModelPanel";
import FieldRuntimeHealthSourcePanel from "./FieldRuntimeHealthSourcePanel";
import FieldRuntimeHealthTraceabilityPanel from "./FieldRuntimeHealthTraceabilityPanel";

export default function FieldRuntimeHealthLocalizedTabPanel({ loadState }: { loadState?: FieldRuntimeHealthLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  if (!loadState || loadState.status !== "ready") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("health")}</h2><p>{text("Runtime health metadata is unavailable.", "运行健康元数据不可用。")}</p></article>;
  const health = loadState.health;
  return <div className="operatorFieldRuntime__healthGrid" data-h62="health-ready" data-health-source={health.source}>
    <article className="operatorFieldRuntime__panel" data-h62-panel="health-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("health")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("healthReview")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">field_runtime_health_review_v1</span></div>
      <p className="operatorFieldRuntime__stubLead">{text("Replay-backed health review.", "回放支撑的健康审查。")}</p>
      <p className="operatorFieldRuntime__stubLead">{text("Displayed for review only.", "仅用于审查。")}</p>
      <p className="operatorFieldRuntime__stubLead">{text("No live device, production gateway, or continuous production monitoring claim.", "不声明实时设备连接、生产网关在线或连续生产监控。")}</p>
    </article>
    <FieldRuntimeHealthModePanel health={health} /><FieldRuntimeHealthSourcePanel health={health} /><FieldRuntimeHealthReadModelPanel health={health} /><FieldRuntimeHealthEvidencePipelinePanel health={health} /><FieldRuntimeHealthGatewayBoundaryPanel health={health} /><FieldRuntimeHealthTraceabilityPanel health={health} /><FieldRuntimeHealthNonclaimsPanel health={health} /><FieldRuntimeHealthBoundaryPanel />
  </div>;
}
