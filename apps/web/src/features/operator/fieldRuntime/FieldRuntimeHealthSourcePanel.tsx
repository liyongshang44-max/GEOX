// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthSourcePanel.tsx
import React from "react";
import { useLocale, type LocaleCode } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

function localizeValue(value: string, locale: LocaleCode): string {
  const copy: Record<string, { zh: string; en: string }> = {
    "Field Runtime source family": { zh: "地块运行来源族", en: "Field Runtime Source Family" },
    "Replay Demo source family": { zh: "回放演示来源族", en: "Replay Demo Source Family" },
    "Static checked-in snapshot": { zh: "已签入静态快照", en: "Static Checked-in Snapshot" },
    "Local health metadata": { zh: "本地健康元数据", en: "Local Health Metadata" },
    "Route and tab metadata are available.": { zh: "路由和标签页元数据可用。", en: "Route and tab metadata are available." },
    "Replay-backed demo route is available as static source reference.": { zh: "回放支撑演示路由可作为静态来源引用。", en: "Replay-backed demo route is available as a static source reference." },
    "Snapshot identity is checked-in source metadata.": { zh: "快照身份属于已签入来源元数据。", en: "Snapshot identity is checked-in source metadata." },
    "Health review is built locally from source and boundary metadata.": { zh: "健康审查由来源与边界元数据在本地构建。", en: "Health review is built locally from source and boundary metadata." },
    "live freshness": { zh: "实时新鲜度", en: "Live Freshness" },
    "live gateway": { zh: "实时网关", en: "Live Gateway" },
    "device uptime": { zh: "设备在线时长", en: "Device Uptime" },
    "online heartbeat": { zh: "在线心跳", en: "Online Heartbeat" },
    available: { zh: "可用", en: "Available" },
    not_enabled: { zh: "未启用", en: "Not Enabled" },
    metadata_only: { zh: "仅元数据", en: "Metadata Only" },
  };
  const entry = copy[value];
  return entry ? (locale === "en-US" ? entry.en : entry.zh) : value;
}

export default function FieldRuntimeHealthSourcePanel({ health }: { health: FieldRuntimeHealthViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthSource" data-h62-panel="source-freshness">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("healthSource")}</p><h2 className="operatorFieldRuntime__panelTitle">{text("Source Freshness", "来源新鲜度")}</h2></div><span className="operatorFieldRuntime__panelMeta">{text("Metadata Only", "仅元数据")}</span></div>
      <p className="operatorFieldRuntime__stubLead">{text("Source freshness is review metadata.", "来源新鲜度是审查元数据。")}</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label={text("Source Freshness Matrix", "来源新鲜度矩阵")}>
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>{t("source")}</span><span>{text("Availability", "可用性")}</span><span>{text("Meaning", "含义")}</span><span>{text("Boundary", "边界")}</span></div>
        {health.sourceFreshness.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.source}><span>{localizeValue(row.source, locale)}</span><span>{localizeValue(row.availability, locale)}</span><span>{localizeValue(row.freshnessMeaning, locale)}</span><span>{localizeValue(row.doesNotMean, locale)}</span></div>)}
      </div>
    </article>
  );
}
