// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthGatewayBoundaryPanel.tsx
import React from "react";
import { Link } from "react-router-dom";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthGatewayBoundaryPanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const gateway = health.gatewayBoundary;
  const regionLabel = text("Gateway Boundary Matrix", "网关边界矩阵");
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthGatewayBoundary" data-h62-panel="gateway-boundary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{text("Gateway Snapshot Boundary", "网关快照边界")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Gateway Snapshot Boundary", "网关快照边界")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-long-token="true">{gateway.gatewaySource}</span></div>
    <p className="operatorFieldRuntime__stubLead">{text("Gateway Demo is replay-backed.", "网关演示由回放支撑。")}</p><p className="operatorFieldRuntime__stubLead">{text("Gateway Demo does not mean production gateway online or runtime-health telemetry.", "网关演示不表示生产网关在线，也不表示运行健康遥测。")}</p>
    <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-health-gateway-boundary">
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label={regionLabel}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Route", "路由")}</span><span>{t("source")}</span><span>{text("Live Gateway Claimed", "声明实时网关")}</span><span>{text("Production Gateway Claimed", "声明生产网关在线")}</span></div><div className="operatorFieldRuntime__healthTableRow" role="row"><span><Link to={gateway.replayDemoRoute}>{text("Replay Demo Only", "仅回放演示")}</Link></span><span data-long-token="true">{gateway.gatewaySource}</span><span>{gateway.liveGatewayClaimed ? "true" : "false"}</span><span>{gateway.productionGatewayOnlineClaimed ? "true" : "false"}</span></div></div>
    </ProductHorizontalScrollRegion>
  </article>;
}
