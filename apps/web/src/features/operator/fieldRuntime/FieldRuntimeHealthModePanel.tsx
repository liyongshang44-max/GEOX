// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthModePanel.tsx
import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

export default function FieldRuntimeHealthModePanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const rows = [
    [text("Runtime Mode", "运行模式"), text("Replay-backed Demo", "回放支撑演示")],
    [text("Health Mode", "健康模式"), text("Replay-backed Health Review", "回放支撑健康审查")],
    [t("readOnly"), health.boundary.readOnly ? text("Yes", "是") : text("No", "否")],
    [text("Live Device", "实时设备"), text("Not Connected", "未连接")],
    [text("Production Gateway", "生产网关"), text("Not Online", "未上线")],
    [text("Field Pilot", "田间试点"), text("Not Started", "未开始")],
    [text("AO-ACT Dispatch", "AO-ACT 派发"), text("Disabled", "已禁用")],
  ];
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthMode" data-h62-panel="runtime-mode">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("health")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("healthMode")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">mode: {health.mode}</span></div>
    <ProductHorizontalScrollRegion ariaLabel={t("healthMode")} overflowOwner="operator-health-mode">
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label={t("healthMode")}><div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{text("Label", "标签")}</span><span>{text("Value", "值")}</span></div>{rows.map(([rowLabel, value]) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={rowLabel}><span>{rowLabel}</span><span>{value}</span></div>)}</div>
    </ProductHorizontalScrollRegion>
  </article>;
}
