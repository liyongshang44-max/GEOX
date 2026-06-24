// apps/web/src/features/operator/components/LowQualityReasonList.tsx
// Purpose: render low-quality reasons and evidence gaps as read-only Chinese display text.
import React from "react";
import type { OperatorLowQualityReason, OperatorTwinGap } from "../../../api/operatorTwin";

function emptyText(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  return raw || "无";
}

function severityText(value: string): string {
  const labels: Record<string, string> = {
    INFO: "信息",
    WARNING: "警告",
    BLOCKING: "阻塞",
  };
  const label = labels[value] ?? value;
  return label === value ? value : label + "（" + value + "）";
}

export default function LowQualityReasonList({ reasons, gaps }: { reasons: OperatorLowQualityReason[]; gaps: OperatorTwinGap[] }): React.ReactElement {
  return (
    <article className="operatorPanel" data-card="LowQualityReasonList">
      <h3>数据缺口</h3>
      <ul className="operatorList">
        {reasons.map((reason) => <li key={reason.source_table}>{reason.source_table}：{reason.reason} · 证据引用：{emptyText(reason.evidence_refs.join(", "))}</li>)}
        {gaps.map((gap) => <li key={gap.gap_code}>{severityText(gap.severity)} · {gap.label} · 缺失原因：{gap.gap_code}</li>)}
      </ul>
    </article>
  );
}
