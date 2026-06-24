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
            <strong>{item.stage} · {item.label}</strong>
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
