// apps/web/src/features/operator/components/EvidenceTracePanel.tsx
// Purpose: render read-only evidence trace rows in Chinese for Operator Twin review.
import React from "react";
import type { OperatorEvidenceTraceItem } from "../../../api/operatorTwin";

function boolText(value: boolean): string {
  return value ? "可用" : "缺失";
}

function emptyText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "无";
}

function stageText(value: string): string {
  const labels: Record<string, string> = {
    Fact: "事实",
    Estimate: "估计",
    Forecast: "预测",
    Scenario: "情景",
    Recommendation: "建议候选",
  };
  return (labels[value] ?? value) + "（" + value + "）";
}

function evidenceLabelText(value: string): string {
  const labels: Record<string, string> = {
    "Field Index": "地块索引",
    "Water State Estimate": "水分状态估计",
    "Soil Moisture Sensing Window": "土壤水分感知窗口",
    "Weather Forecast": "天气预测",
    "Irrigation Scenario Set": "灌溉情景集",
    "Decision Recommendation": "决策建议",
  };
  return (labels[value] ?? value) + "（" + value + "）";
}

function RefList({ refs }: { refs: string[] }): React.ReactElement {
  const cleanRefs = refs.map((ref) => ref.trim()).filter(Boolean);
  if (cleanRefs.length === 0) return <span>无</span>;
  return (
    <details>
      <summary>查看 {cleanRefs.length} 条证据引用</summary>
      <ul className="operatorList">
        {cleanRefs.map((ref) => <li key={ref}>{ref}</li>)}
      </ul>
    </details>
  );
}

export default function EvidenceTracePanel({ items }: { items: OperatorEvidenceTraceItem[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="EvidenceTracePanel">
      <p className="operatorEyebrow">证据链</p>
      <h3>证据追踪</h3>
      <ul className="operatorList">
        {items.map((item) => (
          <li key={item.source_table}>
            <strong>{stageText(item.stage)} · {evidenceLabelText(item.label)}</strong>
            <br />可用状态：{boolText(item.available)}
            <br />来源表：{item.source_table}
            <br />证据引用：<RefList refs={item.evidence_refs} />
            <br />质量标记：{emptyText(item.quality_flags.join("，"))}
          </li>
        ))}
      </ul>
    </article>
  );
}
