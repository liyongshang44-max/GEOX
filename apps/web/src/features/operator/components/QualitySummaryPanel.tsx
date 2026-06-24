// apps/web/src/features/operator/components/QualitySummaryPanel.tsx
// Purpose: render read-only evidence quality summary in Chinese for Operator Twin review.
import React from "react";
import type { OperatorQualitySummary } from "../../../api/operatorTwin";

function statusText(value: string): string {
  const map: Record<string, string> = {
    AVAILABLE: "可用",
    LIMITED: "受限",
    BLOCKING: "阻塞",
  };
  return (map[value] ?? value) + "（" + value + "）";
}

function boolText(value: boolean): string {
  return value ? "是" : "否";
}

export default function QualitySummaryPanel({ summary }: { summary: OperatorQualitySummary }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="QualitySummaryPanel">
      <p className="operatorEyebrow">质量摘要</p>
      <h3>证据质量结论</h3>
      <p><span className="operatorPill">{statusText(summary.status)}</span></p>
      <ul className="operatorList">
        <li>阻塞原因：{summary.blocking_reason ?? "无"}</li>
        <li>是否含模拟数据：{boolText(summary.simulation_data_present)}</li>
        <li>正式数据是否合格：{boolText(summary.official_data_qualified)}</li>
      </ul>
    </article>
  );
}
